import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import pool from '../db';

const router = Router();

// Get all employees (marketplace)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_employees WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get MY TEAM (hired employees) - FIXED FOR LAUNCH
router.get('/my-team', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    console.log('Fetching team for business:', businessId);

    // Get all employees hired by this business
    const result = await pool.query(
      `SELECT 
        ae.id,
        ae.display_name,
        ae.employee_role,
        ae.avatar_url,
        ae.description,
        ae.price_monthly,
        ae.assigned_channel,
        be.is_active as is_hired,
        be.connection_status,
        be.whatsapp_number,
        be.hired_at,
        s.status as subscription_status,
        s.expires_at
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       LEFT JOIN subscriptions s ON be.employee_id = s.employee_id 
         AND be.business_id = s.business_id 
         AND s.status = 'active'
       WHERE be.business_id = $1`,
      [businessId]
    );

    console.log('Team found:', result.rows.length, 'employees');
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching my team:', err);
    res.status(500).json({ error: 'Failed to fetch team', details: err.message });
  }
});

// Get transaction/payment history
router.get('/payments/history', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    
    const result = await pool.query(
      `SELECT 
        p.*,
        ae.display_name as employee_name,
        ae.avatar_url
       FROM payments p
       LEFT JOIN ai_employees ae ON p.employee_id = ae.id
       WHERE p.business_id = $1
       ORDER BY p.created_at DESC`,
      [businessId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;