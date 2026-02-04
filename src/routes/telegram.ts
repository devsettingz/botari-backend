import { Router } from 'express';
import fetch from 'node-fetch';
import { routeMessage } from '../agent';   // ✅ Changed to routeMessage

const router = Router();
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || update.message.caption || '';

      if (text.trim()) {
        console.log(`📩 Telegram message from ${chatId}: ${text}`);

        // ✅ Fixed: Use routeMessage with 4 arguments like whatsapp.ts
        const reply = await routeMessage(text, chatId.toString(), 'telegram', 1);

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