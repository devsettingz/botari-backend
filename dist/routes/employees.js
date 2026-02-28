"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Get available employees (marketplace) - WITH FEATURES, COLORS, TIER
router.get('/', async (req, res) => {
    try {
        const result = await db_1.default.query(`
      SELECT 
        id, name, display_name, employee_role, description, 
        price_monthly, assigned_channel, is_active, color_theme, 
        tier, icon_emoji, features
      FROM ai_employees 
      WHERE is_active = true
      ORDER BY price_monthly ASC
    `);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});
// Get MY HIRED TEAM - WITH FEATURES, COLORS, TIER, ICONS
router.get('/my-team', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const businessId = req.userId || req.user?.business_id;
        if (!businessId) {
            return res.status(401).json({ error: 'No business ID' });
        }
        console.log(`Fetching team for business: ${businessId}`);
        const result = await db_1.default.query(`SELECT 
        be.id,
        ae.id as employee_id,
        ae.name,
        ae.display_name,
        ae.employee_role,
        ae.description,
        ae.price_monthly,
        ae.assigned_channel,
        ae.features,
        ae.color_theme,
        ae.tier,
        ae.icon_emoji,
        COALESCE(be.connection_status, 'disconnected') as connection_status,
        be.whatsapp_number,
        COALESCE(be.is_active, true) as is_active,
        be.hired_at,
        be.messages_processed,
        be.last_active
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 AND be.is_active = true
       ORDER BY be.hired_at DESC`, [businessId]);
        console.log(`SUCCESS: Found ${result.rows.length} employees`);
        res.json(result.rows);
    }
    catch (err) {
        console.error('DATABASE ERROR in /my-team:', err.message);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});
// Hire employee after payment
router.post('/hire', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const businessId = req.userId || req.user?.business_id;
        const { employee_id } = req.body;
        if (!businessId || !employee_id) {
            return res.status(400).json({ error: 'Business ID and Employee ID required' });
        }
        console.log(`Hiring employee ${employee_id} for business ${businessId}`);
        await db_1.default.query(`INSERT INTO business_employees 
       (business_id, employee_id, is_active, connection_status, hired_at, updated_at)
       VALUES ($1, $2, true, 'disconnected', NOW(), NOW())
       ON CONFLICT (business_id, employee_id) 
       DO UPDATE SET is_active = true, updated_at = NOW()`, [businessId, employee_id]);
        res.json({ success: true, message: 'Employee hired successfully' });
    }
    catch (err) {
        console.error('HIRE ERROR:', err.message);
        res.status(500).json({ error: 'Failed to hire employee', details: err.message });
    }
});
// Payment history
router.get('/payments/history', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const businessId = req.userId || req.user?.business_id;
        const result = await db_1.default.query(`SELECT p.*, ae.display_name as employee_name, ae.icon_emoji 
       FROM payments p 
       LEFT JOIN ai_employees ae ON p.employee_id = ae.id 
       WHERE p.business_id = $1 
       ORDER BY p.created_at DESC`, [businessId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});
exports.default = router;
//# sourceMappingURL=employees.js.map