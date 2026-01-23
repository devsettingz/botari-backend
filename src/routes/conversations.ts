import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { verifyToken } from '../middleware/verifyToken';

dotenv.config({ path: __dirname + '/../.env' });

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create a new conversation (protected)
router.post('/', verifyToken, async (req, res) => {
  const { business_id, customer_name } = req.body;

  if (!business_id || !customer_name) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO conversations (business_id, customer_name, status, started_at) 
       VALUES ($1, $2, 'open', NOW()) RETURNING id`,
      [business_id, customer_name]
    );

    res.status(201).json({ conversation_id: result.rows[0].id });
  } catch (err: any) {
    console.error('Conversation error:', err);
    res.status(500).json({ error: 'Conversation creation failed' });
  }
});

// Close a conversation (protected)
router.put('/:id/close', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE conversations 
       SET status = 'closed', closed_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Conversation closed successfully' });
  } catch (err: any) {
    console.error('Close conversation error:', err);
    res.status(500).json({ error: 'Failed to close conversation' });
  }
});

// Reopen a conversation (protected)
router.put('/:id/reopen', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE conversations 
       SET status = 'open', closed_at = NULL 
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Conversation reopened successfully' });
  } catch (err: any) {
    console.error('Reopen conversation error:', err);
    res.status(500).json({ error: 'Failed to reopen conversation' });
  }
});

export default router;
