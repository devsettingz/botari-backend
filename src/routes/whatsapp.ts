import { Router } from 'express';
import { processMessage } from '../agent';
import { verifyToken } from '../middleware/verifyToken';

const router = Router();

// POST /api/whatsapp/connect - Start WhatsApp connection
router.post('/connect', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId;
    console.log('WhatsApp connection requested for business:', businessId);
    
    res.status(501).json({ 
      error: 'WhatsApp integration coming Thursday! Contact support@botari.ai to get early access.',
      status: 'coming_soon'
    });
  } catch (err: any) {
    console.error('WhatsApp connect error:', err);
    res.status(500).json({ error: 'Failed to start WhatsApp connection' });
  }
});

// GET /api/whatsapp/status - Check WhatsApp connection status
router.get('/status', verifyToken, async (req: any, res: any) => {
  try {
    res.json({ 
      connected: false,
      status: 'disconnected',
      message: 'WhatsApp not connected. Feature launches Thursday!'
    });
  } catch (err: any) {
    console.error('WhatsApp status error:', err);
    res.status(500).json({ error: 'Failed to check WhatsApp status' });
  }
});

// Webhook verification (for WhatsApp Business API)
router.get('/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Incoming message handler
router.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      console.log(`WhatsApp message from ${from}: ${text}`);

      try {
        // @ts-ignore - Local and Render have different signatures. Render expects 1 arg.
        const reply = await processMessage({ message: text });
        console.log(`Reply to ${from}: ${reply}`);
        
        // TODO: Send reply back via WhatsApp API
      } catch (err) {
        console.error('Error processing message:', err);
      }
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

export default router;