"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelegramUpdate = handleTelegramUpdate;
const node_fetch_1 = __importDefault(require("node-fetch"));
const agent_1 = require("../agent"); // ✅ Changed to routeMessage
async function handleTelegramUpdate(update) {
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
        const reply = await (0, agent_1.routeMessage)(text, chatId.toString(), 'telegram', 1);
        await (0, node_fetch_1.default)(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: reply })
        });
        console.log(`🤖 Reply sent to Telegram chat ${chatId}: ${reply}`);
    }
}
//# sourceMappingURL=telegram.js.map