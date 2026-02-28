"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_1 = require("../whatsapp");
const db_1 = __importDefault(require("../db"));
const agent_1 = require("../agent");
const router = (0, express_1.Router)();
/**
 * POST /api/webhook/whatsapp
 * Main webhook endpoint for WhatsApp events
 *
 * Supports:
 * 1. Baileys-format messages (internal)
 * 2. External services (Twilio, WhatsApp Business API)
 * 3. Custom integrations
 */
router.post('/', async (req, res) => {
    try {
        const { From, // Sender phone number (Twilio format)
        Body, // Message text
        WaId, // WhatsApp ID
        ProfileName, // Sender profile name
        MediaUrl0, // Media URL
        SmsStatus, // Message status
        BusinessId, // Business ID (for multi-tenant)
        // Baileys-specific payload format
        baileys_message, business_id } = req.body;
        // Handle Baileys-format messages (internal fallback)
        if (baileys_message) {
            return handleBaileysMessage(req.body, res);
        }
        // Handle standard webhook format (Twilio/Other providers)
        if (!From || !Body) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['From', 'Body']
            });
        }
        const phoneNumber = From.replace('whatsapp:', '');
        const bizId = parseInt(BusinessId || business_id || '1');
        console.log(`[WhatsApp Webhook] Message from ${phoneNumber} to business ${bizId}: ${Body.substring(0, 50)}...`);
        // Find active session
        const employeeId = await getDefaultEmployeeId(bizId);
        const status = whatsapp_1.baileysManager.getStatus(bizId, employeeId);
        if (!status.connected) {
            console.warn(`[WhatsApp Webhook] No active session for business ${bizId}`);
            // Store for later processing
            await storePendingMessage(bizId, phoneNumber, Body, 'pending');
            return res.status(200).json({
                success: false,
                message: 'Message queued - WhatsApp not currently connected',
                queued: true
            });
        }
        // Process through AI agent
        try {
            const reply = await (0, agent_1.routeMessage)(Body, phoneNumber, 'whatsapp', bizId);
            // Send reply via WhatsApp
            await whatsapp_1.baileysManager.sendMessage(bizId, phoneNumber, reply);
            return res.status(200).json({
                success: true,
                message: 'Message processed and replied',
                reply: reply.substring(0, 100)
            });
        }
        catch (error) {
            console.error('[WhatsApp Webhook] Error processing message:', error);
            // Send error message
            try {
                await whatsapp_1.baileysManager.sendMessage(bizId, phoneNumber, "Sorry, I'm having trouble processing your message. Please try again.");
            }
            catch (sendError) {
                console.error('[WhatsApp Webhook] Failed to send error message:', sendError);
            }
            return res.status(500).json({
                success: false,
                error: 'Failed to process message'
            });
        }
    }
    catch (error) {
        console.error('[WhatsApp Webhook] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * POST /api/webhook/whatsapp/status
 * Handle message status updates (delivered, read, failed)
 */
router.post('/status', async (req, res) => {
    try {
        const { MessageSid, MessageStatus, ErrorCode, To, From } = req.body;
        console.log(`[WhatsApp Webhook] Status update for message ${MessageSid}: ${MessageStatus}`);
        // Update message status in database
        await db_1.default.query(`UPDATE whatsapp_messages 
       SET status = $1, 
           updated_at = NOW(),
           error_code = $2
       WHERE id = (
         SELECT id FROM whatsapp_messages 
         WHERE sender = $3 OR recipient = $4
         ORDER BY created_at DESC 
         LIMIT 1
       )`, [MessageStatus, ErrorCode, From, To]);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[WhatsApp Webhook] Status update error:', error);
        return res.status(500).json({ error: 'Failed to process status update' });
    }
});
/**
 * POST /api/webhook/whatsapp/incoming
 * Direct endpoint for incoming messages (alternative to main webhook)
 *
 * This can be used by external systems to inject messages directly
 */
router.post('/incoming', async (req, res) => {
    try {
        const { phone, message, business_id, media_urls, location } = req.body;
        if (!phone || !message || !business_id) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['phone', 'message', 'business_id']
            });
        }
        const bizId = parseInt(business_id);
        console.log(`[WhatsApp Webhook/Incoming] Message from ${phone} to business ${bizId}: ${message.substring(0, 50)}...`);
        // Check if WhatsApp is connected
        const employeeId = await getDefaultEmployeeId(bizId);
        const status = whatsapp_1.baileysManager.getStatus(bizId, employeeId);
        if (!status.connected) {
            return res.status(503).json({
                error: 'WhatsApp not connected',
                message: 'The business WhatsApp is not currently connected'
            });
        }
        // Save incoming message
        await db_1.default.query(`INSERT INTO whatsapp_messages 
       (business_id, sender, recipient, content, direction, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`, [bizId, phone, status.phoneNumber || 'bot', message, 'incoming', 'delivered']);
        // Process through AI
        const reply = await (0, agent_1.routeMessage)(message, phone, 'whatsapp', bizId);
        // Send reply
        await whatsapp_1.baileysManager.sendMessage(bizId, phone, reply);
        return res.status(200).json({
            success: true,
            reply: reply
        });
    }
    catch (error) {
        console.error('[WhatsApp Webhook/Incoming] Error:', error);
        return res.status(500).json({ error: 'Failed to process incoming message' });
    }
});
/**
 * GET /api/webhook/whatsapp/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'whatsapp-webhook',
        timestamp: new Date().toISOString(),
        activeSessions: whatsapp_1.baileysManager.getAllSessions().length
    });
});
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Handle messages in Baileys format (internal use)
 */
async function handleBaileysMessage(payload, res) {
    const { business_id, message, sender } = payload.baileys_message;
    try {
        const bizId = parseInt(business_id);
        // Process through AI agent
        const reply = await (0, agent_1.routeMessage)(message.text, sender, 'whatsapp', bizId);
        return res.status(200).json({
            success: true,
            processed: true,
            reply: reply.substring(0, 100)
        });
    }
    catch (error) {
        console.error('[WhatsApp Webhook] Baileys message error:', error);
        return res.status(500).json({ error: 'Failed to process Baileys message' });
    }
}
/**
 * Store a pending message when WhatsApp is not connected
 */
async function storePendingMessage(businessId, phoneNumber, message, status) {
    try {
        await db_1.default.query(`INSERT INTO whatsapp_messages 
       (business_id, sender, recipient, content, direction, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`, [businessId, phoneNumber, 'pending', message, 'incoming', status]);
    }
    catch (error) {
        console.error('[WhatsApp Webhook] Error storing pending message:', error);
    }
}
/**
 * Get default employee ID for a business
 */
async function getDefaultEmployeeId(businessId) {
    try {
        const result = await db_1.default.query(`SELECT employee_id 
       FROM business_employees 
       WHERE business_id = $1 AND is_active = true 
       ORDER BY hired_at ASC 
       LIMIT 1`, [businessId]);
        if (result.rows.length === 0) {
            return 1; // Default fallback
        }
        return result.rows[0].employee_id;
    }
    catch (error) {
        console.error('[WhatsApp Webhook] Error getting default employee:', error);
        return 1;
    }
}
exports.default = router;
//# sourceMappingURL=whatsapp-webhook.js.map