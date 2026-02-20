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

import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import pool from '../db';
import { processMessage } from '../agent';

// Vonage client instance
let vonage: Vonage | null = null;

/**
 * Initialize Vonage client with credentials
 */
export function initializeVonage(): Vonage {
  if (vonage) return vonage;

  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  const applicationId = process.env.VONAGE_APPLICATION_ID;
  const privateKey = process.env.VONAGE_PRIVATE_KEY;

  if (!apiKey || !apiSecret) {
    throw new Error('Vonage API credentials not configured');
  }

  // If application credentials are provided, use JWT auth
  if (applicationId && privateKey) {
    const auth = new Auth({
      apiKey,
      apiSecret,
      applicationId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
    vonage = new Vonage(auth);
  } else {
    // Basic API key/secret auth
    vonage = new Vonage({
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
export function getVonageClient(): Vonage {
  if (!vonage) {
    return initializeVonage();
  }
  return vonage;
}

/**
 * Call record interface
 */
export interface CallRecord {
  id: number;
  business_id: number;
  employee_id?: number;
  customer_phone: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  started_at: Date;
  ended_at?: Date;
  duration_seconds?: number;
  recording_url?: string;
  transcript?: string;
  ai_summary?: string;
  cost?: number;
  metadata?: any;
  vonage_call_uuid?: string;
}

/**
 * Active call session
 */
export interface ActiveCall {
  callUuid: string;
  businessId: number;
  employeeId?: number;
  customerPhone: string;
  direction: 'inbound' | 'outbound';
  status: string;
  startedAt: Date;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  recordingUrl?: string;
  metadata?: any;
}

/**
 * NCCO (Nexmo Call Control Object) actions
 */
export type NCCOAction = 
  | { action: 'talk'; text: string; voiceName?: string; language?: string; style?: number; premium?: boolean }
  | { action: 'input'; eventUrl: string[]; speech?: { language: string; context?: string[]; endOnSilence?: number; uuid?: string[] }; dtmf?: { maxDigits?: number; submitOnHash?: boolean }; type?: string[] }
  | { action: 'record'; eventUrl: string[]; beepStart?: boolean; endOnSilence?: number; endOnKey?: string; timeOut?: number; channels?: number; split?: string; format?: 'mp3' | 'wav' | 'ogg' }
  | { action: 'stream'; streamUrl: string[]; level?: number; bargeIn?: boolean; loop?: number }
  | { action: 'connect'; endpoint: Array<{ type: 'phone'; number: string; dtmfAnswer?: string }>; from?: string; randomFromNumber?: boolean; eventUrl?: string[]; eventType?: string; timeout?: number; limit?: number; machineDetection?: string }
  | { action: 'conversation'; name: string; musicOnHoldUrl?: string[]; startOnEnter?: boolean; endOnExit?: boolean; record?: boolean; eventUrl?: string[] };

/**
 * Make an outbound call
 */
export async function makeOutboundCall(
  to: string,
  businessId: number,
  employeeId: number,
  options: {
    greetingText?: string;
    voiceName?: string;
    fromNumber?: string;
    metadata?: any;
  } = {}
): Promise<{ success: boolean; callUuid?: string; error?: string; dbId?: number }> {
  try {
    const client = getVonageClient();
    const fromNumber = options.fromNumber || process.env.VONAGE_PHONE_NUMBER;

    if (!fromNumber) {
      throw new Error('Vonage phone number not configured');
    }

    // Format phone number (ensure it has country code)
    const formattedNumber = formatPhoneNumber(to);

    // Create call record in database
    const callResult = await pool.query(
      `INSERT INTO calls (business_id, employee_id, customer_phone, direction, status, started_at, metadata)
       VALUES ($1, $2, $3, 'outbound', 'ringing', NOW(), $4)
       RETURNING id`,
      [businessId, employeeId, formattedNumber, JSON.stringify(options.metadata || {})]
    );
    const dbCallId = callResult.rows[0].id;

    // Generate NCCO for the call
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
    const greeting = options.greetingText || "Hello, this is Botari calling. How can I help you today?";
    const voiceName = options.voiceName || 'Joey';

    const ncco: NCCOAction[] = [
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
    const response = await (client as any).voice.createCall({
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
      await pool.query(
        `UPDATE calls SET vonage_call_uuid = $1 WHERE id = $2`,
        [callUuid, dbCallId]
      );
    }

    console.log(`📞 Outbound call initiated: ${callUuid} to ${formattedNumber}`);

    return {
      success: true,
      callUuid,
      dbId: dbCallId,
    };
  } catch (error: any) {
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
export async function handleInboundCall(
  from: string,
  to: string,
  businessId: number
): Promise<NCCOAction[]> {
  try {
    // Find the voice agent (Rachel or Omar) for this business
    const agentRes = await pool.query(
      `SELECT ae.*, be.id as be_id 
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 
       AND (ae.employee_role ILIKE '%Voice%' OR ae.employee_role ILIKE '%Receptionist%' OR ae.employee_role ILIKE '%Call%')
       LIMIT 1`,
      [businessId]
    );

    const agent = agentRes.rows[0];
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';

    // Create call record
    const callResult = await pool.query(
      `INSERT INTO calls (business_id, employee_id, customer_phone, direction, status, started_at, metadata)
       VALUES ($1, $2, $3, 'inbound', 'in_progress', NOW(), $4)
       RETURNING id`,
      [
        businessId,
        agent?.id,
        formatPhoneNumber(from),
        JSON.stringify({ to_number: to, agent_name: agent?.display_name || 'Omar' }),
      ]
    );
    const dbCallId = callResult.rows[0].id;

    // Get business name
    const businessRes = await pool.query(
      'SELECT business_name FROM businesses WHERE id = $1',
      [businessId]
    );
    const businessName = businessRes.rows[0]?.business_name || 'our business';

    // Generate greeting based on agent persona
    const agentName = agent?.display_name || 'Omar';
    const greeting = `Hello, thank you for calling ${businessName}. This is ${agentName} from Botari. How can I help you today?`;

    const ncco: NCCOAction[] = [
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
  } catch (error) {
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
export async function processSpeechInput(
  callId: number,
  speechText: string,
  callUuid: string
): Promise<NCCOAction[]> {
  try {
    // Get call details
    const callResult = await pool.query(
      `SELECT c.*, ae.name as employee_name 
       FROM calls c
       LEFT JOIN ai_employees ae ON c.employee_id = ae.id
       WHERE c.id = $1`,
      [callId]
    );

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
    const businessRes = await pool.query(
      'SELECT * FROM businesses WHERE id = $1',
      [call.business_id]
    );
    const business = businessRes.rows[0];

    // Determine employee type (default to rachel for voice)
    const employeeType = call.employee_name?.toLowerCase() || 'rachel';

    // Process message through AI agent
    const aiResponse = await processMessage(
      speechText,
      call.customer_phone,
      employeeType as any,
      {
        business_id: call.business_id,
        business_name: business?.business_name,
        employee_id: call.employee_id,
      },
      'voice'
    );

    // Update call with transcript
    const currentTranscript = call.transcript || '';
    const newTranscript = currentTranscript + 
      `\n[${new Date().toISOString()}] Customer: ${speechText}\n` +
      `[${new Date().toISOString()}] AI: ${aiResponse.reply}\n`;

    await pool.query(
      `UPDATE calls SET transcript = $1, status = 'in_progress' WHERE id = $2`,
      [newTranscript, callId]
    );

    // Generate NCCO with AI response and continue listening
    const ncco: NCCOAction[] = [
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
  } catch (error) {
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
export async function handleCallStatus(
  callId: number,
  status: string,
  details: any
): Promise<void> {
  try {
    const { duration, status: callStatus, uuid, recording_url, price } = details;

    // Map Vonage status to our status
    const statusMap: { [key: string]: string } = {
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
    const updates: string[] = ['status = $1'];
    const values: any[] = [mappedStatus];
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

    await pool.query(
      `UPDATE calls SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    console.log(`📞 Call ${callId} status: ${mappedStatus}`);
  } catch (error) {
    console.error('Error handling call status:', error);
  }
}

/**
 * Start call recording
 */
export async function startRecording(callId: number, callUuid: string): Promise<boolean> {
  try {
    const client = getVonageClient();

    // Use Vonage API to start recording
    await (client as any).voice.updateCall(callUuid, {
      action: 'record',
      eventUrl: [`${process.env.WEBHOOK_BASE_URL}/api/voice/webhook/recording/${callId}`],
    });

    // Update call metadata
    await pool.query(
      `UPDATE calls SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{recording_started}', 'true') WHERE id = $1`,
      [callId]
    );

    console.log(`🔴 Recording started for call ${callId}`);
    return true;
  } catch (error) {
    console.error('Error starting recording:', error);
    return false;
  }
}

/**
 * End an active call
 */
export async function endCall(callId: number, callUuid?: string): Promise<boolean> {
  try {
    // If we have the Vonage UUID, try to end via API
    if (callUuid) {
      try {
        const client = getVonageClient();
        await (client as any).voice.updateCall(callUuid, {
          action: 'hangup',
        });
      } catch (apiError) {
        console.warn('Could not end call via Vonage API:', apiError);
      }
    }

    // Update call record
    await pool.query(
      `UPDATE calls SET status = 'completed', ended_at = NOW() WHERE id = $1`,
      [callId]
    );

    console.log(`📞 Call ${callId} ended`);
    return true;
  } catch (error) {
    console.error('Error ending call:', error);
    return false;
  }
}

/**
 * Handle recording completion
 */
export async function handleRecording(
  callId: number,
  recordingUrl: string,
  duration: number
): Promise<void> {
  try {
    await pool.query(
      `UPDATE calls SET recording_url = $1, metadata = jsonb_set(COALESCE(metadata, '{}'), '{recording_duration}', $2::jsonb) WHERE id = $3`,
      [recordingUrl, JSON.stringify(duration), callId]
    );

    console.log(`🔴 Recording saved for call ${callId}: ${recordingUrl}`);
  } catch (error) {
    console.error('Error handling recording:', error);
  }
}

/**
 * Get call history for a business
 */
export async function getCallHistory(
  businessId: number,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ calls: CallRecord[]; total: number }> {
  try {
    const { limit = 20, offset = 0, status, startDate, endDate } = options;

    let whereClause = 'WHERE business_id = $1';
    const params: any[] = [businessId];
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
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM calls ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get calls
    params.push(limit, offset);
    const callsResult = await pool.query(
      `SELECT * FROM calls ${whereClause} ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      calls: callsResult.rows,
      total,
    };
  } catch (error) {
    console.error('Error getting call history:', error);
    throw error;
  }
}

/**
 * Get single call details
 */
export async function getCallDetails(callId: number, businessId?: number): Promise<CallRecord | null> {
  try {
    let query = 'SELECT * FROM calls WHERE id = $1';
    const params: any[] = [callId];

    if (businessId) {
      query += ' AND business_id = $2';
      params.push(businessId);
    }

    const result = await pool.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting call details:', error);
    throw error;
  }
}

/**
 * Generate AI summary for a call
 */
export async function generateCallSummary(callId: number): Promise<string | null> {
  try {
    const call = await getCallDetails(callId);
    if (!call || !call.transcript) {
      return null;
    }

    // Use OpenAI to generate summary (import dynamically to avoid circular deps)
    const { default: OpenAI } = await import('openai');
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
      await pool.query(
        `UPDATE calls SET ai_summary = $1 WHERE id = $2`,
        [summary, callId]
      );
    }

    return summary;
  } catch (error) {
    console.error('Error generating call summary:', error);
    return null;
  }
}

/**
 * Handle DTMF (keypad) input
 */
export async function handleDTMF(
  callId: number,
  digits: string
): Promise<NCCOAction[]> {
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
export async function getActiveCalls(businessId?: number): Promise<CallRecord[]> {
  try {
    let query = `
      SELECT * FROM calls 
      WHERE status IN ('ringing', 'in_progress')
    `;
    const params: any[] = [];

    if (businessId) {
      query += ' AND business_id = $1';
      params.push(businessId);
    }

    query += ' ORDER BY started_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting active calls:', error);
    throw error;
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
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
export async function checkVonageHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    const client = getVonageClient();
    // Try to get account balance as a health check
    await (client as any).account.getBalance();
    return { healthy: true, message: 'Vonage service is operational' };
  } catch (error: any) {
    return { healthy: false, message: error.message || 'Vonage service error' };
  }
}

// Export default
export default {
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
