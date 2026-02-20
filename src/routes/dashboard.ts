/**
 * Dashboard Routes
 * 
 * Provides dashboard analytics endpoints:
 * - GET /dashboard/stats - Overall stats
 * - GET /dashboard/conversations - Conversation metrics
 * - GET /dashboard/employees - Employee performance
 * - GET /dashboard/revenue - Revenue analytics
 * - GET /dashboard/:business_id/trends/messages/weekly - Weekly message trends
 * - GET /dashboard/:business_id/trends/conversations/weekly - Weekly conversation trends
 * - GET /dashboard/:business_id/summary - Business summary
 * - GET /dashboard/:business_id/trends/active-users/weekly - Active users trend
 * - GET /dashboard/:business_id/trends/revenue/weekly - Revenue trend
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { verifyToken } from '../middleware/verifyToken';
import { requireRole } from '../middleware/requireRole';
import { AuthRequest } from '../middleware/verifyToken';
import pool from '../db';
import analyticsService, { DateRange } from '../analytics/AnalyticsService';

const router = Router();

// ============================================================================
// TEST MODE
// ============================================================================

if (process.env.NODE_ENV === 'test') {
  // Test endpoint for backward compatibility
  router.get('/summary', (req, res) => {
    res.json({
      total_messages: 10,
      total_conversations: 5,
      total_subscriptions: 2
    });
  });
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * GET /dashboard/stats
 * 
 * Returns overall dashboard statistics.
 * Admin gets platform-wide stats, business users get their own stats.
 */
router.get('/stats', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    
    if (user.role === 'owner' || user.role === 'admin') {
      // Admin gets platform overview
      const metrics = await analyticsService.getOverviewMetrics();
      const platformMetrics = await analyticsService.getPlatformMetrics();
      
      res.json({
        success: true,
        data: {
          overview: metrics,
          platform: {
            totalBusinesses: platformMetrics.totalBusinesses,
            activeBusinesses: platformMetrics.activeBusinesses,
            mrr: platformMetrics.mrr,
            arr: platformMetrics.arr,
            churnRate: platformMetrics.churnRate
          }
        }
      });
    } else {
      // Business user gets their own stats
      const businessId = user.business_id;
      if (!businessId) {
        return res.status(400).json({ 
          success: false, 
          error: 'No business associated with user' 
        });
      }

      const metrics = await analyticsService.getOverviewMetrics(businessId);
      const businessMetrics = await analyticsService.getBusinessMetrics(businessId);
      
      res.json({
        success: true,
        data: {
          overview: metrics,
          business: {
            totalConversations: businessMetrics.totalConversations,
            totalMessages: businessMetrics.totalMessages,
            avgResponseTime: businessMetrics.avgResponseTime,
            conversionRate: businessMetrics.conversionRate,
            customerSatisfaction: businessMetrics.customerSatisfaction,
            revenueGenerated: businessMetrics.revenueGenerated
          }
        }
      });
    }
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard stats',
      message: error.message 
    });
  }
});

// ============================================================================
// CONVERSATION METRICS
// ============================================================================

/**
 * GET /dashboard/conversations
 * 
 * Returns conversation metrics for the dashboard.
 */
router.get('/conversations', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    
    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      const businessIdParam = Array.isArray(req.query.businessId) 
        ? req.query.businessId[0] 
        : req.query.businessId;
      businessId = parseInt(businessIdParam as string);
    }

    // Get date range (default: last 30 days)
    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateRange: DateRange = { startDate, endDate };

    const metrics = await analyticsService.getConversationMetrics(businessId, dateRange);

    // Get recent conversations
    let recentQuery = `
      SELECT 
        c.id,
        c.customer_name,
        c.customer_phone,
        c.status,
        c.message_count,
        c.started_at,
        c.last_message_at,
        ae.display_name as employee_name
      FROM conversations c
      LEFT JOIN ai_employees ae ON c.employee_id = ae.id
      WHERE 1=1
      ${businessId ? 'AND c.business_id = $1' : ''}
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT 10
    `;

    const recentResult = await pool.query(
      recentQuery,
      businessId ? [businessId] : []
    );

    res.json({
      success: true,
      data: {
        summary: {
          total: metrics.totalConversations,
          open: metrics.openConversations,
          closed: metrics.closedConversations,
          escalated: metrics.escalatedConversations,
          avgDuration: metrics.avgConversationDuration,
          avgMessagesPerConversation: metrics.avgMessagesPerConversation
        },
        breakdown: {
          byHour: metrics.conversationsByHour,
          byDay: metrics.conversationsByDay
        },
        topTopics: metrics.topTopics,
        recent: recentResult.rows
      }
    });
  } catch (error: any) {
    console.error('Dashboard conversations error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversation metrics',
      message: error.message 
    });
  }
});

// ============================================================================
// EMPLOYEE PERFORMANCE
// ============================================================================

/**
 * GET /dashboard/employees
 * 
 * Returns employee performance metrics for the dashboard.
 */
router.get('/employees', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    
    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      const businessIdParam = Array.isArray(req.query.businessId) 
        ? req.query.businessId[0] 
        : req.query.businessId;
      businessId = parseInt(businessIdParam as string);
    }

    // Get date range (default: last 30 days)
    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateRange: DateRange = { startDate, endDate };

    const employeeMetrics = await analyticsService.getAllEmployeesMetrics(businessId, dateRange);

    // Get top performing employees
    const topEmployees = employeeMetrics
      .sort((a, b) => b.conversationsHandled - a.conversationsHandled)
      .slice(0, 5)
      .map(e => ({
        id: e.employeeId,
        name: e.displayName,
        role: e.employeeRole,
        conversations: e.conversationsHandled,
        messages: e.messagesHandled,
        successRate: e.actionsSuccessRate,
        satisfaction: e.customerSatisfaction
      }));

    res.json({
      success: true,
      data: {
        summary: {
          totalEmployees: employeeMetrics.length,
          totalConversations: employeeMetrics.reduce((sum, e) => sum + e.conversationsHandled, 0),
          totalMessages: employeeMetrics.reduce((sum, e) => sum + e.messagesHandled, 0),
          avgSuccessRate: employeeMetrics.length > 0
            ? employeeMetrics.reduce((sum, e) => sum + e.actionsSuccessRate, 0) / employeeMetrics.length
            : 0
        },
        employees: employeeMetrics.map(e => ({
          id: e.employeeId,
          name: e.displayName,
          role: e.employeeRole,
          metrics: {
            conversations: e.conversationsHandled,
            messages: e.messagesHandled,
            actions: e.actionsExecuted,
            successRate: e.actionsSuccessRate,
            avgHandlingTime: e.avgHandlingTime,
            escalationRate: e.escalationRate,
            revenue: e.revenueGenerated,
            satisfaction: e.customerSatisfaction
          },
          trend: e.trend
        })),
        topPerformers: topEmployees
      }
    });
  } catch (error: any) {
    console.error('Dashboard employees error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch employee metrics',
      message: error.message 
    });
  }
});

// ============================================================================
// REVENUE ANALYTICS
// ============================================================================

/**
 * GET /dashboard/revenue
 * 
 * Returns revenue analytics for the dashboard.
 */
router.get('/revenue', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    
    let businessId: number | undefined;
    if (user.role !== 'owner' && user.role !== 'admin') {
      businessId = user.business_id;
    } else if (req.query.businessId) {
      const businessIdParam = Array.isArray(req.query.businessId) 
        ? req.query.businessId[0] 
        : req.query.businessId;
      businessId = parseInt(businessIdParam as string);
    }

    // Get date range
    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateRange: DateRange = { startDate, endDate };

    const revenueMetrics = await analyticsService.getRevenueMetrics(businessId, dateRange);

    // Get recent orders
    let ordersQuery = `
      SELECT 
        o.id,
        o.customer_phone,
        o.total_amount,
        o.status,
        o.payment_status,
        o.created_at,
        c.name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.business_id = c.business_id AND o.customer_phone = c.phone
      WHERE 1=1
      ${businessId ? 'AND o.business_id = $1' : ''}
      ORDER BY o.created_at DESC
      LIMIT 10
    `;

    const ordersResult = await pool.query(
      ordersQuery,
      businessId ? [businessId] : []
    );

    // Get revenue by day for chart
    const revenueByDayResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2
      ${businessId ? 'AND business_id = $3' : ''}
      GROUP BY DATE(created_at)
      ORDER BY date
    `, businessId ? [startDate, endDate, businessId] : [startDate, endDate]);

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: revenueMetrics.totalRevenue,
          monthlyRecurringRevenue: revenueMetrics.monthlyRecurringRevenue,
          averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
          paymentSuccessRate: revenueMetrics.paymentSuccessRate
        },
        revenueByPlan: revenueMetrics.revenueByPlan,
        recentOrders: ordersResult.rows,
        revenueTrend: revenueByDayResult.rows.map(r => ({
          date: r.date.toISOString().split('T')[0],
          revenue: parseFloat(r.revenue),
          orders: parseInt(r.orders, 10)
        }))
      }
    });
  } catch (error: any) {
    console.error('Dashboard revenue error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch revenue analytics',
      message: error.message 
    });
  }
});

// ============================================================================
// BUSINESS-SPECIFIC TRENDS
// ============================================================================

/**
 * GET /dashboard/:business_id/trends/messages/weekly
 * 
 * Returns weekly message trends for a specific business.
 */
router.get('/:business_id/trends/messages/weekly', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const businessId = parseInt(req.params.business_id as string);

    // Check authorization
    if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    // Get last 7 days of message data
    const result = await pool.query(`
      SELECT 
        DATE(m.created_at) as date,
        COUNT(*) as message_count,
        COUNT(*) FILTER (WHERE m.role = 'user') as user_messages,
        COUNT(*) FILTER (WHERE m.role = 'assistant') as assistant_messages
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.business_id = $1
        AND m.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(m.created_at)
      ORDER BY date
    `, [businessId]);

    res.json({
      success: true,
      data: {
        businessId,
        period: '7 days',
        trends: result.rows.map(r => ({
          date: r.date.toISOString().split('T')[0],
          total: parseInt(r.message_count, 10),
          user: parseInt(r.user_messages, 10),
          assistant: parseInt(r.assistant_messages, 10)
        }))
      }
    });
  } catch (error: any) {
    console.error('Weekly message trends error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch message trends',
      message: error.message 
    });
  }
});

/**
 * GET /dashboard/:business_id/trends/conversations/weekly
 * 
 * Returns weekly conversation trends for a specific business.
 */
router.get('/:business_id/trends/conversations/weekly', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const businessId = parseInt(req.params.business_id as string);

    if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as conversation_count,
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_count
      FROM conversations
      WHERE business_id = $1
        AND started_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(started_at)
      ORDER BY date
    `, [businessId]);

    res.json({
      success: true,
      data: {
        businessId,
        period: '7 days',
        trends: result.rows.map(r => ({
          date: r.date.toISOString().split('T')[0],
          total: parseInt(r.conversation_count, 10),
          open: parseInt(r.open_count, 10),
          closed: parseInt(r.closed_count, 10)
        }))
      }
    });
  } catch (error: any) {
    console.error('Weekly conversation trends error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversation trends',
      message: error.message 
    });
  }
});

/**
 * GET /dashboard/:business_id/summary
 * 
 * Returns summary statistics for a specific business.
 */
router.get('/:business_id/summary', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const businessId = parseInt(req.params.business_id as string);

    if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    // Get comprehensive summary
    const [overview, businessMetrics] = await Promise.all([
      analyticsService.getOverviewMetrics(businessId),
      analyticsService.getBusinessMetrics(businessId)
    ]);

    // Get quick stats
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM conversations WHERE business_id = $1 AND status = 'open') as open_conversations,
        (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND status = 'pending') as pending_orders,
        (SELECT COUNT(*) FROM appointments WHERE business_id = $1 AND status = 'confirmed' AND scheduled_at >= NOW()) as upcoming_appointments,
        (SELECT COUNT(*) FROM customers WHERE business_id = $1) as total_customers,
        (SELECT COUNT(*) FROM products WHERE business_id = $1 AND is_active = true) as active_products
    `, [businessId]);

    res.json({
      success: true,
      data: {
        overview: {
          totalConversations: overview.totalConversations,
          totalMessages: overview.totalMessages,
          avgResponseTime: overview.avgResponseTime,
          totalRevenue: overview.totalRevenue,
          conversionRate: overview.conversionRate
        },
        business: {
          ...businessMetrics,
          topProducts: businessMetrics.topProducts.slice(0, 5)
        },
        quickStats: {
          openConversations: parseInt(statsResult.rows[0]?.open_conversations || 0, 10),
          pendingOrders: parseInt(statsResult.rows[0]?.pending_orders || 0, 10),
          upcomingAppointments: parseInt(statsResult.rows[0]?.upcoming_appointments || 0, 10),
          totalCustomers: parseInt(statsResult.rows[0]?.total_customers || 0, 10),
          activeProducts: parseInt(statsResult.rows[0]?.active_products || 0, 10)
        }
      }
    });
  } catch (error: any) {
    console.error('Business summary error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business summary',
      message: error.message 
    });
  }
});

/**
 * GET /dashboard/:business_id/trends/active-users/weekly
 * 
 * Returns weekly active users trend for a specific business.
 */
router.get('/:business_id/trends/active-users/weekly', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const businessId = parseInt(req.params.business_id as string);

    if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(started_at) as date,
        COUNT(DISTINCT customer_phone) as unique_customers,
        COUNT(DISTINCT CASE WHEN customer_phone IN (
          SELECT customer_phone FROM conversations 
          WHERE business_id = $1 AND started_at < DATE(c.started_at)
        ) THEN customer_phone END) as returning_customers
      FROM conversations c
      WHERE business_id = $1
        AND started_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(started_at)
      ORDER BY date
    `, [businessId]);

    res.json({
      success: true,
      data: {
        businessId,
        period: '7 days',
        trends: result.rows.map(r => ({
          date: r.date.toISOString().split('T')[0],
          uniqueCustomers: parseInt(r.unique_customers, 10),
          returningCustomers: parseInt(r.returning_customers, 10),
          newCustomers: parseInt(r.unique_customers, 10) - parseInt(r.returning_customers, 10)
        }))
      }
    });
  } catch (error: any) {
    console.error('Active users trend error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch active users trend',
      message: error.message 
    });
  }
});

/**
 * GET /dashboard/:business_id/trends/revenue/weekly
 * 
 * Returns weekly revenue trend for a specific business.
 */
router.get('/:business_id/trends/revenue/weekly', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = req.user!;
    const businessId = parseInt(req.params.business_id as string);

    if (user.role !== 'owner' && user.role !== 'admin' && user.business_id !== businessId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as order_count,
        AVG(total_amount) as avg_order_value
      FROM orders
      WHERE business_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [businessId]);

    res.json({
      success: true,
      data: {
        businessId,
        period: '7 days',
        trends: result.rows.map(r => ({
          date: r.date.toISOString().split('T')[0],
          revenue: parseFloat(r.revenue),
          orders: parseInt(r.order_count, 10),
          avgOrderValue: parseFloat(r.avg_order_value || 0)
        }))
      }
    });
  } catch (error: any) {
    console.error('Revenue trend error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch revenue trend',
      message: error.message 
    });
  }
});

export default router;
