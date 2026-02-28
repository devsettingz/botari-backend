/**
 * WhatsApp API Routes
 *
 * Endpoints for WhatsApp connection management using Baileys:
 * - POST /api/whatsapp/connect - Generate QR and start Baileys connection
 * - GET /api/whatsapp/status - Get connection status
 * - POST /api/whatsapp/disconnect - Disconnect session
 * - POST /api/whatsapp/send - Send message endpoint
 * - GET /api/whatsapp/qr - Get current QR code
 * - POST /api/whatsapp/broadcast - Send message to multiple recipients
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=whatsapp.d.ts.map