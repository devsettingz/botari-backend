import { Router } from 'express';
import { processMessage } from '../agent';   // ✅ fixed import

const router = Router();

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

      const reply = await processMessage(text);

      // TODO: Send reply back via WhatsApp API (Twilio or Meta)
      console.log(`Reply to ${from}: ${reply}`);
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

export default router;
