"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Generic webhook handler for Stripe, Paystack, Flutterwave, etc.
router.post('/', async (req, res) => {
    try {
        const payload = req.body;
        let provider = 'unknown';
        if (payload.object === 'event' || payload.type?.startsWith('payment_intent')) {
            provider = 'stripe';
        }
        else if (payload.event === 'charge.success') {
            provider = 'paystack';
        }
        else if (payload.event === 'payment.completed') {
            provider = 'flutterwave';
        }
        let userId = null;
        let businessId = null;
        let amount = 0;
        let currency = 'USD';
        let status = 'failed';
        if (provider === 'stripe') {
            amount = payload.data.object.amount_received / 100;
            currency = payload.data.object.currency.toUpperCase();
            status = payload.data.object.status === 'succeeded' ? 'success' : 'failed';
            userId = payload.data.object.metadata?.user_id ? parseInt(payload.data.object.metadata.user_id) : null;
            businessId = payload.data.object.metadata?.business_id ? parseInt(payload.data.object.metadata.business_id) : null;
        }
        else if (provider === 'paystack') {
            amount = payload.data.amount / 100;
            currency = payload.data.currency;
            status = payload.data.status;
            userId = payload.data.metadata?.user_id ? parseInt(payload.data.metadata.user_id) : null;
            businessId = payload.data.metadata?.business_id ? parseInt(payload.data.metadata.business_id) : null;
        }
        else if (provider === 'flutterwave') {
            amount = payload.data.amount;
            currency = payload.data.currency;
            status = payload.data.status;
            userId = payload.data.meta?.user_id ? parseInt(payload.data.meta.user_id) : null;
            businessId = payload.data.meta?.business_id ? parseInt(payload.data.meta.business_id) : null;
        }
        const result = await db_1.default.query(`INSERT INTO payments (business_id, user_id, amount, currency, provider, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [businessId, userId, amount, currency, provider, status]);
        if (status === 'success' && businessId) {
            await db_1.default.query(`INSERT INTO subscriptions (business_id, user_id, plan, status, started_at, expires_at)
         VALUES ($1, $2, 'pro', 'active', NOW(), NOW() + interval '30 days')
         ON CONFLICT (business_id, user_id)
         DO UPDATE SET status = 'active', updated_at = NOW(), expires_at = NOW() + interval '30 days'`, [businessId, userId]);
        }
        console.log(`✅ Payment logged for provider ${provider}:`, result.rows[0]);
        res.sendStatus(200);
    }
    catch (err) {
        console.error('Payment webhook error:', err);
        res.sendStatus(500);
    }
});
exports.default = router;
//# sourceMappingURL=payments-webhook.js.map