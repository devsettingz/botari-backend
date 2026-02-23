import { Router } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Middleware to verify admin token
const verifyAdmin = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to verify user token
const verifyUser = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// USER ENDPOINTS
// ============================================

// Create a new payment (goes to pending status)
router.post('/create', verifyUser, async (req, res) => {
  const { business_id, employee_id, amount, service_name } = req.body;
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `INSERT INTO payment_approvals 
       (user_id, business_id, employee_id, amount, service_name, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       RETURNING *`,
      [user_id, business_id, employee_id, amount, service_name]
    );

    res.json({ 
      success: true, 
      payment: result.rows[0],
      message: 'Payment submitted for admin approval'
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Get user's payments with status
router.get('/my-payments', verifyUser, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT * FROM payment_approvals 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json({ payments: result.rows });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get user's active/approved services
router.get('/my-services', verifyUser, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT p.*, e.name as employee_name, e.avatar_url 
       FROM payment_approvals p
       LEFT JOIN employees e ON p.employee_id = e.id
       WHERE p.user_id = $1 AND p.status = 'approved'
       ORDER BY p.approved_at DESC`,
      [user_id]
    );

    res.json({ services: result.rows });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Get all pending payments for admin
router.get('/admin/pending', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
              u.email as user_email, 
              u.business_name,
              e.name as employee_name,
              e.price_monthly
       FROM payment_approvals p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN employees e ON p.employee_id = e.id
       WHERE p.status = 'pending'
       ORDER BY p.created_at DESC`
    );

    res.json({ 
      count: result.rows.length,
      payments: result.rows 
    });
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// Get all payments (for payments page)
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
              u.email as user_email, 
              u.business_name,
              e.name as employee_name
       FROM payment_approvals p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN employees e ON p.employee_id = e.id
       ORDER BY p.created_at DESC`
    );

    res.json({ payments: result.rows });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Approve a payment
router.post('/admin/:id/approve', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const admin_id = req.user.user_id;

  try {
    // Update payment status
    const result = await pool.query(
      `UPDATE payment_approvals 
       SET status = 'approved', 
           approved_by = $1, 
           approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [admin_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = result.rows[0];

    // Activate the employee for the business
    await pool.query(
      `INSERT INTO business_employees (business_id, employee_id, status, hired_at)
       VALUES ($1, $2, 'active', NOW())
       ON CONFLICT (business_id, employee_id) 
       DO UPDATE SET status = 'active', hired_at = NOW()`,
      [payment.business_id, payment.employee_id]
    );

    res.json({ 
      success: true, 
      message: 'Payment approved and service activated',
      payment: result.rows[0]
    });
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// Reject a payment
router.post('/admin/:id/reject', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin_id = req.user.user_id;

  try {
    const result = await pool.query(
      `UPDATE payment_approvals 
       SET status = 'rejected', 
           approved_by = $1, 
           approved_at = NOW(),
           rejection_reason = $2
       WHERE id = $3
       RETURNING *`,
      [admin_id, reason || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ 
      success: true, 
      message: 'Payment rejected',
      payment: result.rows[0]
    });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// Get payment statistics
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as total_revenue
       FROM payment_approvals`
    );

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Payment stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
