"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Get current subscription
router.get('/current', auth_1.authenticateJWT, async (req, res) => {
    const userId = req.user?.id; // 👈 bypass TS error
    const businessId = req.user?.business_id;
    if (!userId || !businessId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const result = await db_1.default.query(`SELECT * FROM subscriptions WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1`, [businessId]);
        res.json(result.rows[0] || {});
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});
// Create new subscription
router.post('/create', auth_1.authenticateJWT, async (req, res) => {
    const userId = req.user?.id;
    const businessId = req.user?.business_id;
    const { plan } = req.body;
    if (!userId || !businessId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const result = await db_1.default.query(`INSERT INTO subscriptions (business_id, user_id, plan, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`, [businessId, userId, plan]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});
// Cancel subscription
router.post('/cancel', auth_1.authenticateJWT, async (req, res) => {
    const userId = req.user?.id;
    const businessId = req.user?.business_id;
    if (!userId || !businessId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const result = await db_1.default.query(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW()
       WHERE business_id = $1 AND user_id = $2
       RETURNING *`, [businessId, userId]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=subscriptions.js.map