import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import pool from '../db';

const router = Router();

// Helper to safely parse business_id
function getBusinessId(req: any): number | null {
  const raw = req.params.business_id;
  if (typeof raw === 'string') return parseInt(raw, 10);
  if (Array.isArray(raw)) return parseInt(raw[0], 10);
  return null;
}

// Weekly trends: messages
router.get('/:business_id/trends/messages/weekly', authenticateJWT, async (req, res) => {
  const user = (req as any).user;
  const businessId = getBusinessId(req);

  if (!businessId) return res.status(400).json({ error: 'Invalid business_id' });
  if (!user || user.business_id !== businessId) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await pool.query(
      `SELECT DATE_TRUNC('week', created_at) AS week, COUNT(*) AS messages
       FROM messages
       WHERE business_id = $1
       GROUP BY week
       ORDER BY week DESC
       LIMIT 8`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Weekly trends: conversations
router.get('/:business_id/trends/conversations/weekly', authenticateJWT, async (req, res) => {
  const user = (req as any).user;
  const businessId = getBusinessId(req);

  if (!businessId) return res.status(400).json({ error: 'Invalid business_id' });
  if (!user || user.business_id !== businessId) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await pool.query(
      `SELECT DATE_TRUNC('week', created_at) AS week, COUNT(*) AS conversations
       FROM conversations
       WHERE business_id = $1
       GROUP BY week
       ORDER BY week DESC
       LIMIT 8`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Summary stats
router.get('/:business_id/summary', authenticateJWT, async (req, res) => {
  const user = (req as any).user;
  const businessId = getBusinessId(req);

  if (!businessId) return res.status(400).json({ error: 'Invalid business_id' });
  if (!user || user.business_id !== businessId) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [messages, conversations, subscriptions] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM messages WHERE business_id = $1`, [businessId]),
      pool.query(`SELECT COUNT(*) FROM conversations WHERE business_id = $1`, [businessId]),
      pool.query(`SELECT COUNT(*) FROM subscriptions WHERE business_id = $1`, [businessId])
    ]);

    res.json({
      total_messages: messages.rows[0].count,
      total_conversations: conversations.rows[0].count,
      total_subscriptions: subscriptions.rows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Active users trend
router.get('/:business_id/trends/active-users/weekly', authenticateJWT, async (req, res) => {
  const user = (req as any).user;
  const businessId = getBusinessId(req);

  if (!businessId) return res.status(400).json({ error: 'Invalid business_id' });
  if (!user || user.business_id !== businessId) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await pool.query(
      `SELECT DATE_TRUNC('week', created_at) AS week, COUNT(DISTINCT user_id) AS active_users
       FROM messages
       WHERE business_id = $1
       GROUP BY week
       ORDER BY week DESC
       LIMIT 8`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Revenue trend
router.get('/:business_id/trends/revenue/weekly', authenticateJWT, async (req, res) => {
  const user = (req as any).user;
  const businessId = getBusinessId(req);

  if (!businessId) return res.status(400).json({ error: 'Invalid business_id' });
  if (!user || user.business_id !== businessId) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await pool.query(
      `SELECT DATE_TRUNC('week', created_at) AS week, SUM(amount) AS revenue
       FROM payments
       WHERE business_id = $1 AND status = 'success'
       GROUP BY week
       ORDER BY week DESC
       LIMIT 8`,
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
