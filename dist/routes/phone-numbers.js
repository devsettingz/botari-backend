"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pg_1 = require("pg");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';
// Database connection
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
// Get available countries for numbers
router.get('/countries', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM available_countries WHERE is_available = true ORDER BY country_name');
        res.json({ countries: result.rows });
    }
    catch (error) {
        console.error('[PhoneNumbers] Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});
// Get available numbers in a country (mock - in production would call Vonage API)
router.get('/available/:countryCode', verifyToken, async (req, res) => {
    const { countryCode } = req.params;
    try {
        // In production, this would call Vonage API to search for available numbers
        // For now, return mock available numbers
        const mockNumbers = [
            { number: `+${countryCode === 'US' ? '1' : '234'}5550100`, type: 'Mobile', features: ['voice', 'sms'] },
            { number: `+${countryCode === 'US' ? '1' : '234'}5550101`, type: 'Landline', features: ['voice'] },
            { number: `+${countryCode === 'US' ? '1' : '234'}5550102`, type: 'Mobile', features: ['voice', 'sms'] },
            { number: `+${countryCode === 'US' ? '1' : '234'}5550103`, type: 'Toll-free', features: ['voice'] },
        ];
        res.json({ numbers: mockNumbers });
    }
    catch (error) {
        console.error('[PhoneNumbers] Error fetching available numbers:', error);
        res.status(500).json({ error: 'Failed to fetch available numbers' });
    }
});
// Get all phone numbers for a business
router.get('/business/:businessId', verifyToken, async (req, res) => {
    const { businessId } = req.params;
    try {
        const result = await pool.query(`SELECT pn.*, e.display_name as employee_name
       FROM phone_numbers pn
       LEFT JOIN ai_employees e ON pn.employee_id = e.id
       WHERE pn.business_id = $1
       ORDER BY pn.is_default DESC, pn.created_at DESC`, [businessId]);
        res.json({ numbers: result.rows });
    }
    catch (error) {
        console.error('[PhoneNumbers] Error fetching business numbers:', error);
        res.status(500).json({ error: 'Failed to fetch numbers' });
    }
});
// Purchase/assign a new number
router.post('/purchase', verifyToken, async (req, res) => {
    const { business_id, employee_id, phone_number, country_code, country_name } = req.body;
    try {
        // In production, this would:
        // 1. Call Vonage API to purchase the number
        // 2. Link it to the application
        // 3. Store in database
        // Check if number already exists
        const existing = await pool.query('SELECT id FROM phone_numbers WHERE phone_number = $1', [phone_number]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Number already assigned' });
        }
        // Insert new number
        const result = await pool.query(`INSERT INTO phone_numbers (business_id, employee_id, phone_number, country_code, country_name, is_active, is_default, monthly_cost)
       VALUES ($1, $2, $3, $4, $5, true, false, 1.00)
       RETURNING *`, [business_id, employee_id, phone_number, country_code, country_name]);
        res.json({
            success: true,
            message: 'Number purchased successfully',
            number: result.rows[0]
        });
    }
    catch (error) {
        console.error('[PhoneNumbers] Error purchasing number:', error);
        res.status(500).json({ error: 'Failed to purchase number' });
    }
});
// Set default number for business
router.put('/:id/set-default', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { business_id } = req.body;
    try {
        // Remove default from all other numbers for this business
        await pool.query('UPDATE phone_numbers SET is_default = false WHERE business_id = $1', [business_id]);
        // Set new default
        const result = await pool.query('UPDATE phone_numbers SET is_default = true WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Number not found' });
        }
        res.json({ success: true, number: result.rows[0] });
    }
    catch (error) {
        console.error('[PhoneNumbers] Error setting default:', error);
        res.status(500).json({ error: 'Failed to set default' });
    }
});
// Release/delete a number
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        // In production, this would also call Vonage API to cancel the number
        await pool.query('DELETE FROM phone_numbers WHERE id = $1', [id]);
        res.json({ success: true, message: 'Number released' });
    }
    catch (error) {
        console.error('[PhoneNumbers] Error releasing number:', error);
        res.status(500).json({ error: 'Failed to release number' });
    }
});
// Webhook to handle incoming calls - routes to correct business based on called number
router.post('/webhook/inbound', async (req, res) => {
    const { to, from, uuid } = req.body;
    try {
        // Find which business owns this number
        const result = await pool.query(`SELECT pn.*, b.name as business_name, e.id as employee_id, e.name as employee_name
       FROM phone_numbers pn
       JOIN businesses b ON pn.business_id = b.id
       JOIN ai_employees e ON pn.employee_id = e.id
       WHERE pn.phone_number = $1 AND pn.is_active = true`, [to]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Number not assigned' });
        }
        const numberInfo = result.rows[0];
        // Return NCCO (Call Control Object) for Vonage
        const ncco = [
            {
                action: 'talk',
                text: `Hello, you've reached ${numberInfo.business_name}. This is ${numberInfo.employee_name}. How may I help you today?`,
                voiceName: 'Amy',
                bargeIn: true
            },
            {
                action: 'input',
                type: ['speech'],
                speech: {
                    uuid: [uuid],
                    endOnSilence: 2,
                    language: 'en-US'
                },
                eventUrl: [`${process.env.BACKEND_URL}/api/phone-numbers/webhook/input`]
            }
        ];
        res.json(ncco);
    }
    catch (error) {
        console.error('[PhoneNumbers] Webhook error:', error);
        res.status(500).json([{ action: 'talk', text: 'Sorry, we are experiencing technical difficulties.' }]);
    }
});
exports.default = router;
//# sourceMappingURL=phone-numbers.js.map