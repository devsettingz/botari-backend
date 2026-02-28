"use strict";
/**
 * Vonage Voice Service
 * Botari AI - Complete Voice Call Integration
 *
 * This service provides:
 * - Outbound call initiation
 * - Text-to-Speech (TTS) for AI responses
 * - Speech-to-Text (STT) for user input
 * - Call recording management
 * - Call status tracking
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
exports.initializeVonage = initializeVonage;
exports.getVonageClient = getVonageClient;
exports.makeOutboundCall = makeOutboundCall;
exports.handleInboundCall = handleInboundCall;
exports.processSpeechInput = processSpeechInput;
exports.handleCallStatus = handleCallStatus;
exports.startRecording = startRecording;
exports.endCall = endCall;
exports.handleRecording = handleRecording;
exports.getCallHistory = getCallHistory;
exports.getCallDetails = getCallDetails;
exports.generateCallSummary = generateCallSummary;
exports.handleDTMF = handleDTMF;
exports.getActiveCalls = getActiveCalls;
exports.checkVonageHealth = checkVonageHealth;
const server_sdk_1 = require("@vonage/server-sdk");
const auth_1 = require("@vonage/auth");
const db_1 = __importDefault(require("../db"));
const agent_1 = require("../agent");
// Vonage client instance
let vonage = null;
/**
 * Initialize Vonage client with credentials
 */
function initializeVonage() {
    if (vonage)
        return vonage;
    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    const applicationId = process.env.VONAGE_APPLICATION_ID;
    const privateKey = process.env.VONAGE_PRIVATE_KEY;
    if (!apiKey || !apiSecret) {
        throw new Error('Vonage API credentials not configured');
    }
    // If application credentials are provided, use JWT auth
    if (applicationId && privateKey) {
        const auth = new auth_1.Auth({
            apiKey,
            apiSecret,
            applicationId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        });
        vonage = new server_sdk_1.Vonage(auth);
    }
    else {
        // Basic API key/secret auth
        vonage = new server_sdk_1.Vonage({
            apiKey,
            apiSecret,
        });
    }
    console.log('🔊 Vonage Voice Service: Initialized');
    return vonage;
}
/**
 * Get Vonage client instance
 */
function getVonageClient() {
    if (!vonage) {
        return initializeVonage();
    }
    return vonage;
}
/**
 * Make an outbound call
 */
async function makeOutboundCall(to, businessId, employeeId, options = {}) {
    try {
        const client = getVonageClient();
        const fromNumber = options.fromNumber || process.env.VONAGE_PHONE_NUMBER;
        if (!fromNumber) {
            throw new Error('Vonage phone number not configured');
        }
        // Format phone number (ensure it has country code)
        const formattedNumber = formatPhoneNumber(to);
        // Create call record in database
        const callResult = await db_1.default.query(`INSERT INTO calls (business_id, employee_id, customer_phone, direction, status, started_at, metadata)
       VALUES ($1, $2, $3, 'outbound', 'ringing', NOW(), $4)
       RETURNING id`, [businessId, employeeId, formattedNumber, JSON.stringify(options.metadata || {})]);
        const dbCallId = callResult.rows[0].id;
        // Generate NCCO for the call
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        const greeting = options.greetingText || "Hello, this is Botari calling. How can I help you today?";
        const voiceName = options.voiceName || 'Joey';
        const ncco = [
            {
                action: 'talk',
                text: greeting,
                voiceName,
                language: 'en-US',
            },
            {
                action: 'input',
                eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${dbCallId}`],
                speech: {
                    language: 'en-US',
                    context: ['support', 'sales', 'appointment', 'general'],
                    endOnSilence: 2,
                },
                type: ['speech'],
            },
        ];
        // Create the call using Vonage API
        const response = await client.voice.createCall({
            to: [{ type: 'phone', number: formattedNumber }],
            from: { type: 'phone', number: fromNumber },
            ncco,
            eventUrl: [`${webhookBaseUrl}/api/voice/webhook/event/${dbCallId}`],
            eventMethod: 'POST',
            machineDetection: 'continue',
        });
        const callUuid = response?.uuid;
        // Update call record with UUID
        if (callUuid) {
            await db_1.default.query(`UPDATE calls SET vonage_call_uuid = $1 WHERE id = $2`, [callUuid, dbCallId]);
        }
        console.log(`📞 Outbound call initiated: ${callUuid} to ${formattedNumber}`);
        return {
            success: true,
            callUuid,
            dbId: dbCallId,
        };
    }
    catch (error) {
        console.error('Error making outbound call:', error);
        return {
            success: false,
            error: error.message || 'Failed to initiate call',
        };
    }
}
/**
 * Handle inbound call - generates NCCO for answer_url webhook
 */
async function handleInboundCall(from, to, businessId) {
    try {
        // Find the voice agent (Rachel or Omar) for this business
        const agentRes = await db_1.default.query(`SELECT ae.*, be.id as be_id 
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 
       AND (ae.employee_role ILIKE '%Voice%' OR ae.employee_role ILIKE '%Receptionist%' OR ae.employee_role ILIKE '%Call%')
       LIMIT 1`, [businessId]);
        const agent = agentRes.rows[0];
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        // Create call record
        const callResult = await db_1.default.query(`INSERT INTO calls (business_id, employee_id, customer_phone, direction, status, started_at, metadata)
       VALUES ($1, $2, $3, 'inbound', 'in_progress', NOW(), $4)
       RETURNING id`, [
            businessId,
            agent?.id,
            formatPhoneNumber(from),
            JSON.stringify({ to_number: to, agent_name: agent?.display_name || 'Omar' }),
        ]);
        const dbCallId = callResult.rows[0].id;
        // Get business name
        const businessRes = await db_1.default.query('SELECT business_name FROM businesses WHERE id = $1', [businessId]);
        const businessName = businessRes.rows[0]?.business_name || 'our business';
        // Generate greeting based on agent persona
        const agentName = agent?.display_name || 'Omar';
        const greeting = `Hello, thank you for calling ${businessName}. This is ${agentName} from Botari. How can I help you today?`;
        const ncco = [
            {
                action: 'talk',
                text: greeting,
                voiceName: 'Joey',
                language: 'en-US',
                premium: true,
            },
            {
                action: 'input',
                eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${dbCallId}`],
                speech: {
                    language: 'en-US',
                    context: ['support', 'sales', 'appointment', 'general'],
                    endOnSilence: 2,
                },
                type: ['speech'],
            },
        ];
        console.log(`📞 Inbound call received: ${from} -> ${to} (Business: ${businessId})`);
        return ncco;
    }
    catch (error) {
        console.error('Error handling inbound call:', error);
        // Return a fallback NCCO
        return [
            {
                action: 'talk',
                text: 'Sorry, we are experiencing technical difficulties. Please try again later.',
                voiceName: 'Joey',
            },
        ];
    }
}
/**
 * Process speech input and generate AI response
 */
async function processSpeechInput(callId, speechText, callUuid) {
    try {
        // Get call details
        const callResult = await db_1.default.query(`SELECT c.*, ae.name as employee_name 
       FROM calls c
       LEFT JOIN ai_employees ae ON c.employee_id = ae.id
       WHERE c.id = $1`, [callId]);
        if (callResult.rows.length === 0) {
            return [
                {
                    action: 'talk',
                    text: 'Sorry, I could not find this call session. Please call back.',
                    voiceName: 'Joey',
                },
            ];
        }
        const call = callResult.rows[0];
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        // Get business context
        const businessRes = await db_1.default.query('SELECT * FROM businesses WHERE id = $1', [call.business_id]);
        const business = businessRes.rows[0];
        // Determine employee type (default to rachel for voice)
        const employeeType = call.employee_name?.toLowerCase() || 'rachel';
        // Process message through AI agent
        const aiResponse = await (0, agent_1.processMessage)(speechText, call.customer_phone, employeeType, {
            business_id: call.business_id,
            business_name: business?.business_name,
            employee_id: call.employee_id,
        }, 'voice');
        // Update call with transcript
        const currentTranscript = call.transcript || '';
        const newTranscript = currentTranscript +
            `\n[${new Date().toISOString()}] Customer: ${speechText}\n` +
            `[${new Date().toISOString()}] AI: ${aiResponse.reply}\n`;
        await db_1.default.query(`UPDATE calls SET transcript = $1, status = 'in_progress' WHERE id = $2`, [newTranscript, callId]);
        // Generate NCCO with AI response and continue listening
        const ncco = [
            {
                action: 'talk',
                text: aiResponse.reply,
                voiceName: 'Joey',
                language: 'en-US',
                premium: true,
            },
            {
                action: 'input',
                eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${callId}`],
                speech: {
                    language: 'en-US',
                    context: ['support', 'sales', 'appointment', 'general'],
                    endOnSilence: 3,
                },
                type: ['speech'],
            },
        ];
        console.log(`🗣️ Speech processed for call ${callId}: "${speechText.substring(0, 50)}..."`);
        return ncco;
    }
    catch (error) {
        console.error('Error processing speech input:', error);
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
        return [
            {
                action: 'talk',
                text: "I'm sorry, I didn't catch that. Could you please repeat?",
                voiceName: 'Joey',
            },
            {
                action: 'input',
                eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${callId}`],
                speech: {
                    language: 'en-US',
                    endOnSilence: 3,
                },
                type: ['speech'],
            },
        ];
    }
}
/**
 * Handle call status events
 */
async function handleCallStatus(callId, status, details) {
    try {
        const { duration, status: callStatus, uuid, recording_url, price } = details;
        // Map Vonage status to our status
        const statusMap = {
            'started': 'in_progress',
            'ringing': 'ringing',
            'answered': 'in_progress',
            'completed': 'completed',
            'busy': 'failed',
            'cancelled': 'cancelled',
            'failed': 'failed',
            'rejected': 'failed',
            'timeout': 'failed',
            'unanswered': 'failed',
        };
        const mappedStatus = statusMap[callStatus] || callStatus;
        // Update call record
        const updates = ['status = $1'];
        const values = [mappedStatus];
        let paramIndex = 2;
        if (duration) {
            updates.push(`duration_seconds = $${paramIndex++}`);
            values.push(parseInt(duration, 10));
        }
        if (recording_url) {
            updates.push(`recording_url = $${paramIndex++}`);
            values.push(recording_url);
        }
        if (price) {
            updates.push(`cost = $${paramIndex++}`);
            values.push(parseFloat(price));
        }
        if (mappedStatus === 'completed' || mappedStatus === 'failed' || mappedStatus === 'cancelled') {
            updates.push(`ended_at = $${paramIndex++}`);
            values.push(new Date());
        }
        values.push(callId);
        await db_1.default.query(`UPDATE calls SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
        console.log(`📞 Call ${callId} status: ${mappedStatus}`);
    }
    catch (error) {
        console.error('Error handling call status:', error);
    }
}
/**
 * Start call recording
 */
async function startRecording(callId, callUuid) {
    try {
        const client = getVonageClient();
        // Use Vonage API to start recording
        await client.voice.updateCall(callUuid, {
            action: 'record',
            eventUrl: [`${process.env.WEBHOOK_BASE_URL}/api/voice/webhook/recording/${callId}`],
        });
        // Update call metadata
        await db_1.default.query(`UPDATE calls SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{recording_started}', 'true') WHERE id = $1`, [callId]);
        console.log(`🔴 Recording started for call ${callId}`);
        return true;
    }
    catch (error) {
        console.error('Error starting recording:', error);
        return false;
    }
}
/**
 * End an active call
 */
async function endCall(callId, callUuid) {
    try {
        // If we have the Vonage UUID, try to end via API
        if (callUuid) {
            try {
                const client = getVonageClient();
                await client.voice.updateCall(callUuid, {
                    action: 'hangup',
                });
            }
            catch (apiError) {
                console.warn('Could not end call via Vonage API:', apiError);
            }
        }
        // Update call record
        await db_1.default.query(`UPDATE calls SET status = 'completed', ended_at = NOW() WHERE id = $1`, [callId]);
        console.log(`📞 Call ${callId} ended`);
        return true;
    }
    catch (error) {
        console.error('Error ending call:', error);
        return false;
    }
}
/**
 * Handle recording completion
 */
async function handleRecording(callId, recordingUrl, duration) {
    try {
        await db_1.default.query(`UPDATE calls SET recording_url = $1, metadata = jsonb_set(COALESCE(metadata, '{}'), '{recording_duration}', $2::jsonb) WHERE id = $3`, [recordingUrl, JSON.stringify(duration), callId]);
        console.log(`🔴 Recording saved for call ${callId}: ${recordingUrl}`);
    }
    catch (error) {
        console.error('Error handling recording:', error);
    }
}
/**
 * Get call history for a business
 */
async function getCallHistory(businessId, options = {}) {
    try {
        const { limit = 20, offset = 0, status, startDate, endDate } = options;
        let whereClause = 'WHERE business_id = $1';
        const params = [businessId];
        let paramIndex = 2;
        if (status) {
            whereClause += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (startDate) {
            whereClause += ` AND started_at >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ` AND started_at <= $${paramIndex++}`;
            params.push(endDate);
        }
        // Get total count
        const countResult = await db_1.default.query(`SELECT COUNT(*) FROM calls ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count, 10);
        // Get calls
        params.push(limit, offset);
        const callsResult = await db_1.default.query(`SELECT * FROM calls ${whereClause} ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`, params);
        return {
            calls: callsResult.rows,
            total,
        };
    }
    catch (error) {
        console.error('Error getting call history:', error);
        throw error;
    }
}
/**
 * Get single call details
 */
async function getCallDetails(callId, businessId) {
    try {
        let query = 'SELECT * FROM calls WHERE id = $1';
        const params = [callId];
        if (businessId) {
            query += ' AND business_id = $2';
            params.push(businessId);
        }
        const result = await db_1.default.query(query, params);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('Error getting call details:', error);
        throw error;
    }
}
/**
 * Generate AI summary for a call
 */
async function generateCallSummary(callId) {
    try {
        const call = await getCallDetails(callId);
        if (!call || !call.transcript) {
            return null;
        }
        // Use OpenAI to generate summary (import dynamically to avoid circular deps)
        const { default: OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a call summarization assistant. Create a brief summary of the following phone call transcript. Include key points discussed, any action items, and the overall outcome. Keep it under 200 words.',
                },
                {
                    role: 'user',
                    content: call.transcript,
                },
            ],
            temperature: 0.5,
            max_tokens: 300,
        });
        const summary = completion.choices[0]?.message?.content || null;
        if (summary) {
            await db_1.default.query(`UPDATE calls SET ai_summary = $1 WHERE id = $2`, [summary, callId]);
        }
        return summary;
    }
    catch (error) {
        console.error('Error generating call summary:', error);
        return null;
    }
}
/**
 * Handle DTMF (keypad) input
 */
async function handleDTMF(callId, digits) {
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
    // Common DTMF handling
    switch (digits) {
        case '0':
            return [
                {
                    action: 'talk',
                    text: 'Connecting you to a human agent. Please hold.',
                    voiceName: 'Joey',
                },
                {
                    action: 'conversation',
                    name: `support-queue-${callId}`,
                    startOnEnter: false,
                    musicOnHoldUrl: ['https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3'],
                },
            ];
        case '1':
            return [
                {
                    action: 'talk',
                    text: 'Thank you. Let me help you with sales.',
                    voiceName: 'Joey',
                },
                {
                    action: 'input',
                    eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${callId}`],
                    speech: { language: 'en-US' },
                    type: ['speech'],
                },
            ];
        case '2':
            return [
                {
                    action: 'talk',
                    text: 'Thank you. Let me help you with support.',
                    voiceName: 'Joey',
                },
                {
                    action: 'input',
                    eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${callId}`],
                    speech: { language: 'en-US' },
                    type: ['speech'],
                },
            ];
        case '*':
            // End call
            await endCall(callId);
            return [
                {
                    action: 'talk',
                    text: 'Thank you for calling. Have a great day!',
                    voiceName: 'Joey',
                },
            ];
        default:
            return [
                {
                    action: 'talk',
                    text: `You pressed ${digits}. How else can I help you?`,
                    voiceName: 'Joey',
                },
                {
                    action: 'input',
                    eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${callId}`],
                    speech: { language: 'en-US' },
                    type: ['speech'],
                },
            ];
    }
}
/**
 * Get active calls
 */
async function getActiveCalls(businessId) {
    try {
        let query = `
      SELECT * FROM calls 
      WHERE status IN ('ringing', 'in_progress')
    `;
        const params = [];
        if (businessId) {
            query += ' AND business_id = $1';
            params.push(businessId);
        }
        query += ' ORDER BY started_at DESC';
        const result = await db_1.default.query(query, params);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting active calls:', error);
        throw error;
    }
}
/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    // Add country code if missing (default to US +1)
    if (cleaned.length === 10) {
        cleaned = '1' + cleaned;
    }
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
}
/**
 * Check Vonage service health
 */
async function checkVonageHealth() {
    try {
        const client = getVonageClient();
        // Try to get account balance as a health check
        await client.account.getBalance();
        return { healthy: true, message: 'Vonage service is operational' };
    }
    catch (error) {
        return { healthy: false, message: error.message || 'Vonage service error' };
    }
}
// Export default
exports.default = {
    initializeVonage,
    getVonageClient,
    makeOutboundCall,
    handleInboundCall,
    processSpeechInput,
    handleCallStatus,
    startRecording,
    endCall,
    handleRecording,
    getCallHistory,
    getCallDetails,
    generateCallSummary,
    handleDTMF,
    getActiveCalls,
    checkVonageHealth,
};
//# sourceMappingURL=VonageService.js.map