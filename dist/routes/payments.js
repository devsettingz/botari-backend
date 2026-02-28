"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const verifyToken_1 = require("../middleware/verifyToken");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
// Debug: Log environment check on startup
console.log('Payments route loaded. Paystack key exists:', !!process.env.PAYSTACK_SECRET_KEY);
router.post('/initialize', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { employee_id, amount, email } = req.body;
        const businessId = req.user?.business_id || req.userId;
        console.log('Payment init started:', { employee_id, amount, businessId });
        // Validation
        if (!employee_id || !amount) {
            return res.status(400).json({ error: 'Missing employee_id or amount' });
        }
        if (!process.env.PAYSTACK_SECRET_KEY) {
            console.error('PAYSTACK_SECRET_KEY not configured');
            return res.status(500).json({ error: 'Payment gateway not configured' });
        }
        // Get employee
        const empResult = await db_1.default.query('SELECT * FROM ai_employees WHERE id = $1', [employee_id]);
        if (empResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const employee = empResult.rows[0];
        // Create subscription record
        let subscriptionId;
        try {
            const subResult = await db_1.default.query(`INSERT INTO subscriptions (business_id, employee_id, plan, status, amount, currency, provider) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`, [businessId, employee_id, 'monthly', 'pending', amount, 'NGN', 'paystack']);
            subscriptionId = subResult.rows[0].id;
            console.log('Subscription created:', subscriptionId);
        }
        catch (dbErr) {
            console.error('Database error creating subscription:', dbErr.message);
            return res.status(500).json({ error: 'Database error', details: dbErr.message });
        }
        // Call Paystack
        try {
            const paystackData = {
                email: email || req.user?.email || 'customer@business.com',
                amount: amount.toString(),
                metadata: {
                    subscription_id: subscriptionId,
                    business_id: businessId,
                    employee_id: employee_id,
                    employee_name: employee.display_name
                },
                callback_url: `https://botari-frontend.vercel.app/payment/verify`
            };
            console.log('Calling Paystack with:', paystackData);
            const response = await axios_1.default.post('https://api.paystack.co/transaction/initialize', paystackData, {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log('Paystack response:', response.data);
            if (response.data.status && response.data.data) {
                await db_1.default.query('UPDATE subscriptions SET provider_ref = $1 WHERE id = $2', [response.data.data.reference, subscriptionId]);
                return res.json({
                    authorization_url: response.data.data.authorization_url,
                    reference: response.data.data.reference,
                    subscription_id: subscriptionId
                });
            }
            else {
                throw new Error(response.data.message || 'Paystack returned invalid response');
            }
        }
        catch (paystackErr) {
            console.error('Paystack API error:', paystackErr.response?.data || paystackErr.message);
            await db_1.default.query("UPDATE subscriptions SET status = 'failed' WHERE id = $1", [subscriptionId]);
            return res.status(500).json({
                error: 'Paystack error',
                details: paystackErr.response?.data?.message || paystackErr.message
            });
        }
    }
    catch (err) {
        console.error('Unexpected payment error:', err);
        return res.status(500).json({ error: 'Payment initialization failed', details: err.message });
    }
});
// Verify payment
router.get('/verify/:reference', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { reference } = req.params;
        if (!reference) {
            return res.status(400).json({ error: 'No reference provided' });
        }
        const response = await axios_1.default.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        });
        const { data } = response.data;
        if (data.status === 'success') {
            const metadata = data.metadata;
            await db_1.default.query(`UPDATE subscriptions 
         SET status = 'active', activated_at = NOW(), expires_at = NOW() + INTERVAL '30 days'
         WHERE id = $1`, [metadata.subscription_id]);
            await db_1.default.query(`INSERT INTO payments (business_id, employee_id, amount, currency, provider, status, provider_ref, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                metadata.business_id,
                metadata.employee_id,
                data.amount,
                data.currency,
                'paystack',
                'completed',
                reference,
                JSON.stringify(data)
            ]);
            await db_1.default.query(`INSERT INTO business_employees (business_id, employee_id, is_active, hired_at, assigned_channel)
         VALUES ($1, $2, true, NOW(), 'whatsapp')
         ON CONFLICT (business_id, employee_id) 
         DO UPDATE SET is_active = true, updated_at = NOW()`, [metadata.business_id, metadata.employee_id]);
            return res.json({
                status: 'success',
                message: 'Payment successful! Employee activated.',
                employee_id: metadata.employee_id
            });
        }
        else {
            await db_1.default.query("UPDATE subscriptions SET status = 'failed' WHERE provider_ref = $1", [reference]);
            return res.status(400).json({
                status: 'failed',
                message: 'Payment verification failed'
            });
        }
    }
    catch (err) {
        console.error('Verification error:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Verification failed' });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map