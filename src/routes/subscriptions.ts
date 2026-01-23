import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import pool from '../db';

const router = Router();

// Get current subscription
router.get('/current', authenticateJWT, async (req, res) => {
  const userId = (req as any).user?.id;          // 👈 bypass TS error
  const businessId = (req as any).user?.business_id;

  if (!userId || !businessId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [businessId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new subscription
router.post('/create', authenticateJWT, async (req, res) => {
  const userId = (req as any).user?.id;
  const businessId = (req as any).user?.business_id;
  const { plan } = req.body;

  if (!userId || !businessId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO subscriptions (business_id, user_id, plan, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [businessId, userId, plan]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateJWT, async (req, res) => {
  const userId = (req as any).user?.id;
  const businessId = (req as any).user?.business_id;

  if (!userId || !businessId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW()
       WHERE business_id = $1 AND user_id = $2
       RETURNING *`,
      [businessId, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
