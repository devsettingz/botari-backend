"use strict";
/**
 * Voice Webhook Routes
 * Botari AI - Vonage Webhook Endpoints
 *
 * These endpoints handle all Vonage voice webhooks:
 * - answer_url: Initial call answering
 * - event_url: Call status updates
 * - input: Speech and DTMF input
 * - recording: Recording callbacks
 * - voicemail: Voicemail recordings
 * - transfer: Call transfer events
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WebhookHandler_1 = require("../voice/WebhookHandler");
const router = (0, express_1.Router)();
/**
 * GET /api/voice/webhook/answer
 * Vonage answer_url webhook - called when a call is answered
 *
 * Query params:
 * - businessId: Optional business ID for outbound calls
 *
 * Vonage sends:
 * {
 *   "from": " caller_number",
 *   "to": "called_number",
 *   "uuid": "call_uuid",
 *   "conversation_uuid": "conversation_uuid",
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/answer', async (req, res) => {
    await (0, WebhookHandler_1.handleAnswerWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/answer
 * Alternative POST method for answer_url
 */
router.post('/answer', async (req, res) => {
    await (0, WebhookHandler_1.handleAnswerWebhook)(req, res);
});
/**
 * GET /api/voice/webhook/answer/:businessId
 * Answer webhook with specific business ID
 */
router.get('/answer/:businessId', async (req, res) => {
    await (0, WebhookHandler_1.handleAnswerWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/answer/:businessId
 * Answer webhook with specific business ID
 */
router.post('/answer/:businessId', async (req, res) => {
    await (0, WebhookHandler_1.handleAnswerWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/event/:callId
 * Vonage event_url webhook - call status updates
 *
 * Vonage sends status updates:
 * {
 *   "status": "started|ringing|answered|completed|busy|cancelled|failed",
 *   "direction": "inbound|outbound",
 *   "from": "caller_number",
 *   "to": "called_number",
 *   "uuid": "call_uuid",
 *   "conversation_uuid": "conversation_uuid",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "duration": "call_duration_in_seconds",
 *   "price": "call_cost",
 *   "recording_url": "url_if_recorded"
 * }
 */
router.post('/event/:callId', async (req, res) => {
    await (0, WebhookHandler_1.handleEventWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/event
 * Generic event webhook without call ID
 */
router.post('/event', async (req, res) => {
    console.log('📊 Generic event webhook:', req.body);
    // Try to extract call ID from uuid
    const { uuid } = req.body;
    if (uuid) {
        // Look up call by UUID
        const { getCallSession } = await Promise.resolve().then(() => __importStar(require('../voice/CallManager')));
        const session = getCallSession(uuid);
        if (session) {
            req.params.callId = session.callId.toString();
            await (0, WebhookHandler_1.handleEventWebhook)(req, res);
            return;
        }
    }
    res.sendStatus(200);
});
/**
 * POST /api/voice/webhook/input/:callId
 * Vonage input webhook - speech and DTMF input
 *
 * Vonage sends:
 * {
 *   "speech": {
 *     "results": [
 *       {
 *         "text": "recognized speech",
 *         "confidence": "0.95"
 *       }
 *     ],
 *     "timeout_reason": "end_on_silence_timeout"
 *   },
 *   "dtmf": {
 *     "digits": "1234",
 *     "timed_out": false
 *   },
 *   "from": "caller_number",
 *   "to": "called_number",
 *   "uuid": "call_uuid",
 *   "conversation_uuid": "conversation_uuid",
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
router.post('/input/:callId', async (req, res) => {
    await (0, WebhookHandler_1.handleInputWebhook)(req, res);
});
/**
 * GET /api/voice/webhook/input/:callId
 * Alternative GET method for input webhook
 */
router.get('/input/:callId', async (req, res) => {
    await (0, WebhookHandler_1.handleInputWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/recording/:callId
 * Vonage recording webhook - recording completed
 *
 * Vonage sends:
 * {
 *   "recording_url": "https://api.nexmo.com/media/download?id=...",
 *   "recording_uuid": "recording_uuid",
 *   "start_time": "2024-01-01T00:00:00.000Z",
 *   "end_time": "2024-01-01T00:01:00.000Z",
 *   "duration": "60",
 *   "conversation_uuid": "conversation_uuid",
 *   "uuid": "call_uuid"
 * }
 */
router.post('/recording/:callId', async (req, res) => {
    await (0, WebhookHandler_1.handleRecordingWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/voicemail/:callId
 * Voicemail recording webhook
 */
router.post('/voicemail/:callId', async (req, res) => {
    await (0, WebhookHandler_1.handleVoicemailWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/transfer/:callId
 * Call transfer event webhook
 *
 * Vonage sends:
 * {
 *   "status": "answered|completed|timeout",
 *   "uuid": "call_uuid",
 *   "from": "original_caller",
 *   "to": "transfer_target",
 *   "duration": "call_duration"
 * }
 */
router.post('/transfer/:callId', async (req, res) => {
    await (0, WebhookHandler_1.handleTransferWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/machine-detection
 * Machine detection webhook
 *
 * Vonage sends:
 * {
 *   "status": "human|machine|unknown",
 *   "uuid": "call_uuid",
 *   "callId": "optional_call_id"
 * }
 */
router.post('/machine-detection', async (req, res) => {
    await (0, WebhookHandler_1.handleMachineDetectionWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/fallback
 * Fallback webhook for failed requests
 */
router.post('/fallback', (req, res) => {
    (0, WebhookHandler_1.handleFallbackWebhook)(req, res);
});
/**
 * GET /api/voice/webhook/fallback
 * Fallback webhook GET method
 */
router.get('/fallback', (req, res) => {
    (0, WebhookHandler_1.handleFallbackWebhook)(req, res);
});
/**
 * POST /api/voice/webhook/ncco
 * Generate NCCO dynamically based on request
 *
 * Request body:
 * {
 *   "action": "talk|input|record|connect|conversation",
 *   "parameters": { ... }
 * }
 */
router.post('/ncco', (req, res) => {
    try {
        const { action, parameters } = req.body;
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        let ncco = [];
        switch (action) {
            case 'talk':
                ncco = [{
                        action: 'talk',
                        text: parameters.text || 'Hello',
                        voiceName: parameters.voiceName || 'Joey',
                        language: parameters.language || 'en-US',
                        premium: parameters.premium || false,
                    }];
                break;
            case 'input':
                ncco = [{
                        action: 'input',
                        eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${parameters.callId || 0}`],
                        speech: {
                            language: parameters.language || 'en-US',
                            endOnSilence: parameters.endOnSilence || 3,
                        },
                        type: ['speech'],
                    }];
                break;
            case 'record':
                ncco = [{
                        action: 'record',
                        eventUrl: [`${webhookBaseUrl}/api/voice/webhook/recording/${parameters.callId || 0}`],
                        beepStart: parameters.beepStart !== false,
                        endOnSilence: parameters.endOnSilence || 5,
                        endOnKey: parameters.endOnKey || '#',
                        timeOut: parameters.timeOut || 60,
                    }];
                break;
            case 'connect':
                ncco = [{
                        action: 'connect',
                        endpoint: [{ type: 'phone', number: parameters.number }],
                        from: process.env.VONAGE_PHONE_NUMBER,
                        timeout: parameters.timeout || 30,
                    }];
                break;
            case 'conference':
                ncco = [{
                        action: 'conversation',
                        name: parameters.conferenceName,
                        musicOnHoldUrl: parameters.musicOnHold
                            ? ['https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3']
                            : undefined,
                        startOnEnter: parameters.startOnEnter !== false,
                        record: parameters.record || false,
                    }];
                break;
            default:
                return res.status(400).json({ error: 'Unknown action type' });
        }
        res.json(ncco);
    }
    catch (error) {
        console.error('Error generating NCCO:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/voice/webhook/test
 * Test endpoint for webhook connectivity
 */
router.get('/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Voice webhook endpoint is reachable',
        timestamp: new Date().toISOString(),
        endpoints: {
            answer: '/api/voice/webhook/answer',
            event: '/api/voice/webhook/event/:callId',
            input: '/api/voice/webhook/input/:callId',
            recording: '/api/voice/webhook/recording/:callId',
            voicemail: '/api/voice/webhook/voicemail/:callId',
            transfer: '/api/voice/webhook/transfer/:callId',
        },
    });
});
/**
 * POST /api/voice/webhook/test
 * Test endpoint that echoes the request
 */
router.post('/test', (req, res) => {
    console.log('🧪 Webhook test received:', req.body);
    res.json({
        status: 'received',
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString(),
    });
});
/**
 * Health check endpoint for Vonage application settings
 */
router.get('/health', async (req, res) => {
    try {
        const { checkVonageHealth } = await Promise.resolve().then(() => __importStar(require('../voice/VonageService')));
        const health = await checkVonageHealth();
        res.json({
            status: health.healthy ? 'ok' : 'error',
            vonage: health,
            webhook_base_url: process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=voice-webhook.js.map