import fetch from 'node-fetch';
import { routeMessage } from '../agent';   // ✅ Changed to routeMessage

export async function handleTelegramUpdate(update: any) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  if (!TELEGRAM_TOKEN) {
    console.error('Missing TELEGRAM_TOKEN in environment');
    return;
  }

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || update.message.caption || '';

    console.log(`📩 Telegram message from ${chatId}: ${text}`);

    // ✅ Fixed: Use routeMessage with 4 arguments
    const reply = await routeMessage(text, chatId.toString(), 'telegram', 1);

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: reply })
    });

    console.log(`🤖 Reply sent to Telegram chat ${chatId}: ${reply}`);
  }
}