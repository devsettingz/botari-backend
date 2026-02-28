"use strict";
/**
 * Vonage Webhook Handler
 * Botari AI - Voice Call Webhook Endpoints
 *
 * Handles all Vonage webhooks:
 * - answer_url: Initial call answering
 * - event_url: Call status updates
 * - input: Speech/DTMF input
 * - recording: Recording callbacks
 * - transfer: Call transfer events
 * - voicemail: Voicemail recordings
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAnswerWebhook = handleAnswerWebhook;
exports.handleEventWebhook = handleEventWebhook;
exports.handleInputWebhook = handleInputWebhook;
exports.handleRecordingWebhook = handleRecordingWebhook;
exports.handleVoicemailWebhook = handleVoicemailWebhook;
exports.handleTransferWebhook = handleTransferWebhook;
exports.handleMachineDetectionWebhook = handleMachineDetectionWebhook;
exports.generateConferenceNCCO = generateConferenceNCCO;
exports.handleFallbackWebhook = handleFallbackWebhook;
const db_1 = __importDefault(require("../db"));
const VonageService_1 = require("./VonageService");
const CallManager_1 = require("./CallManager");
/**
 * Handle answer_url webhook - called when call is answered
 * Returns NCCO to control the call flow
 */
async function handleAnswerWebhook(req, res) {
    try {
        const { from, to, uuid, conversation_uuid } = req.body;
        const { businessId } = req.params;
        console.log(`📞 Answer webhook: ${from} -> ${to} (UUID: ${uuid})`);
        // If businessId is provided in URL, use it (for outbound calls)
        // Otherwise, we need to determine the business from the to number
        let targetBusinessId = businessId ? parseInt(businessId, 10) : null;
        if (!targetBusinessId) {
            // Look up business by phone number
            const businessRes = await db_1.default.query('SELECT id FROM businesses WHERE phone_number = $1 OR vonage_number = $1', [to]);
            if (businessRes.rows.length === 0) {
                console.warn(`No business found for number: ${to}`);
                // Return a generic response
                res.json([
                    {
                        action: 'talk',
                        text: 'Sorry, this number is not configured. Please contact support.',
                        voiceName: 'Joey',
                    },
                ]);
                return;
            }
            targetBusinessId = businessRes.rows[0].id;
        }
        // Handle the inbound call and get NCCO
        const ncco = await (0, VonageService_1.handleInboundCall)(from, to, targetBusinessId);
        // Create call session
        // First, get the call ID from the database (created in handleInboundCall)
        const callResult = await db_1.default.query(`SELECT id FROM calls 
       WHERE business_id = $1 AND customer_phone = $2 
       ORDER BY started_at DESC LIMIT 1`, [targetBusinessId, from]);
        if (callResult.rows.length > 0) {
            const callId = callResult.rows[0].id;
            await (0, CallManager_1.createCallSession)(callId, uuid, targetBusinessId, from, 'inbound');
        }
        // Return NCCO
        res.json(ncco);
    }
    catch (error) {
        console.error('Error in answer webhook:', error);
        // Return error NCCO
        res.json([
            {
                action: 'talk',
                text: 'Sorry, we are experiencing technical difficulties. Please try again later.',
                voiceName: 'Joey',
            },
        ]);
    }
}
/**
 * Handle event_url webhook - call status updates
 */
async function handleEventWebhook(req, res) {
    try {
        const { callId } = req.params;
        const { status, duration, uuid, recording_url, price, direction, from, to, conversation_uuid, timestamp, } = req.body;
        console.log(`📊 Event webhook for call ${callId}:`, { status, uuid, duration });
        const dbCallId = parseInt(callId, 10);
        // Handle different statuses
        await (0, VonageService_1.handleCallStatus)(dbCallId, status, {
            status,
            duration,
            uuid,
            recording_url,
            price,
        });
        // Handle call completion
        if (status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'rejected' || status === 'busy' || status === 'unanswered') {
            // End the call session
            await (0, CallManager_1.endCallSession)(uuid);
            // Generate AI summary if call was completed
            if (status === 'completed') {
                // Import dynamically to avoid circular dependencies
                const { generateCallSummary } = await Promise.resolve().then(() => __importStar(require('./VonageService')));
                await generateCallSummary(dbCallId);
            }
        }
        // Acknowledge webhook
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error in event webhook:', error);
        res.sendStatus(200); // Still return 200 to prevent retries
    }
}
/**
 * Handle input webhook - speech or DTMF input
 */
async function handleInputWebhook(req, res) {
    try {
        const { callId } = req.params;
        const { speech, dtmf, from, to, uuid, conversation_uuid } = req.body;
        console.log(`🎤 Input webhook for call ${callId}:`, {
            speech: speech ? 'present' : 'absent',
            dtmf: dtmf ? 'present' : 'absent'
        });
        const dbCallId = parseInt(callId, 10);
        // Get or create call session
        let session = (0, CallManager_1.getCallSession)(uuid);
        if (!session) {
            // Try to get call details from database
            const callResult = await db_1.default.query('SELECT * FROM calls WHERE id = $1', [dbCallId]);
            if (callResult.rows.length === 0) {
                console.error(`Call ${callId} not found`);
                res.json([
                    {
                        action: 'talk',
                        text: 'Sorry, your call session could not be found.',
                        voiceName: 'Joey',
                    },
                ]);
                return;
            }
            const call = callResult.rows[0];
            const { createCallSession } = await Promise.resolve().then(() => __importStar(require('./CallManager')));
            session = await createCallSession(dbCallId, uuid, call.business_id, call.customer_phone, call.direction);
        }
        // Handle DTMF input
        if (dtmf && dtmf.digits) {
            const ncco = await (0, VonageService_1.handleDTMF)(dbCallId, dtmf.digits);
            res.json(ncco);
            return;
        }
        // Handle speech input
        if (speech && speech.results && speech.results.length > 0) {
            const bestResult = speech.results[0];
            const transcript = bestResult.text;
            const confidence = bestResult.confidence;
            console.log(`🗣️ Speech recognized: "${transcript}" (confidence: ${confidence})`);
            // Process speech through AI
            const ncco = await (0, CallManager_1.bridgeAIAgent)(uuid, transcript, bestResult);
            res.json(ncco);
            return;
        }
        // No input detected (silence timeout)
        const attempt = parseInt(req.query.attempt) || 1;
        const ncco = await (0, CallManager_1.handleNoInput)(uuid, attempt);
        res.json(ncco);
    }
    catch (error) {
        console.error('Error in input webhook:', error);
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        res.json([
            {
                action: 'talk',
                text: "I'm sorry, I didn't understand that. Could you please try again?",
                voiceName: 'Joey',
            },
            {
                action: 'input',
                eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${req.params.callId}`],
                speech: { language: 'en-US' },
                type: ['speech'],
            },
        ]);
    }
}
/**
 * Handle recording webhook
 */
async function handleRecordingWebhook(req, res) {
    try {
        const { callId } = req.params;
        const { recording_url, recording_uuid, start_time, end_time, duration, conversation_uuid, } = req.body;
        console.log(`🔴 Recording webhook for call ${callId}:`, {
            recording_uuid,
            duration,
            recording_url: recording_url?.substring(0, 50) + '...'
        });
        const dbCallId = parseInt(callId, 10);
        // Calculate duration in seconds
        const durationSeconds = duration ? parseInt(duration, 10) : 0;
        // Handle the recording
        await (0, VonageService_1.handleRecording)(dbCallId, recording_url, durationSeconds);
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error in recording webhook:', error);
        res.sendStatus(200);
    }
}
/**
 * Handle voicemail webhook
 */
async function handleVoicemailWebhook(req, res) {
    try {
        const { callId } = req.params;
        const { recording_url, duration, from, to, } = req.body;
        console.log(`📼 Voicemail webhook for call ${callId}:`, { duration, from });
        const dbCallId = parseInt(callId, 10);
        if (dbCallId > 0) {
            // Update call record with voicemail
            await db_1.default.query(`UPDATE calls SET 
          recording_url = $1,
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{voicemail}', $2)
         WHERE id = $3`, [
                recording_url,
                JSON.stringify({ duration, received_at: new Date().toISOString() }),
                dbCallId,
            ]);
            // Create follow-up for the voicemail
            await db_1.default.query(`INSERT INTO follow_ups (business_id, customer_phone, scheduled_at, notes, channel)
         SELECT business_id, customer_phone, NOW() + INTERVAL '1 hour', $1, 'call'
         FROM calls WHERE id = $2`, [`Voicemail received. Recording: ${recording_url}`, dbCallId]);
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error in voicemail webhook:', error);
        res.sendStatus(200);
    }
}
/**
 * Handle transfer webhook
 */
async function handleTransferWebhook(req, res) {
    try {
        const { callId } = req.params;
        const { status, uuid, duration, from, to } = req.body;
        console.log(`🔄 Transfer webhook for call ${callId}:`, { status, uuid });
        const dbCallId = parseInt(callId, 10);
        // Update call record with transfer details
        await db_1.default.query(`UPDATE calls SET 
        metadata = jsonb_set(COALESCE(metadata, '{}'), '{transfer}', $1)
       WHERE id = $2`, [
            JSON.stringify({ status, to, duration, transferred_at: new Date().toISOString() }),
            dbCallId,
        ]);
        // If transfer was answered, create escalation
        if (status === 'answered') {
            await db_1.default.query(`INSERT INTO escalations (business_id, conversation_id, customer_phone, reason, priority, status)
         SELECT business_id, NULL, customer_phone, $1, 'medium', 'in_progress'
         FROM calls WHERE id = $2`, ['Call transferred to human agent', dbCallId]);
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error in transfer webhook:', error);
        res.sendStatus(200);
    }
}
/**
 * Handle machine detection webhook
 */
async function handleMachineDetectionWebhook(req, res) {
    try {
        const { status, uuid, callId } = req.body;
        console.log(`🤖 Machine detection: ${status} for call ${callId}`);
        const dbCallId = parseInt(callId, 10);
        // Update call metadata
        await db_1.default.query(`UPDATE calls SET 
        metadata = jsonb_set(COALESCE(metadata, '{}'), '{machine_detection}', $1)
       WHERE id = $2`, [JSON.stringify({ status, detected_at: new Date().toISOString() }), dbCallId]);
        // Handle different statuses
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        switch (status) {
            case 'machine':
                // Leave a voicemail message
                res.json([
                    {
                        action: 'talk',
                        text: "Hello, you've reached Botari. We're sorry we missed you. Please call us back or leave a message after the tone.",
                        voiceName: 'Joey',
                    },
                    {
                        action: 'record',
                        eventUrl: [`${webhookBaseUrl}/api/voice/webhook/voicemail/${dbCallId}`],
                        beepStart: true,
                        endOnSilence: 5,
                        timeOut: 60,
                    },
                ]);
                return;
            case 'human':
                // Continue with normal flow
                res.json([
                    {
                        action: 'talk',
                        text: 'Hello! Thank you for answering. This is a call from Botari.',
                        voiceName: 'Joey',
                    },
                    {
                        action: 'input',
                        eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${dbCallId}`],
                        speech: { language: 'en-US' },
                        type: ['speech'],
                    },
                ]);
                return;
            default:
                res.sendStatus(200);
                return;
        }
    }
    catch (error) {
        console.error('Error in machine detection webhook:', error);
        res.sendStatus(200);
    }
}
/**
 * Generate NCCO for conference/bridge
 */
function generateConferenceNCCO(conferenceName, options = {}) {
    const ncco = [];
    if (options.musicOnHold) {
        ncco.push({
            action: 'talk',
            text: 'You are being connected to the conference. Please hold.',
            voiceName: 'Joey',
        });
    }
    ncco.push({
        action: 'conversation',
        name: conferenceName,
        musicOnHoldUrl: options.musicOnHold
            ? ['https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3']
            : undefined,
        startOnEnter: !options.musicOnHold,
        record: options.record || false,
    });
    return ncco;
}
/**
 * Handle fallback webhook (when primary webhook fails)
 */
function handleFallbackWebhook(req, res) {
    console.warn('Fallback webhook triggered:', req.body);
    // Return a simple response to keep the call alive
    res.json([
        {
            action: 'talk',
            text: 'Please hold while we connect you.',
            voiceName: 'Joey',
        },
        {
            action: 'input',
            eventUrl: [`${process.env.WEBHOOK_BASE_URL}/api/voice/webhook/input/0`],
            timeOut: 30,
        },
    ]);
}
/**
 * Notify external systems about call events
 */
async function notifyExternalSystems(event, callId, data) {
    try {
        const webhookUrl = process.env.EXTERNAL_WEBHOOK_URL;
        if (!webhookUrl)
            return;
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                callId,
                timestamp: new Date().toISOString(),
                data,
            }),
        });
    }
    catch (error) {
        console.error('Error notifying external systems:', error);
    }
}
// Export default
exports.default = {
    handleAnswerWebhook,
    handleEventWebhook,
    handleInputWebhook,
    handleRecordingWebhook,
    handleVoicemailWebhook,
    handleTransferWebhook,
    handleMachineDetectionWebhook,
    handleFallbackWebhook,
    generateConferenceNCCO,
};
//# sourceMappingURL=WebhookHandler.js.map