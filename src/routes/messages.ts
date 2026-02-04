import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { routeMessage } from '../agent';   // ✅ Changed to routeMessage
import { verifyToken } from '../middleware/verifyToken';

dotenv.config({ path: __dirname + '/../.env' });

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Save + reply to a message (protected)
router.post('/', verifyToken, async (req: any, res: any) => {
  const { conversation_id, sender, text } = req.body;
  const businessId = req.userId || 1;  // ✅ Get businessId from token

  if (!conversation_id || !sender || !text) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    await pool.query(
      `INSERT INTO messages (conversation_id, sender, text) VALUES ($1, $2, $3)`,
      [conversation_id, sender, text]
    );

    // ✅ Fixed: Use routeMessage with 4 arguments + await
    const replyText = await routeMessage(text, sender, 'web', businessId);

    await pool.query(
      `INSERT INTO messages (conversation_id, sender, text) VALUES ($1, $2, $3)`,
      [conversation_id, 'botari', replyText]
    );

    res.json({ reply: replyText });
  } catch (err: any) {
    console.error('Message error:', err);
    res.status(500).json({ error: 'Message failed' });
  }
});

export default router;