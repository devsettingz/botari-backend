"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const agent_1 = require("../agent"); // ✅ Changed to routeMessage
const verifyToken_1 = require("../middleware/verifyToken");
dotenv_1.default.config({ path: __dirname + '/../.env' });
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
// Save + reply to a message (protected)
router.post('/', verifyToken_1.verifyToken, async (req, res) => {
    const { conversation_id, sender, text } = req.body;
    const businessId = req.userId || 1; // ✅ Get businessId from token
    if (!conversation_id || !sender || !text) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        await pool.query(`INSERT INTO messages (conversation_id, sender, text) VALUES ($1, $2, $3)`, [conversation_id, sender, text]);
        // ✅ Fixed: Use routeMessage with 4 arguments + await
        const replyText = await (0, agent_1.routeMessage)(text, sender, 'web', businessId);
        await pool.query(`INSERT INTO messages (conversation_id, sender, text) VALUES ($1, $2, $3)`, [conversation_id, 'botari', replyText]);
        res.json({ reply: replyText });
    }
    catch (err) {
        console.error('Message error:', err);
        res.status(500).json({ error: 'Message failed' });
    }
});
exports.default = router;
//# sourceMappingURL=messages.js.map