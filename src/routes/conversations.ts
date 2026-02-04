import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { verifyToken } from '../middleware/verifyToken';

dotenv.config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET /api/conversations/list
router.get('/list', verifyToken, async (req: any, res: any) => {
  const businessId = req.userId;
  
  try {
    const result = await pool.query(
      `SELECT 
        c.id, 
        c.customer_name, 
        c.customer_phone,
        c.status,
        c.last_message_at,
        c.started_at,
        e.display_name as employee_name,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as preview
       FROM conversations c
       LEFT JOIN ai_employees e ON c.employee_id = e.id
       WHERE c.business_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [businessId]
    );
    
    res.json(result.rows);
  } catch (err: any) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// POST /api/conversations
router.post('/', verifyToken, async (req: any, res: any) => {
  const { customer_name, customer_phone, employee_id } = req.body;
  const businessId = req.userId;

  try {
    const result = await pool.query(
      `INSERT INTO conversations (business_id, customer_name, customer_phone, employee_id, status, started_at) 
       VALUES ($1, $2, $3, $4, 'open', NOW()) RETURNING id`,
      [businessId, customer_name, customer_phone, employee_id || 1]
    );

    res.status(201).json({ conversation_id: result.rows[0].id });
  } catch (err: any) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// PUT /api/conversations/:id/close
router.put('/:id/close', verifyToken, async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE conversations SET status = 'closed', closed_at = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ message: 'Conversation closed' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to close conversation' });
  }
});

export default router;