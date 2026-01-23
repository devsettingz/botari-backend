import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { verifyToken } from '../middleware/verifyToken'; // ✅ add middleware

dotenv.config({ path: __dirname + '/../.env' });

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Get all messages for a conversation (protected)
router.get('/:conversation_id', verifyToken, async (req, res) => {
  const { conversation_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, sender, text, created_at 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversation_id]
    );

    res.json({ messages: result.rows });
  } catch (err: any) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
