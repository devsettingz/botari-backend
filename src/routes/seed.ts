import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// AI Employees seed data
const aiEmployees = [
  {
    name: 'Amina',
    display_name: 'Amina - Sales Assistant',
    employee_role: 'WhatsApp Sales Agent',
    description: 'Handles customer inquiries, checks inventory, takes orders via WhatsApp. Speaks English, Swahili, and Pidgin.',
    price_monthly: 49.00,
    assigned_channel: 'whatsapp',
    features: ['24/7 WhatsApp response', 'Inventory checking', 'Order taking', 'Multilingual support'],
    color_theme: '#E2725B',
    tier: 'starter',
    icon_emoji: '💬',
    tools: ['check_inventory', 'take_order', 'answer_faq', 'book_appointment'],
    is_active: true
  },
  {
    name: 'Eva',
    display_name: 'Eva - Customer Support',
    employee_role: 'Support Specialist',
    description: 'Manages customer support tickets, handles complaints, provides product information.',
    price_monthly: 49.00,
    assigned_channel: 'email',
    features: ['Ticket management', 'Complaint resolution', 'Product info', 'Follow-up emails'],
    color_theme: '#4ADE80',
    tier: 'starter',
    icon_emoji: '🎧',
    tools: ['manage_tickets', 'send_email', 'escalate_issue', 'track_complaint'],
    is_active: true
  },
  {
    name: 'Stan',
    display_name: 'Stan - Data Analyst',
    employee_role: 'Business Intelligence',
    description: 'Analyzes sales data, generates reports, tracks KPIs, provides business insights.',
    price_monthly: 99.00,
    assigned_channel: 'web',
    features: ['Sales analytics', 'Report generation', 'KPI tracking', 'Trend analysis'],
    color_theme: '#60A5FA',
    tier: 'professional',
    icon_emoji: '📊',
    tools: ['generate_report', 'analyze_sales', 'track_kpi', 'forecast_trends'],
    is_active: true
  },
  {
    name: 'Ada',
    display_name: 'Ada - Appointment Scheduler',
    employee_role: 'Calendar Manager',
    description: 'Books appointments, sends reminders, manages your calendar, reduces no-shows.',
    price_monthly: 49.00,
    assigned_channel: 'whatsapp',
    features: ['Calendar management', 'Reminder sending', 'Rescheduling', 'Availability checking'],
    color_theme: '#F472B6',
    tier: 'starter',
    icon_emoji: '📅',
    tools: ['book_appointment', 'send_reminder', 'check_availability', 'reschedule'],
    is_active: true
  },
  {
    name: 'Max',
    display_name: 'Max - Inventory Manager',
    employee_role: 'Stock Controller',
    description: 'Tracks inventory levels, alerts on low stock, manages reordering, prevents stockouts.',
    price_monthly: 99.00,
    assigned_channel: 'web',
    features: ['Stock tracking', 'Low stock alerts', 'Reorder management', 'Inventory reports'],
    color_theme: '#A78BFA',
    tier: 'professional',
    icon_emoji: '📦',
    tools: ['track_inventory', 'low_stock_alert', 'manage_reorder', 'generate_inventory_report'],
    is_active: true
  }
];

// Seed AI Employees
router.post('/ai-employees', async (req, res) => {
  try {
    console.log('Seeding AI employees...');
    
    let inserted = 0;
    let skipped = 0;
    let errors = [];
    
    for (const employee of aiEmployees) {
      try {
        // Check if already exists
        const existing = await pool.query(
          'SELECT id FROM ai_employees WHERE name = $1',
          [employee.name]
        );
        
        if (existing.rows.length > 0) {
          console.log(`Skipping ${employee.name} - already exists`);
          skipped++;
          continue;
        }
        
        await pool.query(
          `INSERT INTO ai_employees 
           (name, display_name, employee_role, description, price_monthly, assigned_channel, features, color_theme, tier, icon_emoji, tools, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            employee.name,
            employee.display_name,
            employee.employee_role,
            employee.description,
            employee.price_monthly,
            employee.assigned_channel,
            employee.features,
            employee.color_theme,
            employee.tier,
            employee.icon_emoji,
            employee.tools,
            employee.is_active
          ]
        );
        
        console.log(`Inserted ${employee.name}`);
        inserted++;
      } catch (itemErr: any) {
        console.error(`Error inserting ${employee.name}:`, itemErr.message);
        errors.push({ name: employee.name, error: itemErr.message });
      }
    }
    
    res.json({
      success: true,
      message: `AI employees seeded: ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err: any) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Get all AI employees
router.get('/ai-employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_employees WHERE is_active = true ORDER BY id');
    res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
