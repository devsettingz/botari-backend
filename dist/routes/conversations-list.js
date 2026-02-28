"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const verifyToken_1 = require("../middleware/verifyToken"); // ✅ add middleware
dotenv_1.default.config({ path: __dirname + '/../.env' });
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
// Get all conversations for a business (protected)
router.get('/:business_id', verifyToken_1.verifyToken, async (req, res) => {
    const { business_id } = req.params;
    try {
        const result = await pool.query(`SELECT id, customer_name, started_at, status 
       FROM conversations 
       WHERE business_id = $1 
       ORDER BY started_at DESC`, [business_id]);
        res.json({ conversations: result.rows });
    }
    catch (err) {
        console.error('Fetch conversations error:', err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});
exports.default = router;
//# sourceMappingURL=conversations-list.js.map