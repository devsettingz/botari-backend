"use strict";
/**
 * Analytics Routes
 *
 * Provides comprehensive analytics endpoints:
 * - GET /analytics/overview - Platform overview
 * - GET /analytics/businesses - Business growth metrics
 * - GET /analytics/conversations - Conversation trends
 * - GET /analytics/employees/:id - Single employee stats
 * - GET /analytics/export - Export data as CSV/JSON
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const requireRole_1 = require("../middleware/requireRole");
const AnalyticsService_1 = __importDefault(require("../analytics/AnalyticsService"));
const reports_1 = __importDefault(require("../analytics/reports"));
const router = (0, express_1.Router)();
// ============================================================================
// MIDDLEWARE
// ============================================================================
// Helper to parse date range from query params
const parseDateRange = (req) => {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    return { startDate, endDate };
};
// ============================================================================
// PLATFORM OVERVIEW (Admin Only)
// ============================================================================
/**
 * GET /analytics/overview
 *
 * Returns platform-wide analytics overview for admin dashboard.
 * Includes total businesses, conversations, revenue, and trends.
 *
 * Query params:
 * - startDate: Start date for filtering (optional)
 * - endDate: End date for filtering (optional)
 */
router.get('/overview', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    try {
        const dateRange = parseDateRange(req);
        const [overview, platformMetrics, revenueMetrics, conversationMetrics] = await Promise.all([
            AnalyticsService_1.default.getOverviewMetrics(),
            AnalyticsService_1.default.getPlatformMetrics(dateRange),
            AnalyticsService_1.default.getRevenueMetrics(undefined, dateRange),
            AnalyticsService_1.default.getConversationMetrics(undefined, dateRange)
        ]);
        res.json({
            success: true,
            data: {
                overview: {
                    totalConversations: overview.totalConversations,
                    totalMessages: overview.totalMessages,
                    avgResponseTime: overview.avgResponseTime,
                    activeBusinesses: overview.activeBusinesses,
                    totalRevenue: overview.totalRevenue,
                    conversionRate: overview.conversionRate
                },
                platform: platformMetrics,
                revenue: {
                    totalRevenue: revenueMetrics.totalRevenue,
                    monthlyRecurringRevenue: revenueMetrics.monthlyRecurringRevenue,
                    averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
                    paymentSuccessRate: revenueMetrics.paymentSuccessRate
                },
                conversations: {
                    total: conversationMetrics.totalConversations,
                    open: conversationMetrics.openConversations,
                    closed: conversationMetrics.closedConversations,
                    escalated: conversationMetrics.escalatedConversations,
                    avgDuration: conversationMetrics.avgConversationDuration,
                    avgMessagesPerConversation: conversationMetrics.avgMessagesPerConversation
                },
                trends: {
                    businessGrowth: platformMetrics.businessGrowth,
                    revenueGrowth: platformMetrics.revenueGrowth,
                    conversationVolume: platformMetrics.totalConversations
                }
            }
        });
    }
    catch (error) {
        console.error('Analytics overview error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics overview',
            message: error.message
        });
    }
});
// ============================================================================
// BUSINESS ANALYTICS
// ============================================================================
/**
 * GET /analytics/businesses
 *
 * Returns business growth metrics and statistics.
 * Admin gets all businesses, business users get their own data.
 *
 * Query params:
 * - startDate: Start date for filtering (optional)
 * - endDate: End date for filtering (optional)
 * - limit: Maximum number of businesses to return (default: 50)
 */
router.get('/businesses', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const dateRange = parseDateRange(req);
        const limit = parseInt(req.query.limit) || 50;
        // If business user, return only their data
        if (user.role !== 'owner' && user.role !== 'admin') {
            const businessId = user.business_id;
            if (!businessId) {
                return res.status(400).json({
                    success: false,
                    error: 'No business associated with user'
                });
            }
            const metrics = await AnalyticsService_1.default.getBusinessMetrics(businessId, dateRange);
            const healthScore = await reports_1.default.generateBusinessHealthScore(businessId);
            return res.json({
                success: true,
                data: {
                    businesses: [metrics],
                    healthScores: [healthScore]
                }
            });
        }
        // Admin gets aggregated data
        const platformMetrics = await AnalyticsService_1.default.getPlatformMetrics(dateRange);
        res.json({
            success: true,
            data: {
                summary: {
                    totalBusinesses: platformMetrics.totalBusinesses,
                    activeBusinesses: platformMetrics.activeBusinesses,
                    growthRate: platformMetrics.businessGrowth.length > 1
                        ? ((platformMetrics.businessGrowth[platformMetrics.businessGrowth.length - 1].count -
                            platformMetrics.businessGrowth[0].count) /
                            Math.max(1, platformMetrics.businessGrowth[0].count)) * 100
                        : 0,
                    churnRate: platformMetrics.churnRate
                },
                trends: {
                    businessGrowth: platformMetrics.businessGrowth.slice(-limit),
                    revenueByBusiness: platformMetrics.revenueGrowth.slice(-limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Business analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business analytics',
            message: error.message
        });
    }
});
/**
 * GET /analytics/businesses/:id
 *
 * Returns detailed analytics for a specific business.
 * Requires admin role or ownership of the business.
 */
router.get('/businesses/:id', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const businessId = parseInt(req.params.id);
        const dateRange = parseDateRange(req);
        // Check authorization
        if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: You can only view your own business analytics'
            });
        }
        const [metrics, healthScore] = await Promise.all([
            AnalyticsService_1.default.getBusinessMetrics(businessId, dateRange),
            reports_1.default.generateBusinessHealthScore(businessId)
        ]);
        res.json({
            success: true,
            data: {
                metrics,
                healthScore
            }
        });
    }
    catch (error) {
        console.error('Business detail analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business analytics',
            message: error.message
        });
    }
});
// ============================================================================
// CONVERSATION ANALYTICS
// ============================================================================
/**
 * GET /analytics/conversations
 *
 * Returns conversation trends and metrics.
 *
 * Query params:
 * - startDate: Start date for filtering (optional)
 * - endDate: End date for filtering (optional)
 * - businessId: Filter by specific business (admin only)
 */
router.get('/conversations', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const dateRange = parseDateRange(req);
        // Determine business scope
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
            if (!businessId) {
                return res.status(400).json({
                    success: false,
                    error: 'No business associated with user'
                });
            }
        }
        else if (req.query.businessId) {
            const businessIdParam = Array.isArray(req.query.businessId)
                ? req.query.businessId[0]
                : req.query.businessId;
            businessId = parseInt(businessIdParam);
        }
        const metrics = await AnalyticsService_1.default.getConversationMetrics(businessId, dateRange);
        res.json({
            success: true,
            data: {
                summary: {
                    totalConversations: metrics.totalConversations,
                    openConversations: metrics.openConversations,
                    closedConversations: metrics.closedConversations,
                    escalatedConversations: metrics.escalatedConversations,
                    avgDuration: metrics.avgConversationDuration,
                    avgMessagesPerConversation: metrics.avgMessagesPerConversation
                },
                breakdown: {
                    byHour: metrics.conversationsByHour,
                    byDay: metrics.conversationsByDay
                },
                topTopics: metrics.topTopics
            }
        });
    }
    catch (error) {
        console.error('Conversation analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversation analytics',
            message: error.message
        });
    }
});
/**
 * GET /analytics/conversations/trends
 *
 * Returns time-series data for conversation trends.
 *
 * Query params:
 * - days: Number of days to include (default: 30)
 * - businessId: Filter by specific business (admin only)
 */
router.get('/conversations/trends', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const days = parseInt(req.query.days) || 30;
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
        }
        else if (req.query.businessId) {
            businessId = parseInt(req.query.businessId);
        }
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const dateRange = { startDate, endDate };
        const metrics = await AnalyticsService_1.default.getConversationMetrics(businessId, dateRange);
        res.json({
            success: true,
            data: {
                period: { startDate, endDate },
                trends: {
                    byHour: metrics.conversationsByHour,
                    byDay: metrics.conversationsByDay
                }
            }
        });
    }
    catch (error) {
        console.error('Conversation trends error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversation trends',
            message: error.message
        });
    }
});
// ============================================================================
// EMPLOYEE ANALYTICS
// ============================================================================
/**
 * GET /analytics/employees
 *
 * Returns analytics for all employees.
 * Business users see their hired employees, admin sees all.
 */
router.get('/employees', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const dateRange = parseDateRange(req);
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
        }
        else if (req.query.businessId) {
            businessId = parseInt(req.query.businessId);
        }
        const metrics = await AnalyticsService_1.default.getAllEmployeesMetrics(businessId, dateRange);
        res.json({
            success: true,
            data: {
                employees: metrics,
                summary: {
                    totalEmployees: metrics.length,
                    totalConversations: metrics.reduce((sum, m) => sum + m.conversationsHandled, 0),
                    totalMessages: metrics.reduce((sum, m) => sum + m.messagesHandled, 0),
                    avgSuccessRate: metrics.length > 0
                        ? metrics.reduce((sum, m) => sum + m.actionsSuccessRate, 0) / metrics.length
                        : 0
                }
            }
        });
    }
    catch (error) {
        console.error('Employees analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch employee analytics',
            message: error.message
        });
    }
});
/**
 * GET /analytics/employees/:id
 *
 * Returns detailed analytics for a specific employee.
 *
 * Query params:
 * - startDate: Start date for filtering (optional)
 * - endDate: End date for filtering (optional)
 * - businessId: Filter by specific business (optional)
 */
router.get('/employees/:id', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const employeeId = parseInt(req.params.id);
        const dateRange = parseDateRange(req);
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
        }
        else if (req.query.businessId) {
            const businessIdParam = Array.isArray(req.query.businessId)
                ? req.query.businessId[0]
                : req.query.businessId;
            businessId = parseInt(businessIdParam);
        }
        const metrics = await AnalyticsService_1.default.getEmployeeMetrics(employeeId, businessId, dateRange);
        res.json({
            success: true,
            data: {
                employee: {
                    id: metrics.employeeId,
                    name: metrics.displayName,
                    role: metrics.employeeRole
                },
                metrics: {
                    conversationsHandled: metrics.conversationsHandled,
                    messagesHandled: metrics.messagesHandled,
                    actionsExecuted: metrics.actionsExecuted,
                    actionsSuccessRate: metrics.actionsSuccessRate,
                    avgHandlingTime: metrics.avgHandlingTime,
                    escalationRate: metrics.escalationRate,
                    revenueGenerated: metrics.revenueGenerated,
                    customerSatisfaction: metrics.customerSatisfaction
                },
                trend: metrics.trend
            }
        });
    }
    catch (error) {
        console.error('Employee detail analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch employee analytics',
            message: error.message
        });
    }
});
// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================
/**
 * GET /analytics/export
 *
 * Exports analytics data in CSV or JSON format.
 *
 * Query params:
 * - type: Data type to export (conversations, messages, orders, employees, revenue)
 * - format: Export format (csv, json)
 * - startDate: Start date for filtering (optional)
 * - endDate: End date for filtering (optional)
 * - businessId: Filter by specific business (admin only)
 */
router.get('/export', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const type = req.query.type || 'conversations';
        const format = req.query.format || 'csv';
        const dateRange = parseDateRange(req);
        // Validate type
        const validTypes = ['conversations', 'messages', 'orders', 'employees', 'revenue'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
            });
        }
        // Validate format
        if (!['csv', 'json'].includes(format)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid format. Must be csv or json'
            });
        }
        // Determine business scope
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
            if (!businessId) {
                return res.status(400).json({
                    success: false,
                    error: 'No business associated with user'
                });
            }
        }
        else if (req.query.businessId) {
            businessId = parseInt(req.query.businessId);
        }
        // Generate export data
        const data = await AnalyticsService_1.default.exportData(type, format, businessId, dateRange);
        // Set appropriate headers
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `botari-${type}-${timestamp}.${format}`;
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
    }
    catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export data',
            message: error.message
        });
    }
});
// ============================================================================
// REPORTS
// ============================================================================
/**
 * GET /analytics/reports/daily
 *
 * Generates a daily report.
 *
 * Query params:
 * - date: Report date (default: today)
 * - businessId: Filter by specific business (admin only)
 */
router.get('/reports/daily', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const date = req.query.date ? new Date(req.query.date) : new Date();
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
        }
        else if (req.query.businessId) {
            businessId = parseInt(req.query.businessId);
        }
        const report = await reports_1.default.generateDailyReport(businessId, date);
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        console.error('Daily report error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate daily report',
            message: error.message
        });
    }
});
/**
 * GET /analytics/reports/weekly
 *
 * Generates a weekly report.
 *
 * Query params:
 * - date: End date of the week (default: today)
 * - businessId: Filter by specific business (admin only)
 */
router.get('/reports/weekly', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const date = req.query.date ? new Date(req.query.date) : new Date();
        let businessId;
        if (user.role !== 'owner' && user.role !== 'admin') {
            businessId = user.business_id;
        }
        else if (req.query.businessId) {
            businessId = parseInt(req.query.businessId);
        }
        const report = await reports_1.default.generateWeeklyReport(businessId, date);
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        console.error('Weekly report error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate weekly report',
            message: error.message
        });
    }
});
/**
 * GET /analytics/reports/monthly
 *
 * Generates a monthly platform report (admin only).
 *
 * Query params:
 * - year: Report year (default: current year)
 * - month: Report month (default: current month)
 */
router.get('/reports/monthly', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    try {
        const year = req.query.year ? parseInt(req.query.year) : undefined;
        const month = req.query.month ? parseInt(req.query.month) : undefined;
        const report = await reports_1.default.generateMonthlyPlatformReport(year, month);
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        console.error('Monthly report error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate monthly report',
            message: error.message
        });
    }
});
// ============================================================================
// CACHE MANAGEMENT (Admin Only)
// ============================================================================
/**
 * POST /analytics/cache/clear
 *
 * Clears the analytics cache.
 */
router.post('/cache/clear', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), (req, res) => {
    try {
        AnalyticsService_1.default.clearCache();
        res.json({
            success: true,
            message: 'Analytics cache cleared successfully'
        });
    }
    catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache',
            message: error.message
        });
    }
});
/**
 * GET /analytics/cache/stats
 *
 * Returns cache statistics.
 */
router.get('/cache/stats', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), (req, res) => {
    try {
        const stats = AnalyticsService_1.default.getCacheStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Cache stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cache stats',
            message: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map