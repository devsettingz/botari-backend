import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import pool from '../db';

const router = Router();

// Get available employees (marketplace)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_employees WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get MY HIRED TEAM - FIXED
router.get('/my-team', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    
    if (!businessId) {
      return res.status(401).json({ error: 'No business ID' });
    }

    // CRITICAL FIX: Get ALL employees hired by this business
    const result = await pool.query(
      `SELECT 
        ae.id,
        ae.display_name,
        ae.employee_role,
        ae.avatar_url,
        ae.description,
        ae.price_monthly,
        ae.assigned_channel,
        be.connection_status,
        be.whatsapp_number,
        be.is_active
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1`,
      [businessId]
    );

    console.log(`Found ${result.rows.length} employees for business ${businessId}`);
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Payment history
router.get('/payments/history', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    const result = await pool.query(
      `SELECT p.*, ae.display_name as employee_name 
       FROM payments p 
       LEFT JOIN ai_employees ae ON p.employee_id = ae.id 
       WHERE p.business_id = $1 
       ORDER BY p.created_at DESC`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

export default router;