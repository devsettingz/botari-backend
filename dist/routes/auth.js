"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';
// Database pool - SINGLE INSTANCE
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
// Test database connection
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});
// REGISTER
router.post('/register', async (req, res) => {
    console.log('Registration request received:', req.body);
    const { business_name, country, email, password, name, phone } = req.body;
    console.log('Registration attempt:', { business_name, country, email, name, phone });
    // Validation
    if (!business_name || !country || !email || !password || !name) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['business_name', 'country', 'email', 'password', 'name'],
            received: { business_name, country, email, name, phone }
        });
    }
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    // Password validation (min 6 characters)
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Insert business (using 'name' column, not 'business_name')
        const businessResult = await pool.query(`INSERT INTO businesses (name, email, phone, country) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name`, [business_name, email, phone || null, country]);
        const business_id = businessResult.rows[0].id;
        const business_name_returned = businessResult.rows[0].name;
        // Insert user
        const userResult = await pool.query(`INSERT INTO users (business_id, name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email`, [business_id, name, email, hashedPassword, 'owner']);
        const user = userResult.rows[0];
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ user_id: user.id, business_id: business_id, role: 'owner' }, JWT_SECRET, { expiresIn: '7d' });
        console.log('Registration successful:', { business_id, email: user.email });
        // Return data for frontend
        res.status(201).json({
            message: 'Registration successful',
            token,
            business_id: business_id,
            business_name: business_name_returned,
            email: user.email,
            name: user.name
        });
    }
    catch (err) {
        console.error('Registration error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        if (err.code === 'ECONNREFUSED' || err.code === '28P01') {
            return res.status(500).json({ error: 'Database connection failed' });
        }
        res.status(500).json({
            error: 'Registration failed. Please try again.',
            details: err.message,
            code: err.code
        });
    }
});
// LOGIN
router.post('/login', async (req, res) => {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;
    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        console.log('Querying database for user:', email);
        const userResult = await pool.query(`SELECT u.*, b.name as business_name 
       FROM users u
       JOIN businesses b ON u.business_id = b.id
       WHERE u.email = $1`, [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const user = userResult.rows[0];
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = jsonwebtoken_1.default.sign({ user_id: user.id, business_id: user.business_id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                business_id: user.business_id,
                role: user.role,
                email: user.email,
                name: user.name,
                business_name: user.business_name
            }
        });
    }
    catch (err) {
        console.error('Login error details:', err.message, err.code, err.stack);
        res.status(500).json({ error: 'Login failed', details: err.message, code: err.code });
    }
});
// GET /api/auth/test - Test endpoint (no auth required)
router.get('/test', (req, res) => {
    res.json({
        message: 'Auth routes are working!',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /api/auth/register',
            'POST /api/auth/login'
        ]
    });
});
exports.default = router;
//# sourceMappingURL=auth.js.map