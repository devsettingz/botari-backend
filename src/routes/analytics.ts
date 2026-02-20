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

import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import { requireRole } from '../middleware/requireRole';
import { AuthRequest } from '../middleware/verifyToken';
import analyticsService from '../analytics/AnalyticsService';
import reportGenerator from '../analytics/reports';

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Helper to parse date range from query params
const parseDateRange = (req: any) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
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
router.get('/overview', verifyToken, requireRole('owner'), async (req: AuthRequest, res: any) => {
  try {
    const dateRange = parseDateRange(req);
    
    const [overview, platformMetrics, revenueMetrics, conversationMetrics] = await Promise.all([
      analyticsService.getOverviewMetrics(),
      analyticsService.getPlatformMetrics(dateRange),
      analyticsService.getRevenueMetrics(undefined, dateRange),
      analyticsService.getConversationMetrics(undefined, dateRange)
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
  } catch (error: any) {
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
router.get('/businesses', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const dateRange = parseDateRange(req);
    const limit = parseInt(req.query.limit as string) || 50;

    // If business user, return only their data
    if (user.role !== 'owner' && user.role !== 'admin') {
      const businessId = user.business_id;
      if (!businessId) {
        return res.status(400).json({ 
          success: false, 
          error: 'No business associated with user' 
        });
      }

      const metrics = await analyticsService.getBusinessMetrics(businessId, dateRange);
      const healthScore = await reportGenerator.generateBusinessHealthScore(businessId);

      return res.json({
        success: true,
        data: {
          businesses: [metrics],
          healthScores: [healthScore]
        }
      });
    }

    // Admin gets aggregated data
    const platformMetrics = await analyticsService.getPlatformMetrics(dateRange);
    
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
  } catch (error: any) {
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
router.get('/businesses/:id', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const businessId = parseInt(req.params.id as string);
    const dateRange = parseDateRange(req);

    // Check authorization
    if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: You can only view your own business analytics' 
      });
    }

    const [metrics, healthScore] = await Promise.all([
      analyticsService.getBusinessMetrics(businessId, dateRange),
      reportGenerator.generateBusinessHealthScore(businessId)
    ]);

    res.json({
      success: true,
      data: {
        metrics,
        healthScore
      }
    });
  } catch (error: any) {
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
router.get('/conversations', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const dateRange = parseDateRange(req);
    
    // Determine business scope
    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
      if (!businessId) {
        return res.status(400).json({ 
          success: false, 
          error: 'No business associated with user' 
        });
      }
    } else if (req.query.businessId) {
      const businessIdParam = Array.isArray(req.query.businessId) 
        ? req.query.businessId[0] 
        : req.query.businessId;
      businessId = parseInt(businessIdParam as string);
    }

    const metrics = await analyticsService.getConversationMetrics(businessId, dateRange);

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
  } catch (error: any) {
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
router.get('/conversations/trends', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const days = parseInt(req.query.days as string) || 30;
    
    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      businessId = parseInt(req.query.businessId as string);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dateRange = { startDate, endDate };
    
    const metrics = await analyticsService.getConversationMetrics(businessId, dateRange);

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
  } catch (error: any) {
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
router.get('/employees', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const dateRange = parseDateRange(req);

    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      businessId = parseInt(req.query.businessId as string);
    }

    const metrics = await analyticsService.getAllEmployeesMetrics(businessId, dateRange);

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
  } catch (error: any) {
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
router.get('/employees/:id', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const employeeId = parseInt(req.params.id as string);
    const dateRange = parseDateRange(req);

    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      const businessIdParam = Array.isArray(req.query.businessId) 
        ? req.query.businessId[0] 
        : req.query.businessId;
      businessId = parseInt(businessIdParam as string);
    }

    const metrics = await analyticsService.getEmployeeMetrics(employeeId, businessId, dateRange);

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
  } catch (error: any) {
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
router.get('/export', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const type = (req.query.type as string) || 'conversations';
    const format = (req.query.format as string) || 'csv';
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
    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
      if (!businessId) {
        return res.status(400).json({ 
          success: false, 
          error: 'No business associated with user' 
        });
      }
    } else if (req.query.businessId) {
      businessId = parseInt(req.query.businessId as string);
    }

    // Generate export data
    const data = await analyticsService.exportData(
      type as any,
      format as 'csv' | 'json',
      businessId,
      dateRange
    );

    // Set appropriate headers
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `botari-${type}-${timestamp}.${format}`;
    
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(data);
  } catch (error: any) {
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
router.get('/reports/daily', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      businessId = parseInt(req.query.businessId as string);
    }

    const report = await reportGenerator.generateDailyReport(businessId, date);

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
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
router.get('/reports/weekly', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      businessId = parseInt(req.query.businessId as string);
    }

    const report = await reportGenerator.generateWeeklyReport(businessId, date);

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
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
router.get('/reports/monthly', verifyToken, requireRole('owner'), async (req: AuthRequest, res: any) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;

    const report = await reportGenerator.generateMonthlyPlatformReport(year, month);

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
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
router.post('/cache/clear', verifyToken, requireRole('owner'), (req: AuthRequest, res: any) => {
  try {
    analyticsService.clearCache();
    res.json({
      success: true,
      message: 'Analytics cache cleared successfully'
    });
  } catch (error: any) {
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
router.get('/cache/stats', verifyToken, requireRole('owner'), (req: AuthRequest, res: any) => {
  try {
    const stats = analyticsService.getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Cache stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get cache stats',
      message: error.message 
    });
  }
});

export default router;
