import express from 'express';

const router = express.Router();

// Hardcoded AI employees - NO DATABASE NEEDED
const aiEmployees = [
  {
    id: 1,
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
    is_active: true
  },
  {
    id: 2,
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
    is_active: true
  },
  {
    id: 3,
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
    is_active: true
  },
  {
    id: 4,
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
    is_active: true
  }
];

// Get all AI employees
router.get('/', (req, res) => {
  console.log('[SimpleEmployees] Fetching all employees');
  res.json(aiEmployees);
});

// Get single employee
router.get('/:id', (req, res) => {
  const employee = aiEmployees.find(e => e.id === parseInt(req.params.id));
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }
  res.json(employee);
});

export default router;
