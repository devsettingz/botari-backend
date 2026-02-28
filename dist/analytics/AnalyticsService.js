"use strict";
/**
 * Analytics Service - Core analytics engine for Botari AI
 *
 * This service provides comprehensive analytics capabilities including:
 * - Metric calculations from database
 * - Time-series data generation
 * - Statistics aggregation
 * - Caching for performance optimization
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const db_1 = __importDefault(require("../db"));
// ============================================================================
// ANALYTICS SERVICE
// ============================================================================
class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }
    // ========================================================================
    // CACHE UTILITIES
    // ========================================================================
    getCacheKey(prefix, params) {
        return `${prefix}:${JSON.stringify(params)}`;
    }
    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    invalidateCache(pattern) {
        if (pattern) {
            const keys = Array.from(this.cache.keys());
            for (const key of keys) {
                if (key.startsWith(pattern)) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
    }
    // ========================================================================
    // OVERVIEW METRICS
    // ========================================================================
    async getOverviewMetrics(businessId) {
        const cacheKey = this.getCacheKey('overview', { businessId });
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        let whereClause = '';
        const params = [];
        if (businessId) {
            whereClause = 'WHERE business_id = $1';
            params.push(businessId);
        }
        const [conversationsResult, messagesResult, businessesResult, revenueResult] = await Promise.all([
            db_1.default.query(`SELECT COUNT(*) as count FROM conversations ${whereClause}`, params),
            db_1.default.query(`SELECT COUNT(*) as count FROM messages ${whereClause}`, params),
            db_1.default.query(`SELECT COUNT(DISTINCT id) as count FROM businesses WHERE is_active = true`),
            db_1.default.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' ${businessId ? 'AND business_id = $1' : ''}`, businessId ? [businessId] : [])
        ]);
        // Calculate average response time from messages
        const avgResponseResult = await db_1.default.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) as avg_response
      FROM messages m1
      JOIN messages m2 ON m1.conversation_id = m2.conversation_id 
        AND m2.created_at > m1.created_at
        AND m1.role = 'user' AND m2.role = 'assistant'
      ${businessId ? 'WHERE m1.business_id = $1' : ''}
    `, businessId ? [businessId] : []);
        // Calculate conversion rate (orders from conversations)
        const conversionResult = await db_1.default.query(`
      SELECT 
        COUNT(DISTINCT o.id)::float / NULLIF(COUNT(DISTINCT c.id), 0) * 100 as rate
      FROM conversations c
      LEFT JOIN orders o ON c.customer_phone = o.customer_phone 
        AND o.created_at >= c.started_at
        AND o.created_at <= c.started_at + INTERVAL '24 hours'
      ${businessId ? 'WHERE c.business_id = $1' : ''}
    `, businessId ? [businessId] : []);
        const avgResponseTime = avgResponseResult.rows[0]?.avg_response || 0;
        const metrics = {
            totalConversations: parseInt(conversationsResult.rows[0].count, 10),
            totalMessages: parseInt(messagesResult.rows[0].count, 10),
            avgResponseTime: this.formatDuration(avgResponseTime),
            activeBusinesses: parseInt(businessesResult.rows[0].count, 10),
            totalRevenue: parseFloat(revenueResult.rows[0].total) || 0,
            conversionRate: parseFloat(conversionResult.rows[0]?.rate) || 0
        };
        this.setCache(cacheKey, metrics);
        return metrics;
    }
    // ========================================================================
    // BUSINESS METRICS
    // ========================================================================
    async getBusinessMetrics(businessId, dateRange) {
        const cacheKey = this.getCacheKey('business', { businessId, dateRange });
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        const dateFilter = this.buildDateFilter(dateRange, 'c.created_at');
        // Get basic business info
        const businessResult = await db_1.default.query('SELECT id, business_name FROM businesses WHERE id = $1', [businessId]);
        if (businessResult.rows.length === 0) {
            throw new Error('Business not found');
        }
        const business = businessResult.rows[0];
        // Get conversation metrics
        const conversationResult = await db_1.default.query(`
      SELECT 
        COUNT(*) as total_conversations,
        AVG(message_count) as avg_messages_per_conversation,
        AVG(EXTRACT(EPOCH FROM (closed_at - started_at))) as avg_duration
      FROM conversations c
      WHERE c.business_id = $1 ${dateFilter.sql}
    `, [businessId, ...dateFilter.params]);
        // Get total messages
        const messagesResult = await db_1.default.query(`
      SELECT COUNT(*) as total_messages
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.business_id = $1 ${dateFilter.sql}
    `, [businessId, ...dateFilter.params]);
        // Get average response time
        const responseTimeResult = await db_1.default.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) as avg_response
      FROM messages m1
      JOIN messages m2 ON m1.conversation_id = m2.conversation_id 
        AND m2.created_at > m1.created_at
        AND m1.role = 'user' AND m2.role = 'assistant'
      JOIN conversations c ON m1.conversation_id = c.id
      WHERE c.business_id = $1 ${dateFilter.sql}
    `, [businessId, ...dateFilter.params]);
        // Get peak hour
        const peakHourResult = await db_1.default.query(`
      SELECT EXTRACT(HOUR FROM started_at) as hour, COUNT(*) as count
      FROM conversations
      WHERE business_id = $1 ${dateFilter.sql}
      GROUP BY EXTRACT(HOUR FROM started_at)
      ORDER BY count DESC
      LIMIT 1
    `, [businessId, ...dateFilter.params]);
        // Get top products inquired about (from action_logs)
        const topProductsResult = await db_1.default.query(`
      SELECT 
        p.name,
        COUNT(*) as inquiries
      FROM action_logs al
      JOIN products p ON al.params->>'product_id' = p.id::text
      WHERE al.business_id = $1 
        AND al.action_name = 'check_inventory'
        ${dateFilter.sql.replace('c.created_at', 'al.executed_at')}
      GROUP BY p.name
      ORDER BY inquiries DESC
      LIMIT 5
    `, [businessId, ...dateFilter.params]);
        // Get revenue generated
        const revenueResult = await db_1.default.query(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE business_id = $1 ${dateFilter.sql.replace('c.created_at', 'created_at')}
    `, [businessId, ...dateFilter.params]);
        // Get customer satisfaction from feedback
        const satisfactionResult = await db_1.default.query(`
      SELECT AVG(rating) as avg_rating
      FROM feedback
      WHERE business_id = $1 ${dateFilter.sql.replace('c.created_at', 'created_at')}
    `, [businessId, ...dateFilter.params]);
        // Get trends
        const trends = await this.getBusinessTrends(businessId, dateRange);
        // Calculate conversion rate
        const conversionResult = await db_1.default.query(`
      SELECT 
        COUNT(DISTINCT o.id)::float / NULLIF(COUNT(DISTINCT c.id), 0) * 100 as rate
      FROM conversations c
      LEFT JOIN orders o ON c.customer_phone = o.customer_phone 
        AND o.created_at >= c.started_at
        AND o.created_at <= c.started_at + INTERVAL '24 hours'
      WHERE c.business_id = $1 ${dateFilter.sql}
    `, [businessId, ...dateFilter.params]);
        const metrics = {
            businessId,
            businessName: business.business_name,
            totalConversations: parseInt(conversationResult.rows[0]?.total_conversations || 0, 10),
            totalMessages: parseInt(messagesResult.rows[0]?.total_messages || 0, 10),
            avgMessagesPerConversation: parseFloat(conversationResult.rows[0]?.avg_messages_per_conversation || 0),
            avgResponseTime: parseFloat(responseTimeResult.rows[0]?.avg_response || 0),
            peakHour: peakHourResult.rows[0] ? `${peakHourResult.rows[0].hour}:00` : 'N/A',
            conversionRate: parseFloat(conversionResult.rows[0]?.rate || 0),
            customerSatisfaction: parseFloat(satisfactionResult.rows[0]?.avg_rating || 0) || 4.5,
            revenueGenerated: parseFloat(revenueResult.rows[0]?.revenue || 0),
            topProducts: topProductsResult.rows.map(r => ({ name: r.name, inquiries: parseInt(r.inquiries, 10) })),
            trends
        };
        this.setCache(cacheKey, metrics);
        return metrics;
    }
    async getBusinessTrends(businessId, dateRange) {
        const days = this.getDaysFromRange(dateRange, 30);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get daily conversation counts
        const conversationsResult = await db_1.default.query(`
      SELECT DATE(started_at) as date, COUNT(*) as count
      FROM conversations
      WHERE business_id = $1 AND started_at >= $2
      GROUP BY DATE(started_at)
      ORDER BY date
    `, [businessId, startDate]);
        // Get daily message counts
        const messagesResult = await db_1.default.query(`
      SELECT DATE(m.created_at) as date, COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.business_id = $1 AND m.created_at >= $2
      GROUP BY DATE(m.created_at)
      ORDER BY date
    `, [businessId, startDate]);
        return {
            conversations: this.fillDateGaps(conversationsResult.rows.map(r => ({
                date: r.date.toISOString().split('T')[0],
                count: parseInt(r.count, 10)
            })), days),
            messages: this.fillDateGaps(messagesResult.rows.map(r => ({
                date: r.date.toISOString().split('T')[0],
                count: parseInt(r.count, 10)
            })), days)
        };
    }
    // ========================================================================
    // EMPLOYEE METRICS
    // ========================================================================
    async getEmployeeMetrics(employeeId, businessId, dateRange) {
        const cacheKey = this.getCacheKey('employee', { employeeId, businessId, dateRange });
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        const dateFilter = this.buildDateFilter(dateRange, 'c.started_at');
        const dateFilterMessages = this.buildDateFilter(dateRange, 'm.created_at');
        const dateFilterActions = this.buildDateFilter(dateRange, 'al.executed_at');
        // Get employee info
        const employeeResult = await db_1.default.query('SELECT id, display_name, employee_role FROM ai_employees WHERE id = $1', [employeeId]);
        if (employeeResult.rows.length === 0) {
            throw new Error('Employee not found');
        }
        const employee = employeeResult.rows[0];
        // Get conversation and message metrics
        let conversationQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as conversations_handled,
        COUNT(m.id) as messages_handled
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id AND m.role = 'assistant'
      WHERE c.employee_id = $1 ${dateFilter.sql}
    `;
        const conversationParams = [employeeId, ...dateFilter.params];
        if (businessId) {
            conversationQuery = conversationQuery.replace('WHERE c.employee_id', 'WHERE c.business_id = $2 AND c.employee_id');
            conversationParams.push(businessId);
        }
        const conversationResult = await db_1.default.query(conversationQuery, conversationParams);
        // Get action metrics
        let actionQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE success = true) as successful_actions
      FROM action_logs al
      WHERE al.executed_by = $1 ${dateFilterActions.sql.replace('c.started_at', 'al.executed_at')}
    `;
        const actionParams = [employee.display_name.toLowerCase(), ...dateFilterActions.params];
        if (businessId) {
            actionQuery = actionQuery.replace('WHERE al.executed_by', 'WHERE al.business_id = $' + (actionParams.length + 1) + ' AND al.executed_by');
            actionParams.push(businessId);
        }
        const actionResult = await db_1.default.query(actionQuery, actionParams);
        // Get average handling time
        const handlingTimeResult = await db_1.default.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (closed_at - started_at))) as avg_time
      FROM conversations
      WHERE employee_id = $1 AND status = 'closed' ${dateFilter.sql.replace('c.started_at', 'started_at')}
    `, [employeeId, ...dateFilter.params]);
        // Get escalation rate
        const escalationResult = await db_1.default.query(`
      SELECT 
        COUNT(*) FILTER (WHERE escalation_reason IS NOT NULL)::float / 
        NULLIF(COUNT(*), 0) * 100 as escalation_rate
      FROM conversations
      WHERE employee_id = $1 ${dateFilter.sql.replace('c.started_at', 'started_at')}
    `, [employeeId, ...dateFilter.params]);
        // Get revenue generated (from orders linked to conversations)
        const revenueResult = await db_1.default.query(`
      SELECT COALESCE(SUM(o.total_amount), 0) as revenue
      FROM conversations c
      JOIN orders o ON c.customer_phone = o.customer_phone
        AND o.created_at >= c.started_at
        AND o.created_at <= c.started_at + INTERVAL '24 hours'
      WHERE c.employee_id = $1 ${dateFilter.sql}
    `, [employeeId, ...dateFilter.params]);
        // Get trend data
        const trend = await this.getEmployeeTrend(employeeId, businessId, dateRange);
        const totalActions = parseInt(actionResult.rows[0]?.total_actions || 0, 10);
        const successfulActions = parseInt(actionResult.rows[0]?.successful_actions || 0, 10);
        const metrics = {
            employeeId,
            displayName: employee.display_name,
            employeeRole: employee.employee_role,
            messagesHandled: parseInt(conversationResult.rows[0]?.messages_handled || 0, 10),
            conversationsHandled: parseInt(conversationResult.rows[0]?.conversations_handled || 0, 10),
            actionsExecuted: totalActions,
            actionsSuccessRate: totalActions > 0 ? (successfulActions / totalActions) * 100 : 100,
            avgHandlingTime: parseFloat(handlingTimeResult.rows[0]?.avg_time || 0),
            escalationRate: parseFloat(escalationResult.rows[0]?.escalation_rate || 0),
            revenueGenerated: parseFloat(revenueResult.rows[0]?.revenue || 0),
            customerSatisfaction: 4.5, // Default - would come from feedback table
            trend
        };
        this.setCache(cacheKey, metrics);
        return metrics;
    }
    async getEmployeeTrend(employeeId, businessId, dateRange) {
        const days = this.getDaysFromRange(dateRange, 30);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        let query = `
      SELECT DATE(started_at) as date, COUNT(*) as count
      FROM conversations
      WHERE employee_id = $1 AND started_at >= $2
      GROUP BY DATE(started_at)
      ORDER BY date
    `;
        const params = [employeeId, startDate];
        if (businessId) {
            query = query.replace('WHERE employee_id', 'WHERE business_id = $3 AND employee_id');
            params.push(businessId);
        }
        const result = await db_1.default.query(query, params);
        return this.fillDateGaps(result.rows.map(r => ({
            date: r.date.toISOString().split('T')[0],
            count: parseInt(r.count, 10)
        })), days);
    }
    async getAllEmployeesMetrics(businessId, dateRange) {
        let query = 'SELECT id FROM ai_employees WHERE is_active = true';
        const params = [];
        if (businessId) {
            query = `
        SELECT ae.id 
        FROM ai_employees ae
        JOIN business_employees be ON ae.id = be.employee_id
        WHERE be.business_id = $1 AND ae.is_active = true AND be.is_active = true
      `;
            params.push(businessId);
        }
        const result = await db_1.default.query(query, params);
        const metrics = await Promise.all(result.rows.map(row => this.getEmployeeMetrics(row.id, businessId, dateRange)));
        return metrics;
    }
    // ========================================================================
    // PLATFORM METRICS (Admin)
    // ========================================================================
    async getPlatformMetrics(dateRange) {
        const cacheKey = this.getCacheKey('platform', { dateRange });
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        const dateFilter = this.buildDateFilter(dateRange, 'created_at');
        // Get business counts
        const businessResult = await db_1.default.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active
      FROM businesses
    `);
        // Get employee counts
        const employeeResult = await db_1.default.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT be.employee_id) as active
      FROM ai_employees ae
      LEFT JOIN business_employees be ON ae.id = be.employee_id AND be.is_active = true
      WHERE ae.is_active = true
    `);
        // Get MRR (Monthly Recurring Revenue)
        const mrrResult = await db_1.default.query(`
      SELECT COALESCE(SUM(amount), 0) as mrr
      FROM payments
      WHERE status = 'completed' 
        AND created_at >= DATE_TRUNC('month', NOW())
    `);
        // Get churn rate (businesses that became inactive)
        const churnResult = await db_1.default.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = false AND updated_at >= NOW() - INTERVAL '30 days')::float /
        NULLIF(COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '30 days'), 0) * 100 as churn_rate
      FROM businesses
    `);
        // Get employee utilization (conversations per employee)
        const utilizationResult = await db_1.default.query(`
      SELECT 
        COUNT(DISTINCT c.id)::float / NULLIF(COUNT(DISTINCT c.employee_id), 0) as utilization
      FROM conversations c
      WHERE c.created_at >= NOW() - INTERVAL '30 days'
    `);
        // Get conversation and message totals
        const conversationResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM conversations ${dateFilter.sql.replace('c.created_at', 'created_at')}
    `, dateFilter.params);
        const messageResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM messages ${dateFilter.sql.replace('c.created_at', 'created_at')}
    `, dateFilter.params);
        // Get popular features from action logs
        const featuresResult = await db_1.default.query(`
      SELECT 
        action_name as feature,
        COUNT(*) as usage
      FROM action_logs
      WHERE executed_at >= NOW() - INTERVAL '30 days'
      GROUP BY action_name
      ORDER BY usage DESC
      LIMIT 5
    `);
        // Get business growth trend
        const businessGrowth = await this.getBusinessGrowthTrend(dateRange);
        // Get revenue growth
        const revenueGrowth = await this.getRevenueGrowthTrend(dateRange);
        const metrics = {
            totalBusinesses: parseInt(businessResult.rows[0].total, 10),
            activeBusinesses: parseInt(businessResult.rows[0].active, 10),
            totalEmployees: parseInt(employeeResult.rows[0].total, 10),
            activeEmployees: parseInt(employeeResult.rows[0].active, 10),
            mrr: parseFloat(mrrResult.rows[0].mrr),
            arr: parseFloat(mrrResult.rows[0].mrr) * 12,
            churnRate: parseFloat(churnResult.rows[0]?.churn_rate || 0),
            employeeUtilization: parseFloat(utilizationResult.rows[0]?.utilization || 0),
            totalConversations: parseInt(conversationResult.rows[0].count, 10),
            totalMessages: parseInt(messageResult.rows[0].count, 10),
            popularFeatures: featuresResult.rows.map(r => ({ feature: r.feature, usage: parseInt(r.usage, 10) })),
            businessGrowth,
            revenueGrowth
        };
        this.setCache(cacheKey, metrics);
        return metrics;
    }
    async getBusinessGrowthTrend(dateRange) {
        const days = this.getDaysFromRange(dateRange, 90);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await db_1.default.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM businesses
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startDate]);
        return this.fillDateGaps(result.rows.map(r => ({
            date: r.date.toISOString().split('T')[0],
            count: parseInt(r.count, 10)
        })), days);
    }
    async getRevenueGrowthTrend(dateRange) {
        const days = this.getDaysFromRange(dateRange, 90);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await db_1.default.query(`
      SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as count
      FROM payments
      WHERE status = 'completed' AND created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startDate]);
        return this.fillDateGaps(result.rows.map(r => ({
            date: r.date.toISOString().split('T')[0],
            count: parseFloat(r.count)
        })), days);
    }
    // ========================================================================
    // REVENUE METRICS
    // ========================================================================
    async getRevenueMetrics(businessId, dateRange) {
        const cacheKey = this.getCacheKey('revenue', { businessId, dateRange });
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        const dateFilter = this.buildDateFilter(dateRange, 'created_at');
        let whereClause = '';
        const params = [];
        if (businessId) {
            whereClause = 'AND business_id = $1';
            params.push(businessId);
        }
        // Get total revenue
        const totalResult = await db_1.default.query(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM payments
      WHERE status = 'completed' ${whereClause} ${dateFilter.sql.replace('c.created_at', 'created_at')}
    `, [...params, ...dateFilter.params]);
        // Get MRR
        const mrrResult = await db_1.default.query(`
      SELECT COALESCE(SUM(amount), 0) as mrr
      FROM payments
      WHERE status = 'completed' 
        AND created_at >= DATE_TRUNC('month', NOW())
        ${whereClause}
    `, params);
        // Get ARPU
        const arpuResult = await db_1.default.query(`
      SELECT 
        COALESCE(SUM(amount), 0) / NULLIF(COUNT(DISTINCT business_id), 0) as arpu
      FROM payments
      WHERE status = 'completed' 
        AND created_at >= DATE_TRUNC('month', NOW())
    `);
        // Get revenue by month
        const monthlyResult = await db_1.default.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COALESCE(SUM(amount), 0) as amount
      FROM payments
      WHERE status = 'completed' ${whereClause}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 12
    `, params);
        // Get revenue by plan
        const planResult = await db_1.default.query(`
      SELECT 
        plan,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(DISTINCT business_id) as businesses
      FROM payments p
      JOIN subscriptions s ON p.business_id = s.business_id
      WHERE p.status = 'completed' ${whereClause}
      GROUP BY plan
    `, params);
        // Get payment success rate
        const successResult = await db_1.default.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed')::float / 
        NULLIF(COUNT(*), 0) * 100 as success_rate
      FROM payments
      WHERE 1=1 ${whereClause}
    `, params);
        const metrics = {
            totalRevenue: parseFloat(totalResult.rows[0]?.total || 0),
            monthlyRecurringRevenue: parseFloat(mrrResult.rows[0]?.mrr || 0),
            averageRevenuePerUser: parseFloat(arpuResult.rows[0]?.arpu || 0),
            revenueByMonth: monthlyResult.rows.map(r => ({
                date: r.month.toISOString().split('T')[0],
                count: parseFloat(r.amount)
            })),
            revenueByPlan: planResult.rows.map(r => ({
                plan: r.plan,
                revenue: parseFloat(r.revenue),
                businesses: parseInt(r.businesses, 10)
            })),
            paymentSuccessRate: parseFloat(successResult.rows[0]?.success_rate || 100)
        };
        this.setCache(cacheKey, metrics);
        return metrics;
    }
    // ========================================================================
    // CONVERSATION METRICS
    // ========================================================================
    async getConversationMetrics(businessId, dateRange) {
        const cacheKey = this.getCacheKey('conversations', { businessId, dateRange });
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        let whereClause = '';
        const params = [];
        if (businessId) {
            whereClause = 'WHERE business_id = $1';
            params.push(businessId);
        }
        const dateFilter = this.buildDateFilter(dateRange, 'created_at');
        // Get basic conversation stats
        const basicResult = await db_1.default.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) FILTER (WHERE escalation_reason IS NOT NULL) as escalated,
        AVG(EXTRACT(EPOCH FROM (closed_at - started_at))) as avg_duration,
        AVG(message_count) as avg_messages
      FROM conversations
      ${whereClause} ${dateFilter.sql.replace('c.created_at', 'created_at')}
    `, [...params, ...dateFilter.params]);
        // Get total messages
        let messageQuery = `
      SELECT COUNT(*) as total FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE 1=1 ${dateFilter.sql}
    `;
        const messageParams = [...dateFilter.params];
        if (businessId) {
            messageQuery += ' AND c.business_id = $' + (messageParams.length + 1);
            messageParams.push(businessId);
        }
        const messagesResult = await db_1.default.query(messageQuery, messageParams);
        // Get conversations by hour
        const hourResult = await db_1.default.query(`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as count
      FROM conversations
      ${whereClause}
      AND started_at >= NOW() - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM started_at)
      ORDER BY hour
    `, params);
        // Get conversations by day of week
        const dayResult = await db_1.default.query(`
      SELECT 
        TO_CHAR(started_at, 'Day') as day,
        COUNT(*) as count
      FROM conversations
      ${whereClause}
      AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY TO_CHAR(started_at, 'Day'), EXTRACT(DOW FROM started_at)
      ORDER BY EXTRACT(DOW FROM started_at)
    `, params);
        // Get top topics from messages content
        const topicResult = await db_1.default.query(`
      SELECT 
        CASE 
          WHEN content ILIKE '%price%' OR content ILIKE '%cost%' THEN 'Pricing'
          WHEN content ILIKE '%order%' OR content ILIKE '%buy%' THEN 'Ordering'
          WHEN content ILIKE '%delivery%' OR content ILIKE '%shipping%' THEN 'Delivery'
          WHEN content ILIKE '%return%' OR content ILIKE '%refund%' THEN 'Returns'
          WHEN content ILIKE '%product%' OR content ILIKE '%item%' THEN 'Products'
          WHEN content ILIKE '%appointment%' OR content ILIKE '%book%' THEN 'Appointments'
          WHEN content ILIKE '%support%' OR content ILIKE '%help%' THEN 'Support'
          ELSE 'General'
        END as topic,
        COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.role = 'user' ${businessId ? 'AND c.business_id = $1' : ''}
      AND m.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 5
    `, businessId ? [businessId] : []);
        const metrics = {
            totalConversations: parseInt(basicResult.rows[0]?.total || 0, 10),
            totalMessages: parseInt(messagesResult.rows[0]?.total || 0, 10),
            openConversations: parseInt(basicResult.rows[0]?.open || 0, 10),
            closedConversations: parseInt(basicResult.rows[0]?.closed || 0, 10),
            escalatedConversations: parseInt(basicResult.rows[0]?.escalated || 0, 10),
            avgConversationDuration: parseFloat(basicResult.rows[0]?.avg_duration || 0),
            avgMessagesPerConversation: parseFloat(basicResult.rows[0]?.avg_messages || 0),
            conversationsByHour: hourResult.rows.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count, 10) })),
            conversationsByDay: dayResult.rows.map(r => ({ day: r.day.trim(), count: parseInt(r.count, 10) })),
            topTopics: topicResult.rows.map(r => ({ topic: r.topic, count: parseInt(r.count, 10) }))
        };
        this.setCache(cacheKey, metrics);
        return metrics;
    }
    // ========================================================================
    // EXPORT FUNCTIONALITY
    // ========================================================================
    async exportData(type, format, businessId, dateRange) {
        const dateFilter = this.buildDateFilter(dateRange, 'created_at');
        let query;
        let params = [];
        switch (type) {
            case 'conversations':
                query = `
          SELECT 
            c.id,
            c.customer_name,
            c.customer_phone,
            c.status,
            c.started_at,
            c.closed_at,
            ae.display_name as employee_name,
            c.message_count
          FROM conversations c
          LEFT JOIN ai_employees ae ON c.employee_id = ae.id
          WHERE 1=1 ${businessId ? 'AND c.business_id = $1' : ''}
          ${dateFilter.sql.replace('c.created_at', 'c.started_at')}
          ORDER BY c.started_at DESC
        `;
                if (businessId)
                    params.push(businessId);
                break;
            case 'messages':
                query = `
          SELECT 
            m.id,
            m.conversation_id,
            m.role,
            m.content,
            m.created_at,
            c.customer_phone
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE 1=1 ${businessId ? 'AND c.business_id = $1' : ''}
          ${dateFilter.sql.replace('c.created_at', 'm.created_at')}
          ORDER BY m.created_at DESC
          LIMIT 10000
        `;
                if (businessId)
                    params.push(businessId);
                break;
            case 'orders':
                query = `
          SELECT 
            o.id,
            o.customer_phone,
            o.items,
            o.total_amount,
            o.status,
            o.payment_status,
            o.created_at
          FROM orders o
          WHERE 1=1 ${businessId ? 'AND o.business_id = $1' : ''}
          ${dateFilter.sql.replace('c.created_at', 'o.created_at')}
          ORDER BY o.created_at DESC
        `;
                if (businessId)
                    params.push(businessId);
                break;
            case 'revenue':
                query = `
          SELECT 
            p.id,
            p.amount,
            p.currency,
            p.status,
            p.payment_method,
            p.created_at,
            b.business_name
          FROM payments p
          JOIN businesses b ON p.business_id = b.id
          WHERE p.status = 'completed' ${businessId ? 'AND p.business_id = $1' : ''}
          ${dateFilter.sql.replace('c.created_at', 'p.created_at')}
          ORDER BY p.created_at DESC
        `;
                if (businessId)
                    params.push(businessId);
                break;
            case 'employees':
                query = `
          SELECT 
            ae.id,
            ae.display_name,
            ae.employee_role,
            COUNT(DISTINCT c.id) as conversations,
            COUNT(m.id) as messages,
            ae.price_monthly
          FROM ai_employees ae
          LEFT JOIN conversations c ON ae.id = c.employee_id
          LEFT JOIN messages m ON c.id = m.conversation_id AND m.role = 'assistant'
          WHERE ae.is_active = true
          GROUP BY ae.id, ae.display_name, ae.employee_role, ae.price_monthly
          ORDER BY conversations DESC
        `;
                break;
            default:
                throw new Error('Unknown export type');
        }
        const result = await db_1.default.query(query, [...params, ...dateFilter.params]);
        if (format === 'json') {
            return JSON.stringify(result.rows, null, 2);
        }
        // Convert to CSV
        if (result.rows.length === 0) {
            return '';
        }
        const headers = Object.keys(result.rows[0]);
        const csvRows = [
            headers.join(','),
            ...result.rows.map(row => headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined)
                    return '';
                if (typeof value === 'object')
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                const str = String(value);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(','))
        ];
        return csvRows.join('\n');
    }
    // ========================================================================
    // UTILITY METHODS
    // ========================================================================
    buildDateFilter(dateRange, dateColumn = 'created_at') {
        const conditions = [];
        const params = [];
        if (dateRange?.startDate) {
            conditions.push(`AND ${dateColumn} >= $${params.length + 1}`);
            params.push(dateRange.startDate);
        }
        if (dateRange?.endDate) {
            conditions.push(`AND ${dateColumn} <= $${params.length + 1}`);
            params.push(dateRange.endDate);
        }
        return { sql: conditions.join(' '), params };
    }
    getDaysFromRange(dateRange, defaultDays = 30) {
        if (!dateRange?.startDate)
            return defaultDays;
        const start = new Date(dateRange.startDate);
        const end = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    fillDateGaps(data, days) {
        const result = [];
        const endDate = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(endDate.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const existing = data.find(d => d.date === dateStr);
            result.push({
                date: dateStr,
                count: existing ? existing.count : 0
            });
        }
        return result;
    }
    formatDuration(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        }
        else if (seconds < 3600) {
            return `${Math.round(seconds / 60)}m`;
        }
        else {
            return `${Math.round(seconds / 3600)}h`;
        }
    }
    // ========================================================================
    // CACHE MANAGEMENT
    // ========================================================================
    clearCache() {
        this.cache.clear();
    }
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
exports.AnalyticsService = AnalyticsService;
// Export singleton instance
exports.analyticsService = new AnalyticsService();
exports.default = exports.analyticsService;
//# sourceMappingURL=AnalyticsService.js.map