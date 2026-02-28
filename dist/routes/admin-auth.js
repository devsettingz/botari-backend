"use strict";
/**
 * Admin Authentication Routes
 * Separate from regular business auth
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';
// Admin credentials from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@botari.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
/**
 * POST /api/admin/auth/login
 * Admin login - checks against env variables
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Admin login attempt:', email);
    // Validation
    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password required'
        });
    }
    // Check credentials against env variables
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        console.log('Invalid admin credentials');
        return res.status(401).json({
            error: 'Invalid credentials'
        });
    }
    // Generate JWT with admin role
    const token = jsonwebtoken_1.default.sign({
        user_id: 'admin',
        email: ADMIN_EMAIL,
        role: 'admin',
        name: 'Platform Admin'
    }, JWT_SECRET, { expiresIn: '7d' });
    console.log('Admin login successful');
    res.json({
        success: true,
        token,
        user: {
            id: 'admin',
            email: ADMIN_EMAIL,
            name: 'Platform Admin',
            role: 'admin'
        }
    });
});
/**
 * GET /api/admin/auth/me
 * Verify admin token
 */
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Not an admin' });
        }
        res.json({
            user: {
                id: decoded.user_id,
                email: decoded.email,
                name: decoded.name,
                role: 'admin'
            }
        });
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});
exports.default = router;
//# sourceMappingURL=admin-auth.js.map