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

// Get MY HIRED TEAM - FIXED (removed avatar_url)
router.get('/my-team', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    
    if (!businessId) {
      return res.status(401).json({ error: 'No business ID' });
    }

    console.log(`Fetching team for business: ${businessId}`);

    // FIXED: Removed avatar_url and used LEFT JOIN
    const result = await pool.query(
      `SELECT 
        ae.id,
        ae.display_name,
        ae.employee_role,
        ae.description,
        ae.price_monthly,
        ae.assigned_channel,
        COALESCE(be.connection_status, 'disconnected') as connection_status,
        be.whatsapp_number,
        COALESCE(be.is_active, true) as is_active
       FROM business_employees be
       LEFT JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1`,
      [businessId]
    );

    console.log(`SUCCESS: Found ${result.rows.length} employees`);
    res.json(result.rows);
  } catch (err: any) {
    console.error('DATABASE ERROR in /my-team:', err.message);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Hire employee after payment
router.post('/hire', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    const { employee_id } = req.body;
    
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID required' });
    }

    console.log(`Hiring employee ${employee_id} for business ${businessId}`);

    await pool.query(
      `INSERT INTO business_employees 
       (business_id, employee_id, is_active, connection_status, hired_at, updated_at)
       VALUES ($1, $2, true, 'disconnected', NOW(), NOW())
       ON CONFLICT (business_id, employee_id) 
       DO UPDATE SET is_active = true, updated_at = NOW()`,
      [businessId, employee_id]
    );

    console.log('SUCCESS: Employee hired');
    res.json({ success: true, message: 'Employee hired successfully' });
    
  } catch (err: any) {
    console.error('HIRE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to hire employee', details: err.message });
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