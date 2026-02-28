/**
 * WhatsApp Webhook Handler
 *
 * This route handles incoming WhatsApp events from the Baileys connection.
 * It's used for:
 * - External webhook callbacks (Twilio, WhatsApp Business API)
 * - Status updates
 * - Fallback message handling
 * - Direct incoming message endpoint
 *
 * Note: Most incoming messages are handled directly by the BaileysManager class,
 * which processes them through the AI agent automatically.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=whatsapp-webhook.d.ts.map