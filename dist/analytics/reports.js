"use strict";
/**
 * Analytics Reports Module
 *
 * Generates comprehensive reports for businesses and platform analytics:
 * - Daily summary reports
 * - Weekly business reports
 * - Monthly platform reports
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportGenerator = exports.ReportGenerator = void 0;
const db_1 = __importDefault(require("../db"));
const AnalyticsService_1 = __importDefault(require("./AnalyticsService"));
// ============================================================================
// REPORT GENERATORS
// ============================================================================
class ReportGenerator {
    constructor(analytics = AnalyticsService_1.default) {
        this.analytics = analytics;
    }
    // ========================================================================
    // DAILY REPORT
    // ========================================================================
    async generateDailyReport(businessId, date) {
        const reportDate = date || new Date();
        const dateStr = reportDate.toISOString().split('T')[0];
        const startOfDay = new Date(reportDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(reportDate);
        endOfDay.setHours(23, 59, 59, 999);
        const dateRange = { startDate: startOfDay, endDate: endOfDay };
        // Build WHERE clause
        let whereClause = 'WHERE c.started_at >= $1 AND c.started_at <= $2';
        const params = [startOfDay, endOfDay];
        if (businessId) {
            whereClause += ' AND c.business_id = $3';
            params.push(businessId);
        }
        // Get summary metrics
        const summaryResult = await db_1.default.query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(*) FILTER (WHERE c.status = 'closed') as closed_conversations,
        SUM(c.message_count) as total_messages,
        AVG(EXTRACT(EPOCH FROM (c.closed_at - c.started_at))) as avg_duration
      FROM conversations c
      ${whereClause}
    `, params);
        // Get previous day for comparison (new conversations)
        const prevDayStart = new Date(startOfDay);
        prevDayStart.setDate(prevDayStart.getDate() - 1);
        const prevDayEnd = new Date(endOfDay);
        prevDayEnd.setDate(prevDayEnd.getDate() - 1);
        const prevDayResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM conversations
      WHERE started_at >= $1 AND started_at <= $2 ${businessId ? 'AND business_id = $3' : ''}
    `, businessId ? [prevDayStart, prevDayEnd, businessId] : [prevDayStart, prevDayEnd]);
        // Get revenue for the day
        const revenueResult = await db_1.default.query(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2 ${businessId ? 'AND business_id = $3' : ''}
    `, businessId ? [startOfDay, endOfDay, businessId] : [startOfDay, endOfDay]);
        // Get conversation details
        const conversationsResult = await db_1.default.query(`
      SELECT 
        c.id,
        c.customer_name,
        c.status,
        c.message_count,
        c.started_at,
        c.closed_at,
        ae.display_name as employee_name
      FROM conversations c
      LEFT JOIN ai_employees ae ON c.employee_id = ae.id
      ${whereClause}
      ORDER BY c.started_at DESC
      LIMIT 50
    `, params);
        // Get top products
        const topProductsResult = await db_1.default.query(`
      SELECT 
        p.name,
        COUNT(*) as inquiries
      FROM action_logs al
      JOIN products p ON al.params->>'product_id' = p.id::text
      WHERE al.action_name = 'check_inventory'
        AND al.executed_at >= $1 AND al.executed_at <= $2
        ${businessId ? 'AND al.business_id = $3' : ''}
      GROUP BY p.name
      ORDER BY inquiries DESC
      LIMIT 5
    `, businessId ? [startOfDay, endOfDay, businessId] : [startOfDay, endOfDay]);
        // Get employee activity
        const employeeActivityResult = await db_1.default.query(`
      SELECT 
        ae.display_name as employee_name,
        COUNT(DISTINCT c.id) as conversations,
        COUNT(m.id) as messages,
        COUNT(al.id) as actions
      FROM ai_employees ae
      LEFT JOIN conversations c ON ae.id = c.employee_id 
        AND c.started_at >= $1 AND c.started_at <= $2
        ${businessId ? 'AND c.business_id = $3' : ''}
      LEFT JOIN messages m ON c.id = m.conversation_id AND m.role = 'assistant'
      LEFT JOIN action_logs al ON al.executed_by = ae.name
        AND al.executed_at >= $1 AND al.executed_at <= $2
        ${businessId ? 'AND al.business_id = $3' : ''}
      WHERE ae.is_active = true
      GROUP BY ae.id, ae.display_name
      ORDER BY conversations DESC
    `, businessId ? [startOfDay, endOfDay, businessId] : [startOfDay, endOfDay]);
        // Get hourly breakdown
        const hourlyResult = await db_1.default.query(`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as conversations,
        SUM(message_count) as messages
      FROM conversations
      WHERE started_at >= $1 AND started_at <= $2
      ${businessId ? 'AND business_id = $3' : ''}
      GROUP BY EXTRACT(HOUR FROM started_at)
      ORDER BY hour
    `, businessId ? [startOfDay, endOfDay, businessId] : [startOfDay, endOfDay]);
        const summary = summaryResult.rows[0];
        const prevDayCount = parseInt(prevDayResult.rows[0]?.count || 0, 10);
        const currentDayCount = parseInt(summary?.total_conversations || 0, 10);
        return {
            date: dateStr,
            businessId,
            summary: {
                totalConversations: currentDayCount,
                newConversations: Math.max(0, currentDayCount - prevDayCount),
                closedConversations: parseInt(summary?.closed_conversations || 0, 10),
                totalMessages: parseInt(summary?.total_messages || 0, 10),
                avgResponseTime: this.formatDuration(parseFloat(summary?.avg_duration || 0)),
                revenue: parseFloat(revenueResult.rows[0]?.revenue || 0),
                ordersPlaced: parseInt(revenueResult.rows[0]?.orders || 0, 10)
            },
            conversations: conversationsResult.rows.map(r => ({
                id: r.id,
                customerName: r.customer_name,
                status: r.status,
                messageCount: r.message_count,
                duration: this.formatDuration(r.closed_at ?
                    new Date(r.closed_at).getTime() - new Date(r.started_at).getTime() : 0),
                employeeName: r.employee_name
            })),
            topProducts: topProductsResult.rows.map(r => ({
                name: r.name,
                inquiries: parseInt(r.inquiries, 10)
            })),
            employeeActivity: employeeActivityResult.rows.map(r => ({
                employeeName: r.employee_name,
                conversations: parseInt(r.conversations, 10),
                messages: parseInt(r.messages, 10),
                actions: parseInt(r.actions, 10)
            })),
            hourlyBreakdown: hourlyResult.rows.map(r => ({
                hour: parseInt(r.hour),
                conversations: parseInt(r.conversations, 10),
                messages: parseInt(r.messages, 10)
            }))
        };
    }
    // ========================================================================
    // WEEKLY REPORT
    // ========================================================================
    async generateWeeklyReport(businessId, date) {
        const endDate = date || new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        const weekStarting = startDate.toISOString().split('T')[0];
        const weekEnding = endDate.toISOString().split('T')[0];
        const dateRange = { startDate, endDate };
        // Get metrics from analytics service
        const metrics = businessId
            ? await this.analytics.getBusinessMetrics(businessId, dateRange)
            : await this.analytics.getPlatformMetrics(dateRange);
        // Get revenue metrics
        const revenueMetrics = await this.analytics.getRevenueMetrics(businessId, dateRange);
        // Get conversation metrics
        const conversationMetrics = await this.analytics.getConversationMetrics(businessId, dateRange);
        // Get new customers
        const newCustomersResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM customers
      WHERE created_at >= $1 AND created_at <= $2
      ${businessId ? 'AND business_id = $3' : ''}
    `, businessId ? [startDate, endDate, businessId] : [startDate, endDate]);
        // Get employee performance for top performers
        const employeeResult = await this.analytics.getAllEmployeesMetrics(businessId, dateRange);
        const topEmployees = employeeResult
            .sort((a, b) => b.conversationsHandled - a.conversationsHandled)
            .slice(0, 5)
            .map(e => ({
            name: e.displayName,
            conversations: e.conversationsHandled,
            conversionRate: Math.round(e.actionsSuccessRate),
            satisfaction: e.customerSatisfaction
        }));
        // Get top products by revenue
        const topProductsResult = await db_1.default.query(`
      SELECT 
        p.name,
        COUNT(*) as orders,
        SUM((o.items->>'total_price')::float) as revenue
      FROM orders o
      JOIN products p ON o.items @> jsonb_build_array(jsonb_build_object('product_id', p.id))
      WHERE o.created_at >= $1 AND o.created_at <= $2
      ${businessId ? 'AND o.business_id = $3' : ''}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 5
    `, businessId ? [startDate, endDate, businessId] : [startDate, endDate]);
        // Generate trends
        const trends = {
            conversations: await this.getDailyTrend('conversations', 'started_at', startDate, endDate, businessId),
            messages: await this.getDailyTrend('messages', 'created_at', startDate, endDate, businessId),
            revenue: await this.getDailyTrend('orders', 'created_at', startDate, endDate, businessId, 'total_amount')
        };
        // Generate insights
        const insights = this.generateInsights(metrics, conversationMetrics, revenueMetrics);
        // Generate recommendations
        const recommendations = this.generateRecommendations(metrics, conversationMetrics);
        return {
            weekStarting,
            weekEnding,
            businessId,
            summary: {
                totalConversations: conversationMetrics.totalConversations,
                totalMessages: conversationMetrics.totalMessages,
                avgMessagesPerConversation: conversationMetrics.avgMessagesPerConversation,
                conversionRate: 'conversionRate' in metrics ? metrics.conversionRate : 0,
                totalRevenue: revenueMetrics.totalRevenue,
                newCustomers: parseInt(newCustomersResult.rows[0]?.count || 0, 10),
                customerSatisfaction: 'customerSatisfaction' in metrics ? metrics.customerSatisfaction : 4.5
            },
            trends,
            topPerformers: {
                employees: topEmployees,
                products: topProductsResult.rows.map(r => ({
                    name: r.name,
                    orders: parseInt(r.orders, 10),
                    revenue: parseFloat(r.revenue || 0)
                }))
            },
            insights,
            recommendations
        };
    }
    // ========================================================================
    // MONTHLY PLATFORM REPORT
    // ========================================================================
    async generateMonthlyPlatformReport(year, month) {
        const now = new Date();
        const reportYear = year || now.getFullYear();
        const reportMonth = month || now.getMonth() + 1;
        const startDate = new Date(reportYear, reportMonth - 1, 1);
        const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);
        const dateRange = { startDate, endDate };
        // Get platform metrics
        const platformMetrics = await this.analytics.getPlatformMetrics(dateRange);
        // Get revenue metrics
        const revenueMetrics = await this.analytics.getRevenueMetrics(undefined, dateRange);
        // Get business growth
        const newBusinessesResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM businesses
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);
        const churnedBusinessesResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM businesses
      WHERE is_active = false 
        AND updated_at >= $1 AND updated_at <= $2
        AND created_at < $1
    `, [startDate, endDate]);
        const totalBusinessesResult = await db_1.default.query(`
      SELECT COUNT(*) as count FROM businesses WHERE created_at < $1
    `, [startDate]);
        const newBusinesses = parseInt(newBusinessesResult.rows[0].count, 10);
        const churnedBusinesses = parseInt(churnedBusinessesResult.rows[0].count, 10);
        const totalPrevBusinesses = parseInt(totalBusinessesResult.rows[0].count, 10);
        // Get top businesses
        const topBusinessesResult = await db_1.default.query(`
      SELECT 
        b.business_name as name,
        COUNT(DISTINCT c.id) as conversations,
        COALESCE(SUM(o.total_amount), 0) as revenue,
        AVG(f.rating) as satisfaction
      FROM businesses b
      LEFT JOIN conversations c ON b.id = c.business_id 
        AND c.started_at >= $1 AND c.started_at <= $2
      LEFT JOIN orders o ON b.id = o.business_id 
        AND o.created_at >= $1 AND o.created_at <= $2
      LEFT JOIN feedback f ON b.id = f.business_id 
        AND f.created_at >= $1 AND f.created_at <= $2
      GROUP BY b.id, b.business_name
      ORDER BY revenue DESC
      LIMIT 10
    `, [startDate, endDate]);
        // Get feature usage with growth
        const featureUsageResult = await db_1.default.query(`
      SELECT 
        action_name as feature,
        COUNT(*) as usage_count,
        COUNT(*) FILTER (WHERE executed_at >= $1) as current_month,
        COUNT(*) FILTER (WHERE executed_at >= $2 AND executed_at < $1) as prev_month
      FROM action_logs
      WHERE executed_at >= $2
      GROUP BY action_name
      ORDER BY usage_count DESC
    `, [startDate, new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000)]);
        // Get employee performance across platform
        const employeePerformanceResult = await db_1.default.query(`
      SELECT 
        ae.employee_role as employee_type,
        COUNT(DISTINCT c.id) as total_conversations,
        AVG(EXTRACT(EPOCH FROM (c.closed_at - c.started_at))) as avg_handling_time,
        AVG(f.rating) as satisfaction
      FROM ai_employees ae
      LEFT JOIN conversations c ON ae.id = c.employee_id 
        AND c.started_at >= $1 AND c.started_at <= $2
      LEFT JOIN feedback f ON c.id = f.conversation_id
      WHERE ae.is_active = true
      GROUP BY ae.employee_role
    `, [startDate, endDate]);
        // Find peak usage day
        const peakDayResult = await db_1.default.query(`
      SELECT DATE(started_at) as day, COUNT(*) as count
      FROM conversations
      WHERE started_at >= $1 AND started_at <= $2
      GROUP BY DATE(started_at)
      ORDER BY count DESC
      LIMIT 1
    `, [startDate, endDate]);
        return {
            month: startDate.toLocaleString('default', { month: 'long' }),
            year: reportYear,
            platformMetrics,
            businessGrowth: {
                newBusinesses,
                churnedBusinesses,
                growthRate: totalPrevBusinesses > 0
                    ? ((newBusinesses - churnedBusinesses) / totalPrevBusinesses) * 100
                    : 0
            },
            revenue: {
                totalRevenue: revenueMetrics.totalRevenue,
                mrr: revenueMetrics.monthlyRecurringRevenue,
                arr: revenueMetrics.monthlyRecurringRevenue * 12,
                revenuePerBusiness: platformMetrics.activeBusinesses > 0
                    ? revenueMetrics.totalRevenue / platformMetrics.activeBusinesses
                    : 0
            },
            usage: {
                totalConversations: platformMetrics.totalConversations,
                totalMessages: platformMetrics.totalMessages,
                avgConversationsPerBusiness: platformMetrics.activeBusinesses > 0
                    ? platformMetrics.totalConversations / platformMetrics.activeBusinesses
                    : 0,
                peakUsageDay: peakDayResult.rows[0]?.day?.toISOString().split('T')[0] || 'N/A'
            },
            topBusinesses: topBusinessesResult.rows.map(r => ({
                name: r.name,
                conversations: parseInt(r.conversations, 10),
                revenue: parseFloat(r.revenue),
                satisfaction: parseFloat(r.satisfaction) || 4.5
            })),
            featureUsage: featureUsageResult.rows.map(r => {
                const current = parseInt(r.current_month, 10);
                const prev = parseInt(r.prev_month, 10);
                return {
                    feature: r.feature,
                    usageCount: parseInt(r.usage_count, 10),
                    growthRate: prev > 0 ? ((current - prev) / prev) * 100 : 100
                };
            }),
            employeePerformance: employeePerformanceResult.rows.map(r => ({
                employeeType: r.employee_type,
                totalConversations: parseInt(r.total_conversations, 10),
                avgHandlingTime: parseFloat(r.avg_handling_time) || 0,
                satisfaction: parseFloat(r.satisfaction) || 4.5
            }))
        };
    }
    // ========================================================================
    // BUSINESS HEALTH SCORE
    // ========================================================================
    async generateBusinessHealthScore(businessId) {
        const metrics = await this.analytics.getBusinessMetrics(businessId);
        // Calculate category scores (0-100)
        const engagementScore = Math.min(100, (metrics.totalConversations / 50) * 100);
        const responseTimeScore = metrics.avgResponseTime < 60 ? 100 :
            metrics.avgResponseTime < 300 ? 80 :
                metrics.avgResponseTime < 600 ? 60 : 40;
        const conversionScore = Math.min(100, metrics.conversionRate * 10);
        const satisfactionScore = (metrics.customerSatisfaction / 5) * 100;
        // Calculate growth trend
        const trendScore = metrics.trends.conversations.length > 1 ?
            (metrics.trends.conversations[metrics.trends.conversations.length - 1].count >
                metrics.trends.conversations[0].count ? 70 : 50) : 50;
        const overallScore = Math.round((engagementScore * 0.25) +
            (responseTimeScore * 0.25) +
            (conversionScore * 0.20) +
            (satisfactionScore * 0.20) +
            (trendScore * 0.10));
        // Determine status
        let status = 'healthy';
        if (overallScore < 50)
            status = 'critical';
        else if (overallScore < 75)
            status = 'needs_attention';
        // Generate recommendations
        const recommendations = [];
        if (engagementScore < 50) {
            recommendations.push('Consider promoting your WhatsApp channel to increase customer engagement');
        }
        if (responseTimeScore < 60) {
            recommendations.push('Response times are slow. Consider hiring more AI employees or optimizing agent configurations');
        }
        if (conversionScore < 50) {
            recommendations.push('Low conversion rate. Review your sales scripts and product recommendations');
        }
        if (satisfactionScore < 70) {
            recommendations.push('Customer satisfaction needs improvement. Review common complaints and agent responses');
        }
        return {
            businessId,
            businessName: metrics.businessName,
            overallScore,
            categories: {
                engagement: Math.round(engagementScore),
                responseTime: Math.round(responseTimeScore),
                conversion: Math.round(conversionScore),
                satisfaction: Math.round(satisfactionScore),
                growth: Math.round(trendScore)
            },
            status,
            recommendations
        };
    }
    // ========================================================================
    // UTILITY METHODS
    // ========================================================================
    async getDailyTrend(table, dateColumn, startDate, endDate, businessId, sumColumn) {
        const selectClause = sumColumn
            ? `COALESCE(SUM(${sumColumn}), 0) as count`
            : 'COUNT(*) as count';
        let query = `
      SELECT DATE(${dateColumn}) as date, ${selectClause}
      FROM ${table}
      WHERE ${dateColumn} >= $1 AND ${dateColumn} <= $2
      ${businessId && table !== 'orders' ? `AND business_id = $3` : ''}
      ${businessId && table === 'orders' ? `AND business_id = $3` : ''}
      GROUP BY DATE(${dateColumn})
      ORDER BY date
    `;
        const params = [startDate, endDate];
        if (businessId)
            params.push(businessId);
        const result = await db_1.default.query(query, params);
        // Fill in gaps
        const data = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            const existing = result.rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
            data.push({
                date: dateStr,
                count: existing ? parseFloat(existing.count) : 0
            });
            current.setDate(current.getDate() + 1);
        }
        return data;
    }
    generateInsights(metrics, conversationMetrics, revenueMetrics) {
        const insights = [];
        if ('totalConversations' in metrics && metrics.totalConversations > 0) {
            const avgMessages = conversationMetrics.avgMessagesPerConversation;
            if (avgMessages < 3) {
                insights.push('Conversations are very short. Consider improving engagement with follow-up questions.');
            }
            else if (avgMessages > 10) {
                insights.push('High message count per conversation indicates deep customer engagement.');
            }
        }
        // Add insight about total messages if available
        if (conversationMetrics.totalMessages !== undefined) {
            insights.push(`Total messages exchanged: ${conversationMetrics.totalMessages}`);
        }
        if ('conversionRate' in metrics && metrics.conversionRate < 5) {
            insights.push('Conversion rate is below industry average. Review your checkout process.');
        }
        if (conversationMetrics.escalatedConversations > conversationMetrics.totalConversations * 0.1) {
            insights.push('High escalation rate detected. Consider training AI employees on common issues.');
        }
        if (revenueMetrics.totalRevenue > 0) {
            insights.push(`Revenue for period: $${revenueMetrics.totalRevenue.toFixed(2)}`);
        }
        return insights;
    }
    generateRecommendations(metrics, conversationMetrics) {
        const recommendations = [];
        if (conversationMetrics.conversationsByHour.length > 0) {
            const peakHour = conversationMetrics.conversationsByHour
                .sort((a, b) => b.count - a.count)[0];
            recommendations.push(`Peak activity is at ${peakHour.hour}:00. Consider having more agents available during this time.`);
        }
        if ('topProducts' in metrics && metrics.topProducts.length === 0) {
            recommendations.push('No product inquiries detected. Make sure products are properly catalogued.');
        }
        if ('customerSatisfaction' in metrics && metrics.customerSatisfaction < 4) {
            recommendations.push('Customer satisfaction is below target. Review recent negative feedback.');
        }
        recommendations.push('Schedule weekly team reviews to identify improvement opportunities.');
        return recommendations;
    }
    formatDuration(seconds) {
        if (!seconds || seconds < 0)
            return '0s';
        if (seconds < 60)
            return `${Math.round(seconds)}s`;
        if (seconds < 3600)
            return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    }
}
exports.ReportGenerator = ReportGenerator;
// Export singleton instance
exports.reportGenerator = new ReportGenerator();
exports.default = exports.reportGenerator;
//# sourceMappingURL=reports.js.map