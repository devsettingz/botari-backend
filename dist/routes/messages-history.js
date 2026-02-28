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
// Get all messages for a conversation (protected)
router.get('/:conversation_id', verifyToken_1.verifyToken, async (req, res) => {
    const { conversation_id } = req.params;
    try {
        const result = await pool.query(`SELECT id, sender, text, created_at 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`, [conversation_id]);
        res.json({ messages: result.rows });
    }
    catch (err) {
        console.error('Fetch messages error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
exports.default = router;
//# sourceMappingURL=messages-history.js.map