"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const verifyToken_1 = require("../middleware/verifyToken");
const requireRole_1 = require("../middleware/requireRole");
dotenv_1.default.config({ path: __dirname + '/../.env' });
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
// -------------------- Businesses --------------------
// List all businesses
router.get('/businesses', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, business_name, country, email FROM businesses ORDER BY id ASC`);
        res.json({ businesses: result.rows });
    }
    catch (err) {
        console.error('Admin businesses error:', err);
        res.status(500).json({ error: 'Failed to fetch businesses' });
    }
});
// Create a new business
router.post('/businesses', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { business_name, country, email } = req.body;
    if (!business_name || !country || !email) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const result = await pool.query(`INSERT INTO businesses (business_name, country, email) VALUES ($1, $2, $3) RETURNING id`, [business_name, country, email]);
        res.status(201).json({ business_id: result.rows[0].id });
    }
    catch (err) {
        console.error('Create business error:', err);
        res.status(500).json({ error: 'Failed to create business' });
    }
});
// Update a business
router.put('/businesses/:id', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { id } = req.params;
    const { business_name, country, email } = req.body;
    try {
        await pool.query(`UPDATE businesses SET business_name=$1, country=$2, email=$3 WHERE id=$4`, [business_name, country, email, id]);
        res.json({ message: 'Business updated successfully' });
    }
    catch (err) {
        console.error('Update business error:', err);
        res.status(500).json({ error: 'Failed to update business' });
    }
});
// Delete a business
router.delete('/businesses/:id', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM businesses WHERE id=$1`, [id]);
        res.json({ message: 'Business deleted successfully' });
    }
    catch (err) {
        console.error('Delete business error:', err);
        res.status(500).json({ error: 'Failed to delete business' });
    }
});
// -------------------- Users --------------------
// List all users
router.get('/users', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, business_id, name, email, role FROM users ORDER BY id ASC`);
        res.json({ users: result.rows });
    }
    catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Update user role
router.put('/users/:id/role', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!role)
        return res.status(400).json({ error: 'Role is required' });
    try {
        await pool.query(`UPDATE users SET role=$1 WHERE id=$2`, [role, id]);
        res.json({ message: 'User role updated successfully' });
    }
    catch (err) {
        console.error('Update user role error:', err);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});
// Delete a user
router.delete('/users/:id', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM users WHERE id=$1`, [id]);
        res.json({ message: 'User deleted successfully' });
    }
    catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
// -------------------- Subscriptions --------------------
// List all subscriptions
router.get('/subscriptions', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, business_id, plan, status, started_at, expires_at FROM subscriptions ORDER BY started_at DESC`);
        res.json({ subscriptions: result.rows });
    }
    catch (err) {
        console.error('Admin subscriptions error:', err);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});
// Create a subscription
router.post('/subscriptions', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { business_id, plan, status, started_at, expires_at } = req.body;
    if (!business_id || !plan || !status) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const result = await pool.query(`INSERT INTO subscriptions (business_id, plan, status, started_at, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [business_id, plan, status, started_at, expires_at]);
        res.status(201).json({ subscription_id: result.rows[0].id });
    }
    catch (err) {
        console.error('Create subscription error:', err);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});
// Update subscription
router.put('/subscriptions/:id', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { id } = req.params;
    const { plan, status, expires_at } = req.body;
    try {
        await pool.query(`UPDATE subscriptions SET plan=$1, status=$2, expires_at=$3 WHERE id=$4`, [plan, status, expires_at, id]);
        res.json({ message: 'Subscription updated successfully' });
    }
    catch (err) {
        console.error('Update subscription error:', err);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});
// Delete subscription
router.delete('/subscriptions/:id', verifyToken_1.verifyToken, (0, requireRole_1.requireRole)('owner'), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM subscriptions WHERE id=$1`, [id]);
        res.json({ message: 'Subscription deleted successfully' });
    }
    catch (err) {
        console.error('Delete subscription error:', err);
        res.status(500).json({ error: 'Failed to delete subscription' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map