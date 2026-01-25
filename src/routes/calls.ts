import { Router } from 'express';
import { makeCall } from '../services/vonage';

const router = Router();

/**
 * POST /api/calls
 * Body: { to: string, text: string, voice: 'male' | 'female' }
 */
router.post('/', async (req, res) => {
  const { to, text, voice } = req.body;

  if (!to || !text || !voice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await makeCall(to, text, voice);
    res.json({ status: 'success', result });
  } catch (err: any) {
    console.error('Error making call:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
