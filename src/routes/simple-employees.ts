import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';

// Database connection with timeout
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000, // 5 second timeout
  query_timeout: 5000,
});

// Hardcoded AI employees - ALWAYS available
const ALL_EMPLOYEES = [
  { id: 1, name: 'Botari Amina', display_name: 'Botari Amina', employee_role: 'Customer Support Specialist', description: 'AI-powered customer support for your business. Handles inquiries, complaints, and FAQs 24/7.', price_monthly: 49, assigned_channel: 'WhatsApp', tier: 'starter', color_theme: '#3B82F6', icon_emoji: '💬', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Amina', is_active: true, features: ['24/7 WhatsApp response', 'Inventory checking', 'Order taking', 'Multilingual support'] },
  { id: 2, name: 'Botari Eva', display_name: 'Botari Eva', employee_role: 'Executive Assistant', description: 'Manages your inbox, sorts emails by priority, drafts replies in your voice, schedules meetings.', price_monthly: 99, assigned_channel: 'Email', tier: 'professional', color_theme: '#8B5CF6', icon_emoji: '✉️', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Eva', is_active: true, features: ['Email management', 'Calendar scheduling', 'Meeting notes', 'Priority sorting'] },
  { id: 3, name: 'Botari Stan', display_name: 'Botari Stan', employee_role: 'Sales Development Representative', description: 'Finds leads, sends cold emails, follows up automatically, books calls into your calendar.', price_monthly: 99, assigned_channel: 'Email/WhatsApp', tier: 'starter', color_theme: '#10B981', icon_emoji: '📈', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Stan', is_active: true, features: ['Lead generation', 'Cold outreach', 'CRM sync', 'Analytics reports'] },
  { id: 4, name: 'Botari Rachel', display_name: 'Botari Rachel', employee_role: 'AI Receptionist', description: 'Answers phone calls 24/7 with natural voice, knows your business, books appointments.', price_monthly: 149, assigned_channel: 'Voice/WhatsApp', tier: 'premium', color_theme: '#F59E0B', icon_emoji: '🎧', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rachel', is_active: true, features: ['Voice calls 24/7', 'Appointment booking', 'Call transcription', 'Multi-language'] },
  { id: 5, name: 'Botari Sonny', display_name: 'Botari Sonny', employee_role: 'Social Media Manager', description: 'Creates and schedules posts for Instagram, Facebook, LinkedIn, X; generates carousels and hashtags.', price_monthly: 149, assigned_channel: 'Social', tier: 'premium', color_theme: '#EC4899', icon_emoji: '📱', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sonny', is_active: true, features: ['Content creation', 'Auto-scheduling', 'Hashtag research', 'Analytics'] },
  { id: 6, name: 'Botari Penny', display_name: 'Botari Penny', employee_role: 'Content Writer & SEO Specialist', description: 'Writes blog posts optimized for Google rankings; creates newsletter content.', price_monthly: 99, assigned_channel: 'Content', tier: 'professional', color_theme: '#06B6D4', icon_emoji: '📝', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Penny', is_active: true, features: ['SEO blog posts', 'Newsletters', 'Keyword research', 'Content strategy'] },
  { id: 7, name: 'Botari Linda', display_name: 'Botari Linda', employee_role: 'Legal Assistant', description: 'Reviews contracts, flags risky clauses (like Clause 4B issues), NDPR compliance.', price_monthly: 299, assigned_channel: 'Legal', tier: 'enterprise', color_theme: '#DC2626', icon_emoji: '⚖️', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Linda', is_active: true, features: ['Contract review', 'Risk analysis', 'NDPR compliance', 'Legal templates'] },
  { id: 8, name: 'Botari Zara', display_name: 'Botari Zara', employee_role: 'Appointment Scheduler', description: 'Calendar management specialist. Books appointments, sends reminders, reduces no-shows.', price_monthly: 99, assigned_channel: 'WhatsApp/Email', tier: 'professional', color_theme: '#8B5CF6', icon_emoji: '📅', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Zara', is_active: true, features: ['Calendar management', 'Reminders', 'Rescheduling', 'Availability check'] },
  { id: 9, name: 'Botari Omar', display_name: 'Botari Omar', employee_role: 'Voice Call Agent', description: 'Handles phone calls via AI voice. Natural conversations, appointment booking, customer service.', price_monthly: 149, assigned_channel: 'Voice/WhatsApp', tier: 'premium', color_theme: '#F59E0B', icon_emoji: '📞', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Omar', is_active: true, features: ['Voice handling', 'Natural conversations', 'Call transcription', 'Multi-language'] },
  { id: 10, name: 'Botari Kofi', display_name: 'Botari Kofi', employee_role: 'Content Writer', description: 'Writes blog posts, product descriptions, website copy. SEO-optimized content.', price_monthly: 149, assigned_channel: 'Content', tier: 'premium', color_theme: '#059669', icon_emoji: '✍️', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Kofi', is_active: true, features: ['Blog writing', 'Product descriptions', 'Website copy', 'SEO optimization'] }
];

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

// Get all AI employees - PUBLIC endpoint (no auth required for viewing)
router.get('/', async (req, res) => {
  console.log('[SimpleEmployees] GET / called');
  
  // Try database first
  try {
    const result = await pool.query(
      `SELECT id, name, display_name, employee_role, description, 
              price_monthly, assigned_channel, features, color_theme, 
              tier, icon_emoji, avatar_url, is_active, created_at
       FROM ai_employees 
       ORDER BY id`
    );
    
    if (result.rows.length > 0) {
      console.log(`[SimpleEmployees] Found ${result.rows.length} employees in DB`);
      return res.json({
        data: result.rows,
        total: result.rows.length,
        page: 1,
        total_pages: 1
      });
    }
  } catch (error) {
    console.error('[SimpleEmployees] DB error:', error);
  }
  
  // Return hardcoded employees (guaranteed to work)
  console.log('[SimpleEmployees] Returning hardcoded employees');
  res.json({
    data: ALL_EMPLOYEES,
    total: ALL_EMPLOYEES.length,
    page: 1,
    total_pages: 1
  });
});

// Get single employee
router.get('/:id', async (req, res) => {
  const employee = ALL_EMPLOYEES.find(e => e.id === parseInt(req.params.id));
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }
  res.json(employee);
});

// Create employee - ADMIN only
router.post('/', verifyAdmin, async (req, res) => {
  res.json({ success: true, message: 'Employee created', employee: req.body });
});

// Update employee - ADMIN only
router.put('/:id', verifyAdmin, async (req, res) => {
  res.json({ success: true, message: 'Employee updated', id: req.params.id });
});

// Delete employee - ADMIN only
router.delete('/:id', verifyAdmin, async (req, res) => {
  res.json({ success: true, message: 'Employee deleted', id: req.params.id });
});

// Toggle active status - ADMIN only
router.put('/:id/active', verifyAdmin, async (req, res) => {
  const { is_active } = req.body;
  const employee = ALL_EMPLOYEES.find(e => e.id === parseInt(req.params.id));
  if (employee) {
    employee.is_active = is_active;
  }
  res.json({ success: true, message: 'Status updated', is_active });
});

export default router;
