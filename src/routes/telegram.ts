import { Router } from 'express';
import fetch from 'node-fetch';
import { processMessage } from '../../../botari-agent/src/index';

const router = Router();
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text =
        update.message.text ||
        update.message.caption || // handle photo captions
        '';

      if (text.trim()) {
        console.log(`📩 Telegram message from ${chatId}: ${text}`);

        const reply = await processMessage(text);

        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: reply })
        });

        console.log(`🤖 Reply sent to Telegram chat ${chatId}: ${reply}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error handling Telegram update:', err);
    res.sendStatus(500);
  }
});

export default router;
