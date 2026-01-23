import { Router } from 'express';
import pool from '../db';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Record a new payment
router.post('/', authenticateJWT, async (req, res) => {
  const { amount, currency, provider, status } = req.body;
  const userId = req.user?.id;
  const businessId = req.user?.business_id;

  if (!userId || !businessId) {
    return res.status(401).json({ error: 'Unauthorized or missing user context' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payments (business_id, user_id, amount, currency, provider, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [businessId, userId, amount, currency || 'USD', provider, status]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Payment insert error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Get payment history
router.get('/history', authenticateJWT, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Payment history error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;
