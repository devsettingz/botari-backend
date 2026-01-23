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

// Get all conversations for a business (protected)
router.get('/:business_id', verifyToken, async (req, res) => {
  const { business_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, customer_name, started_at, status 
       FROM conversations 
       WHERE business_id = $1 
       ORDER BY started_at DESC`,
      [business_id]
    );

    res.json({ conversations: result.rows });
  } catch (err: any) {
    console.error('Fetch conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

export default router;
