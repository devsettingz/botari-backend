import express from 'express';
import { Pool } from 'pg';
import { verifyToken } from '../middleware/verifyToken';

const router = express.Router();

// Check if DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  console.error('WARNING: DATABASE_URL not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// GET /api/employees/my-team
router.get('/my-team', verifyToken, async (req: any, res: any) => {
  const businessId = req.userId;
  
  try {
    const result = await pool.query(
      `SELECT 
        e.id,
        e.name,
        e.display_name,
        e.employee_role,
        e.description,
        e.base_monthly_price,
        e.supported_channels,
        COALESCE(be.is_active, false) as is_hired,
        be.hired_at
       FROM ai_employees e
       LEFT JOIN business_employees be ON e.id = be.employee_id AND be.business_id = $1
       WHERE e.is_active = true
       ORDER BY e.base_monthly_price`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// POST /api/employees/hire
router.post('/hire', verifyToken, async (req: any, res: any) => {
  const businessId = req.userId;
  const { employeeName, channelType } = req.body;
  
  try {
    // Get employee ID
    const empResult = await pool.query(
      'SELECT id FROM ai_employees WHERE name = $1',
      [employeeName]
    );
    
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const employeeId = empResult.rows[0].id;
    
    // Hire them
    await pool.query(
      `INSERT INTO business_employees (business_id, employee_id, config, assigned_channel, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (business_id, employee_id) 
       DO UPDATE SET is_active = true, assigned_employee_id = $4`,
      [businessId, employeeId, JSON.stringify({ hired_at: new Date() }), channelType || 'whatsapp']
    );
    
    // Assign to channel
    await pool.query(
      `INSERT INTO channels (business_id, channel_type, assigned_employee_id, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (business_id, channel_type)
       DO UPDATE SET assigned_employee_id = $3, is_active = true`,
      [businessId, channelType || 'whatsapp', employeeId]
    );
    
    res.json({ message: `Successfully hired ${employeeName}` });
    
  } catch (err: any) {
    console.error('Error hiring employee:', err);
    res.status(500).json({ error: 'Failed to hire employee' });
  }
});

export default router;