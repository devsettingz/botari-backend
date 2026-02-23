import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const router = express.Router();
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

// Hardcoded admin credentials (working)
const ADMIN_EMAIL = 'admin@botari.ai';
const ADMIN_PASSWORD = 'admin123'; // Simple password that works

// Simple admin login - NO DATABASE, NO COMPLEXITY
router.post('/login', async (req, res) => {
  console.log('[SimpleAdmin] Login attempt:', req.body.email);
  
  const { email, password } = req.body;
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    console.log('[SimpleAdmin] Invalid credentials');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate token
  const token = jwt.sign(
    { user_id: 'admin', email: ADMIN_EMAIL, role: 'admin', name: 'Platform Admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  console.log('[SimpleAdmin] Login successful');
  
  res.json({
    success: true,
    token,
    user: {
      id: 'admin',
      email: ADMIN_EMAIL,
      name: 'Platform Admin',
      role: 'admin'
    }
  });
});

// Verify token
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get admin dashboard stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [userCount, businessCount, employeeCount, convCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM businesses'),
      pool.query('SELECT COUNT(*) FROM employees'),
      pool.query('SELECT COUNT(*) FROM conversations')
    ]);

    res.json({
      total_users: parseInt(userCount.rows[0].count),
      total_businesses: parseInt(businessCount.rows[0].count),
      total_employees: parseInt(employeeCount.rows[0].count),
      total_conversations: parseInt(convCount.rows[0].count),
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all businesses
router.get('/businesses', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.email as owner_email, 
              COUNT(be.employee_id) as employee_count
       FROM businesses b
       LEFT JOIN users u ON b.owner_id = u.id
       LEFT JOIN business_employees be ON b.id = be.business_id
       GROUP BY b.id, u.email
       ORDER BY b.created_at DESC`
    );
    res.json({ businesses: result.rows });
  } catch (error) {
    console.error('Businesses error:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// Get all employees
router.get('/employees', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, COUNT(be.business_id) as business_count
       FROM employees e
       LEFT JOIN business_employees be ON e.id = be.employee_id
       GROUP BY e.id
       ORDER BY e.created_at DESC`
    );
    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get all conversations
router.get('/conversations', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, b.name as business_name, e.name as employee_name
       FROM conversations c
       LEFT JOIN businesses b ON c.business_id = b.id
       LEFT JOIN employees e ON c.employee_id = e.id
       ORDER BY c.updated_at DESC
       LIMIT 50`
    );
    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get all users
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.business_name, u.created_at, u.is_active,
              COUNT(b.id) as business_count
       FROM users u
       LEFT JOIN businesses b ON u.id = b.owner_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get settings
router.get('/settings', verifyAdmin, async (req, res) => {
  res.json({
    platform_name: 'Botari AI',
    support_email: 'support@botari.ai',
    maintenance_mode: false,
    allow_signups: true,
  });
});

// Get subscriptions
router.get('/subscriptions', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, b.name as business_name
       FROM subscriptions s
       LEFT JOIN businesses b ON s.business_id = b.id
       ORDER BY s.created_at DESC`
    );
    res.json({ subscriptions: result.rows });
  } catch (error) {
    console.error('Subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get health status
router.get('/health', verifyAdmin, async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Get activity feed
router.get('/activity', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM (
        SELECT 'user' as type, email as title, created_at, 'joined' as action
        FROM users ORDER BY created_at DESC LIMIT 5
      ) UNION ALL
      SELECT * FROM (
        SELECT 'business' as type, name as title, created_at, 'registered' as action
        FROM businesses ORDER BY created_at DESC LIMIT 5
      ) ORDER BY created_at DESC LIMIT 10`
    );
    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;
