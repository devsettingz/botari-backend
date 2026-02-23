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

// Get all AI employees from database (public endpoint - no auth required)
router.get('/', async (req, res) => {
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
    // Return hardcoded employees as fallback
    const fallbackEmployees = [
      { id: 1, name: 'Botari Amina', display_name: 'Botari Amina', employee_role: 'Customer Support Specialist', description: 'AI-powered customer support for your business. Handles inquiries, complaints, and FAQs 24/7.', price_monthly: 49, assigned_channel: 'WhatsApp', tier: 'starter', color_theme: '#3B82F6', icon_emoji: '💬', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Amina', is_active: true },
      { id: 2, name: 'Botari Eva', display_name: 'Botari Eva', employee_role: 'Executive Assistant', description: 'Manages your inbox, sorts emails by priority, drafts replies in your voice, schedules meetings.', price_monthly: 99, assigned_channel: 'Email', tier: 'professional', color_theme: '#8B5CF6', icon_emoji: '✉️', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Eva', is_active: true },
      { id: 3, name: 'Botari Stan', display_name: 'Botari Stan', employee_role: 'Sales Development Representative', description: 'Finds leads, sends cold emails, follows up automatically, books calls into your calendar.', price_monthly: 99, assigned_channel: 'Email/WhatsApp', tier: 'starter', color_theme: '#10B981', icon_emoji: '📈', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Stan', is_active: true },
      { id: 4, name: 'Botari Rachel', display_name: 'Botari Rachel', employee_role: 'AI Receptionist', description: 'Answers phone calls 24/7 with natural voice, knows your business, books appointments.', price_monthly: 149, assigned_channel: 'Voice/WhatsApp', tier: 'premium', color_theme: '#F59E0B', icon_emoji: '🎧', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rachel', is_active: true },
      { id: 5, name: 'Botari Sonny', display_name: 'Botari Sonny', employee_role: 'Social Media Manager', description: 'Creates and schedules posts for Instagram, Facebook, LinkedIn, X; generates carousels and hashtags.', price_monthly: 149, assigned_channel: 'Social', tier: 'premium', color_theme: '#EC4899', icon_emoji: '📱', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sonny', is_active: true },
      { id: 6, name: 'Botari Penny', display_name: 'Botari Penny', employee_role: 'Content Writer & SEO Specialist', description: 'Writes blog posts optimized for Google rankings; creates newsletter content.', price_monthly: 99, assigned_channel: 'Content', tier: 'professional', color_theme: '#06B6D4', icon_emoji: '📝', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Penny', is_active: true },
      { id: 7, name: 'Botari Linda', display_name: 'Botari Linda', employee_role: 'Legal Assistant', description: 'Reviews contracts, flags risky clauses (like Clause 4B issues), NDPR compliance.', price_monthly: 299, assigned_channel: 'Legal', tier: 'enterprise', color_theme: '#DC2626', icon_emoji: '⚖️', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Linda', is_active: true },
      { id: 8, name: 'Botari Zara', display_name: 'Botari Zara', employee_role: 'Appointment Scheduler', description: 'Calendar management specialist. Books appointments, sends reminders, reduces no-shows.', price_monthly: 99, assigned_channel: 'WhatsApp/Email', tier: 'professional', color_theme: '#8B5CF6', icon_emoji: '📅', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Zara', is_active: true },
      { id: 9, name: 'Botari Omar', display_name: 'Botari Omar', employee_role: 'Voice Call Agent', description: 'Handles phone calls via AI voice. Natural conversations, appointment booking, customer service.', price_monthly: 149, assigned_channel: 'Voice/WhatsApp', tier: 'premium', color_theme: '#F59E0B', icon_emoji: '📞', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Omar', is_active: true },
      { id: 10, name: 'Botari Kofi', display_name: 'Botari Kofi', employee_role: 'Content Writer', description: 'Writes blog posts, product descriptions, website copy. SEO-optimized content.', price_monthly: 149, assigned_channel: 'Content', tier: 'premium', color_theme: '#059669', icon_emoji: '✍️', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Kofi', is_active: true }
    ];
    res.json({
      data: fallbackEmployees,
      total: fallbackEmployees.length,
      page: 1,
      total_pages: 1
    });
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
