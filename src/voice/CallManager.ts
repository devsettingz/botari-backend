/**
 * Call Manager
 * Botari AI - Voice Call Session Management
 * 
 * Manages active call sessions, bridging AI agents into calls,
 * and handling call transfers.
 */

import pool from '../db';
import { processMessage, PERSONAS } from '../agent';
import { getVonageClient, NCCOAction, endCall } from './VonageService';

/**
 * Call session state
 */
export interface CallSession {
  callId: number;
  callUuid: string;
  businessId: number;
  employeeId?: number;
  customerPhone: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'in_progress' | 'on_hold' | 'transferring' | 'completed';
  startedAt: Date;
  lastActivityAt: Date;
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  recordingUrl?: string;
  transferTarget?: string;
  metadata: {
    currentIntent?: string;
    awaitingConfirmation?: boolean;
    pendingAction?: any;
    customerName?: string;
    callPurpose?: string;
    satisfaction?: number;
    [key: string]: any;
  };
}

// In-memory store for active sessions
const activeSessions = new Map<string, CallSession>();

/**
 * Create a new call session
 */
export async function createCallSession(
  callId: number,
  callUuid: string,
  businessId: number,
  customerPhone: string,
  direction: 'inbound' | 'outbound',
  employeeId?: number
): Promise<CallSession> {
  const session: CallSession = {
    callId,
    callUuid,
    businessId,
    employeeId,
    customerPhone,
    direction,
    status: 'ringing',
    startedAt: new Date(),
    lastActivityAt: new Date(),
    conversationHistory: [],
    metadata: {},
  };

  activeSessions.set(callUuid, session);

  // Add system greeting to history
  session.conversationHistory.push({
    role: 'system',
    content: `Call ${direction} initiated to ${customerPhone}`,
    timestamp: new Date(),
  });

  console.log(`📞 Call session created: ${callUuid} (ID: ${callId})`);
  return session;
}

/**
 * Get active call session by UUID
 */
export function getCallSession(callUuid: string): CallSession | undefined {
  return activeSessions.get(callUuid);
}

/**
 * Get active call session by database ID
 */
export function getCallSessionById(callId: number): CallSession | undefined {
  for (const session of activeSessions.values()) {
    if (session.callId === callId) {
      return session;
    }
  }
  return undefined;
}

/**
 * Update call session
 */
export function updateCallSession(
  callUuid: string,
  updates: Partial<CallSession>
): CallSession | undefined {
  const session = activeSessions.get(callUuid);
  if (!session) return undefined;

  Object.assign(session, updates);
  session.lastActivityAt = new Date();
  
  activeSessions.set(callUuid, session);
  return session;
}

/**
 * Add conversation entry to session
 */
export function addConversationEntry(
  callUuid: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): void {
  const session = activeSessions.get(callUuid);
  if (!session) return;

  session.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
  });

  session.lastActivityAt = new Date();
}

/**
 * End call session
 */
export async function endCallSession(callUuid: string): Promise<void> {
  const session = activeSessions.get(callUuid);
  if (!session) return;

  // Update status
  session.status = 'completed';

  // Save conversation transcript to database
  try {
    const transcript = session.conversationHistory
      .map((entry) => `[${entry.timestamp.toISOString()}] ${entry.role}: ${entry.content}`)
      .join('\n');

    await pool.query(
      `UPDATE calls SET 
        status = 'completed',
        ended_at = NOW(),
        transcript = $1,
        metadata = $2
       WHERE id = $3`,
      [
        transcript,
        JSON.stringify(session.metadata),
        session.callId,
      ]
    );
  } catch (error) {
    console.error('Error saving call transcript:', error);
  }

  // Remove from active sessions
  activeSessions.delete(callUuid);

  console.log(`📞 Call session ended: ${callUuid}`);
}

/**
 * Get all active call sessions
 */
export function getAllActiveSessions(): CallSession[] {
  return Array.from(activeSessions.values());
}

/**
 * Get active calls count for a business
 */
export function getBusinessActiveCallCount(businessId: number): number {
  let count = 0;
  for (const session of activeSessions.values()) {
    if (session.businessId === businessId && session.status !== 'completed') {
      count++;
    }
  }
  return count;
}

/**
 * Bridge AI agent into call
 * This processes user input and generates AI response with NCCO
 */
export async function bridgeAIAgent(
  callUuid: string,
  userInput: string,
  speechResult?: any
): Promise<NCCOAction[]> {
  const session = activeSessions.get(callUuid);
  if (!session) {
    return [
      {
        action: 'talk',
        text: 'Sorry, your call session has expired. Please call back.',
        voiceName: 'Joey',
      },
    ];
  }

  // Update session activity
  session.lastActivityAt = new Date();

  // Add user input to history
  addConversationEntry(callUuid, 'user', userInput);

  // Get business context
  const businessRes = await pool.query(
    'SELECT * FROM businesses WHERE id = $1',
    [session.businessId]
  );
  const business = businessRes.rows[0];

  // Get employee for this call
  const employeeRes = await pool.query(
    `SELECT ae.* FROM business_employees be
     JOIN ai_employees ae ON be.employee_id = ae.id
     WHERE be.business_id = $1 AND be.employee_id = $2
     LIMIT 1`,
    [session.businessId, session.employeeId]
  );
  const employee = employeeRes.rows[0];

  // Determine employee type for persona
  const employeeType = employee?.name?.toLowerCase() || 'rachel';

  try {
    // Process through AI agent
    const aiResponse = await processMessage(
      userInput,
      session.customerPhone,
      employeeType as any,
      {
        business_id: session.businessId,
        business_name: business?.business_name,
        employee_id: session.employeeId,
      },
      'voice'
    );

    // Add AI response to history
    addConversationEntry(callUuid, 'assistant', aiResponse.reply);

    // Update metadata if actions were taken
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      session.metadata.lastActions = aiResponse.actions;
    }

    // Generate NCCO with AI response
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
    
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
        eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${session.callId}`],
        speech: {
          language: 'en-US',
          context: ['support', 'sales', 'appointment', 'general'],
          endOnSilence: 3,
        },
        type: ['speech'],
      },
    ];

    return ncco;
  } catch (error) {
    console.error('Error bridging AI agent:', error);
    
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
    
    return [
      {
        action: 'talk',
        text: "I'm sorry, I'm having trouble understanding. Could you please repeat that?",
        voiceName: 'Joey',
      },
      {
        action: 'input',
        eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${session.callId}`],
        speech: { language: 'en-US', endOnSilence: 3 },
        type: ['speech'],
      },
    ];
  }
}

/**
 * Handle call transfer
 */
export async function transferCall(
  callUuid: string,
  targetNumber: string,
  options: {
    whisperMessage?: string;
    timeout?: number;
  } = {}
): Promise<NCCOAction[]> {
  const session = activeSessions.get(callUuid);
  if (!session) {
    return [
      {
        action: 'talk',
        text: 'Sorry, unable to transfer your call at this time.',
        voiceName: 'Joey',
      },
    ];
  }

  // Update session
  session.status = 'transferring';
  session.transferTarget = targetNumber;

  // Whisper message to the agent receiving the transfer
  const whisperText = options.whisperMessage || 
    `Transferring call from ${session.customerPhone}. Customer has been speaking with our AI assistant.`;

  const ncco: NCCOAction[] = [
    {
      action: 'talk',
      text: 'Please hold while I transfer you to a specialist.',
      voiceName: 'Joey',
    },
    {
      action: 'connect',
      endpoint: [{ type: 'phone', number: targetNumber }],
      from: process.env.VONAGE_PHONE_NUMBER,
      timeout: options.timeout || 30,
      eventUrl: [`${process.env.WEBHOOK_BASE_URL}/api/voice/webhook/transfer/${session.callId}`],
    },
  ];

  console.log(`📞 Transferring call ${callUuid} to ${targetNumber}`);
  return ncco;
}

/**
 * Put call on hold
 */
export function putOnHold(callUuid: string): NCCOAction[] {
  const session = activeSessions.get(callUuid);
  if (!session) {
    return [
      {
        action: 'talk',
        text: 'Sorry, unable to process your request.',
        voiceName: 'Joey',
      },
    ];
  }

  session.status = 'on_hold';

  const ncco: NCCOAction[] = [
    {
      action: 'talk',
      text: 'Please hold while I look that up for you.',
      voiceName: 'Joey',
    },
    {
      action: 'stream',
      streamUrl: ['https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3'],
      level: 0.3,
      loop: 0,
    },
  ];

  return ncco;
}

/**
 * Resume call from hold
 */
export async function resumeFromHold(
  callUuid: string,
  message?: string
): Promise<NCCOAction[]> {
  const session = activeSessions.get(callUuid);
  if (!session) {
    return [
      {
        action: 'talk',
        text: 'Sorry, your call session has expired.',
        voiceName: 'Joey',
      },
    ];
  }

  session.status = 'in_progress';

  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';
  
  const ncco: NCCOAction[] = [
    {
      action: 'talk',
      text: message || 'Thank you for holding. How else can I help you?',
      voiceName: 'Joey',
    },
    {
      action: 'input',
      eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${session.callId}`],
      speech: { language: 'en-US', endOnSilence: 3 },
      type: ['speech'],
    },
  ];

  return ncco;
}

/**
 * Send call to voicemail
 */
export function sendToVoicemail(callUuid: string, reason?: string): NCCOAction[] {
  const session = activeSessions.get(callUuid);
  
  const message = reason || 'We are currently unavailable. Please leave a message after the tone.';
  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';

  const ncco: NCCOAction[] = [
    {
      action: 'talk',
      text: message,
      voiceName: 'Joey',
    },
    {
      action: 'record',
      eventUrl: [`${webhookBaseUrl}/api/voice/webhook/voicemail/${session?.callId || 0}`],
      beepStart: true,
      endOnSilence: 5,
      endOnKey: '#',
      timeOut: 60,
      format: 'mp3',
    },
    {
      action: 'talk',
      text: 'Thank you for your message. We will get back to you soon. Goodbye!',
      voiceName: 'Joey',
    },
  ];

  return ncco;
}

/**
 * Schedule a callback
 */
export async function scheduleCallback(
  callUuid: string,
  customerPhone: string,
  preferredTime?: Date,
  notes?: string
): Promise<boolean> {
  try {
    const session = activeSessions.get(callUuid);
    if (!session) return false;

    // Get the employee for this business
    const employeeRes = await pool.query(
      `SELECT ae.id FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1
       LIMIT 1`,
      [session.businessId]
    );

    const employeeId = employeeRes.rows[0]?.id;

    // Schedule follow-up in database
    await pool.query(
      `INSERT INTO follow_ups (business_id, customer_phone, scheduled_at, notes, channel, created_by)
       VALUES ($1, $2, $3, $4, 'call', $5)`,
      [
        session.businessId,
        customerPhone,
        preferredTime || new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to tomorrow
        notes || 'Callback requested during voice call',
        employeeId?.toString() || 'system',
      ]
    );

    // Update session metadata
    session.metadata.callbackScheduled = true;
    session.metadata.callbackTime = preferredTime;

    return true;
  } catch (error) {
    console.error('Error scheduling callback:', error);
    return false;
  }
}

/**
 * Handle no input from user (silence timeout)
 */
export async function handleNoInput(callUuid: string, attempt: number = 1): Promise<NCCOAction[]> {
  const session = activeSessions.get(callUuid);
  if (!session) {
    return [
      {
        action: 'talk',
        text: 'Sorry, we lost your session. Please call back.',
        voiceName: 'Joey',
      },
    ];
  }

  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'https://api.botari.ai';

  if (attempt >= 3) {
    // Max attempts reached, end call gracefully
    await endCallSession(callUuid);
    
    return [
      {
        action: 'talk',
        text: "I haven't heard from you. Thank you for calling. Goodbye!",
        voiceName: 'Joey',
      },
    ];
  }

  // Prompt again
  const prompts = [
    "I'm still here. How can I help you today?",
    'Are you there? Please let me know how I can assist you.',
  ];

  return [
    {
      action: 'talk',
      text: prompts[attempt - 1] || prompts[0],
      voiceName: 'Joey',
    },
    {
      action: 'input',
      eventUrl: [`${webhookBaseUrl}/api/voice/webhook/input/${session.callId}?attempt=${attempt + 1}`],
      speech: { language: 'en-US', endOnSilence: 4 },
      type: ['speech'],
    },
  ];
}

/**
 * Clean up stale sessions (calls that have been inactive for too long)
 */
export async function cleanupStaleSessions(maxAgeMinutes: number = 30): Promise<number> {
  const now = new Date();
  let cleanedCount = 0;

  for (const [callUuid, session] of activeSessions.entries()) {
    const ageMinutes = (now.getTime() - session.lastActivityAt.getTime()) / (1000 * 60);

    if (ageMinutes > maxAgeMinutes) {
      await endCallSession(callUuid);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} stale call sessions`);
  }

  return cleanedCount;
}

/**
 * Get call analytics for a business
 */
export async function getCallAnalytics(
  businessId: number,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  avgDuration: number;
  totalCost: number;
  recordingsCount: number;
}> {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
        AVG(duration_seconds) as avg_duration,
        SUM(COALESCE(cost, 0)) as total_cost,
        COUNT(*) FILTER (WHERE recording_url IS NOT NULL) as recordings_count
       FROM calls
       WHERE business_id = $1
       AND started_at >= $2
       AND started_at <= $3`,
      [businessId, startDate, endDate]
    );

    const row = result.rows[0];
    return {
      totalCalls: parseInt(row.total_calls, 10) || 0,
      inboundCalls: parseInt(row.inbound_calls, 10) || 0,
      outboundCalls: parseInt(row.outbound_calls, 10) || 0,
      avgDuration: parseFloat(row.avg_duration) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      recordingsCount: parseInt(row.recordings_count, 10) || 0,
    };
  } catch (error) {
    console.error('Error getting call analytics:', error);
    throw error;
  }
}

// Start cleanup interval
setInterval(() => {
  cleanupStaleSessions();
}, 5 * 60 * 1000); // Run every 5 minutes

// Export default
export default {
  createCallSession,
  getCallSession,
  getCallSessionById,
  updateCallSession,
  addConversationEntry,
  endCallSession,
  getAllActiveSessions,
  getBusinessActiveCallCount,
  bridgeAIAgent,
  transferCall,
  putOnHold,
  resumeFromHold,
  sendToVoicemail,
  scheduleCallback,
  handleNoInput,
  cleanupStaleSessions,
  getCallAnalytics,
};
