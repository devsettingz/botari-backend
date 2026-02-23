import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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

// Get all AI employees from database
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, display_name, employee_role, description, 
              price_monthly, assigned_channel, features, color_theme, 
              tier, icon_emoji, avatar_url, is_active, created_at
       FROM ai_employees 
       ORDER BY id`
    );
    
    res.json({
      data: result.rows,
      total: result.rows.length,
      page: 1,
      total_pages: 1
    });
  } catch (error) {
    console.error('[SimpleEmployees] Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee
router.get('/:id', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ai_employees WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[SimpleEmployees] Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee
router.post('/', verifyAdmin, async (req, res) => {
  const { name, display_name, employee_role, description, price_monthly, 
          assigned_channel, features, color_theme, tier, icon_emoji, avatar_url } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO ai_employees (name, display_name, employee_role, description, 
                                 price_monthly, assigned_channel, features, 
                                 color_theme, tier, icon_emoji, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, display_name, employee_role, description, price_monthly, 
       assigned_channel, JSON.stringify(features), color_theme, tier, icon_emoji, avatar_url]
    );
    
    res.json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('[SimpleEmployees] Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee
router.put('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(updates);
    
    const result = await pool.query(
      `UPDATE ai_employees SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('[SimpleEmployees] Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM ai_employees WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    console.error('[SimpleEmployees] Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// Toggle active status
router.put('/:id/active', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE ai_employees SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [is_active, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('[SimpleEmployees] Error toggling employee status:', error);
    res.status(500).json({ error: 'Failed to toggle employee status' });
  }
});

export default router;
