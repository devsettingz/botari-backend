/**
 * Calls API Routes
 * Botari AI - Voice Call Management
 * 
 * Endpoints:
 * - POST /calls/outbound - Make outbound call
 * - GET /calls - List call history
 * - GET /calls/active - Get active calls
 * - GET /calls/analytics - Get call analytics
 * - GET /calls/:id - Get call details
 * - POST /calls/:id/end - End active call
 * - POST /calls/:id/record - Start recording
 * - POST /calls/:id/transfer - Transfer call
 * - POST /calls/:id/hold - Put call on hold
 * - POST /calls/:id/resume - Resume from hold
 * - POST /calls/:id/summary - Generate AI summary
 * - DELETE /calls/:id - Delete call record
 */

import { Router } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import pool from '../db';
import {
  makeOutboundCall,
  getCallHistory,
  getCallDetails,
  endCall,
  startRecording,
  generateCallSummary,
  getActiveCalls,
  checkVonageHealth,
} from '../voice/VonageService';
import {
  transferCall,
  putOnHold,
  resumeFromHold,
  getCallSessionById,
  getAllActiveSessions,
  getCallAnalytics,
  endCallSession,
} from '../voice/CallManager';

const router = Router();

/**
 * POST /calls/outbound
 * Make an outbound call
 */
router.post('/outbound', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const { 
      phoneNumber, 
      employeeId, 
      greetingText, 
      voiceName = 'Joey',
      metadata 
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Validate phone number format
    const phoneRegex = /^\+?[\d\s-()]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Get employee ID (default to voice agent for business)
    let targetEmployeeId = employeeId;
    if (!targetEmployeeId) {
      const agentRes = await pool.query(
        `SELECT be.employee_id 
         FROM business_employees be
         JOIN ai_employees ae ON be.employee_id = ae.id
         WHERE be.business_id = $1 
         AND (ae.employee_role ILIKE '%Voice%' OR ae.employee_role ILIKE '%Receptionist%' OR ae.employee_role ILIKE '%Call%')
         LIMIT 1`,
        [businessId]
      );
      targetEmployeeId = agentRes.rows[0]?.employee_id;

      if (!targetEmployeeId) {
        return res.status(400).json({ 
          error: 'No voice agent found for this business. Please assign a voice agent first.' 
        });
      }
    }

    // Make the call
    const result = await makeOutboundCall(
      phoneNumber,
      businessId,
      targetEmployeeId,
      {
        greetingText,
        voiceName,
        metadata: { ...metadata, initiated_by: req.user?.id },
      }
    );

    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Failed to initiate call',
        details: result
      });
    }

    res.json({
      success: true,
      message: 'Call initiated successfully',
      callId: result.dbId,
      callUuid: result.callUuid,
    });
  } catch (error: any) {
    console.error('Error making outbound call:', error);
    res.status(500).json({ 
      error: 'Failed to make outbound call',
      message: error.message 
    });
  }
});

/**
 * GET /calls
 * Get call history for business
 */
router.get('/', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const { 
      limit = '20', 
      offset = '0', 
      status, 
      startDate, 
      endDate,
      direction 
    } = req.query;

    // Build query
    let query = 'SELECT * FROM calls WHERE business_id = $1';
    const params: any[] = [businessId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (direction) {
      query += ` AND direction = $${paramIndex++}`;
      params.push(direction);
    }

    if (startDate) {
      query += ` AND started_at >= $${paramIndex++}`;
      params.push(new Date(startDate as string));
    }

    if (endDate) {
      query += ` AND started_at <= $${paramIndex++}`;
      params.push(new Date(endDate as string));
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) as count_query`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get calls with pagination
    params.push(parseInt(limit as string, 10));
    params.push(parseInt(offset as string, 10));
    
    const callsResult = await pool.query(
      `${query} ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    res.json({
      calls: callsResult.rows,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error('Error getting call history:', error);
    res.status(500).json({ 
      error: 'Failed to get call history',
      message: error.message 
    });
  }
});

/**
 * GET /calls/active
 * Get active calls for business
 */
router.get('/active', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    // Get active calls from database
    const activeCalls = await getActiveCalls(businessId);

    // Get active sessions (in-memory)
    const activeSessions = getAllActiveSessions()
      .filter(s => s.businessId === businessId);

    res.json({
      calls: activeCalls,
      sessions: activeSessions.map(s => ({
        callId: s.callId,
        callUuid: s.callUuid,
        status: s.status,
        customerPhone: s.customerPhone,
        direction: s.direction,
        startedAt: s.startedAt,
        lastActivityAt: s.lastActivityAt,
      })),
      total: activeCalls.length,
    });
  } catch (error: any) {
    console.error('Error getting active calls:', error);
    res.status(500).json({ 
      error: 'Failed to get active calls',
      message: error.message 
    });
  }
});

/**
 * GET /calls/analytics
 * Get call analytics for business
 */
router.get('/analytics', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const analytics = await getCallAnalytics(businessId, start, end);

    // Get additional stats
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
        COUNT(*) FILTER (WHERE recording_url IS NOT NULL) as recorded_calls,
        AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration_seconds
       FROM calls
       WHERE business_id = $1
       AND started_at >= $2
       AND started_at <= $3`,
      [businessId, start, end]
    );

    res.json({
      ...analytics,
      ...statsResult.rows[0],
      period: { start, end },
    });
  } catch (error: any) {
    console.error('Error getting call analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get call analytics',
      message: error.message 
    });
  }
});

/**
 * GET /calls/:id
 * Get call details
 */
router.get('/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    // Get call details
    const call = await getCallDetails(callId, businessId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Get active session if exists
    const session = getCallSessionById(callId);

    res.json({
      ...call,
      activeSession: session ? {
        status: session.status,
        conversationHistory: session.conversationHistory,
        metadata: session.metadata,
      } : null,
    });
  } catch (error: any) {
    console.error('Error getting call details:', error);
    res.status(500).json({ 
      error: 'Failed to get call details',
      message: error.message 
    });
  }
});

/**
 * POST /calls/:id/end
 * End an active call
 */
router.post('/:id/end', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    // Get call details
    const call = await getCallDetails(callId, businessId);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // End the call
    const success = await endCall(callId, call.vonage_call_uuid || undefined);

    // Also end any active session
    if (call.vonage_call_uuid) {
      await endCallSession(call.vonage_call_uuid);
    }

    if (success) {
      res.json({ success: true, message: 'Call ended successfully' });
    } else {
      res.status(500).json({ error: 'Failed to end call' });
    }
  } catch (error: any) {
    console.error('Error ending call:', error);
    res.status(500).json({ 
      error: 'Failed to end call',
      message: error.message 
    });
  }
});

/**
 * POST /calls/:id/record
 * Start recording a call
 */
router.post('/:id/record', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    // Get call details
    const call = await getCallDetails(callId, businessId);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!call.vonage_call_uuid) {
      return res.status(400).json({ error: 'Call does not have an active UUID' });
    }

    // Start recording
    const success = await startRecording(callId, call.vonage_call_uuid);

    if (success) {
      res.json({ success: true, message: 'Recording started' });
    } else {
      res.status(500).json({ error: 'Failed to start recording' });
    }
  } catch (error: any) {
    console.error('Error starting recording:', error);
    res.status(500).json({ 
      error: 'Failed to start recording',
      message: error.message 
    });
  }
});

/**
 * POST /calls/:id/transfer
 * Transfer a call to another number
 */
router.post('/:id/transfer', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    const { targetNumber, message } = req.body;
    if (!targetNumber) {
      return res.status(400).json({ error: 'Target number is required' });
    }

    // Get call details
    const call = await getCallDetails(callId, businessId);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!call.vonage_call_uuid) {
      return res.status(400).json({ error: 'Call does not have an active UUID' });
    }

    // Generate transfer NCCO
    const ncco = await transferCall(call.vonage_call_uuid, targetNumber, {
      whisperMessage: message,
    });

    // Update call metadata
    await pool.query(
      `UPDATE calls SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{transfer_initiated}', $1) WHERE id = $2`,
      [JSON.stringify({ targetNumber, at: new Date().toISOString() }), callId]
    );

    res.json({ 
      success: true, 
      message: 'Transfer initiated',
      ncco 
    });
  } catch (error: any) {
    console.error('Error transferring call:', error);
    res.status(500).json({ 
      error: 'Failed to transfer call',
      message: error.message 
    });
  }
});

/**
 * POST /calls/:id/hold
 * Put a call on hold
 */
router.post('/:id/hold', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    // Get call details
    const call = await getCallDetails(callId, businessId);
    if (!call || !call.vonage_call_uuid) {
      return res.status(404).json({ error: 'Active call not found' });
    }

    // Generate hold NCCO
    const ncco = putOnHold(call.vonage_call_uuid);

    res.json({ 
      success: true, 
      message: 'Call put on hold',
      ncco 
    });
  } catch (error: any) {
    console.error('Error putting call on hold:', error);
    res.status(500).json({ 
      error: 'Failed to put call on hold',
      message: error.message 
    });
  }
});

/**
 * POST /calls/:id/resume
 * Resume a call from hold
 */
router.post('/:id/resume', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    const { message } = req.body;

    // Get call details
    const call = await getCallDetails(callId, businessId);
    if (!call || !call.vonage_call_uuid) {
      return res.status(404).json({ error: 'Active call not found' });
    }

    // Generate resume NCCO
    const ncco = await resumeFromHold(call.vonage_call_uuid, message);

    res.json({ 
      success: true, 
      message: 'Call resumed',
      ncco 
    });
  } catch (error: any) {
    console.error('Error resuming call:', error);
    res.status(500).json({ 
      error: 'Failed to resume call',
      message: error.message 
    });
  }
});

/**
 * POST /calls/:id/summary
 * Generate AI summary for a call
 */
router.post('/:id/summary', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    // Get call details
    const call = await getCallDetails(callId, businessId);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Generate summary
    const summary = await generateCallSummary(callId);

    if (summary) {
      res.json({ success: true, summary });
    } else {
      res.status(400).json({ 
        error: 'Could not generate summary. Ensure call has a transcript.' 
      });
    }
  } catch (error: any) {
    console.error('Error generating call summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary',
      message: error.message 
    });
  }
});

/**
 * DELETE /calls/:id
 * Delete a call record
 */
router.delete('/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const callId = parseInt(req.params.id as string, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call ID' });
    }

    // Delete the call
    const result = await pool.query(
      'DELETE FROM calls WHERE id = $1 AND business_id = $2 RETURNING id',
      [callId, businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json({ success: true, message: 'Call record deleted' });
  } catch (error: any) {
    console.error('Error deleting call:', error);
    res.status(500).json({ 
      error: 'Failed to delete call',
      message: error.message 
    });
  }
});

/**
 * GET /calls/health/vonage
 * Check Vonage service health
 */
router.get('/health/vonage', verifyToken, async (req: AuthRequest, res) => {
  try {
    const health = await checkVonageHealth();
    res.json(health);
  } catch (error: any) {
    console.error('Error checking Vonage health:', error);
    res.status(500).json({ 
      healthy: false,
      message: error.message 
    });
  }
});

/**
 * Legacy webhook handler for Twilio (backward compatibility)
 * POST /calls/incoming/:businessId
 */
router.post('/incoming/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { From, CallSid } = req.body;

    // Find Rachel (Voice Agent)
    const agentRes = await pool.query(
      `SELECT ae.* FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 
       AND (ae.employee_role ILIKE '%Receptionist%' OR ae.employee_role ILIKE '%Voice%')
       LIMIT 1`,
      [businessId]
    );

    const agent = agentRes.rows[0];

    // TwiML response (Twilio's XML)
    const twiml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="woman" language="en-NG">
          Hello, you've reached ${agent?.display_name || 'our AI receptionist'}. 
          I'm handling calls for this business today.
        </Say>
        <Pause length="1"/>
        <Say>Please state your name and how I can help you after the tone.</Say>
        <Record maxLength="60" transcribe="true" transcribeCallback="/api/calls/transcribe/${businessId}"/>
        <Say>Thank you. We will get back to you shortly. Goodbye!</Say>
      </Response>
    `;

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.type('text/xml');
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>Sorry, we are experiencing technical difficulties. Please try again later.</Say>
      </Response>
    `);
  }
});

/**
 * Legacy transcription handler for Twilio (backward compatibility)
 * POST /calls/transcribe/:businessId
 */
router.post('/transcribe/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { TranscriptionText, From, RecordingUrl } = req.body;

    console.log(`📞 Call from ${From}: ${TranscriptionText}`);

    // Save to database
    await pool.query(
      `INSERT INTO calls 
       (business_id, customer_phone, transcript, recording_url, status, started_at, ended_at)
       VALUES ($1, $2, $3, $4, 'transcribed', NOW(), NOW())`,
      [businessId, From, TranscriptionText, RecordingUrl]
    );

    // Create follow-up reminder
    await pool.query(
      `INSERT INTO follow_ups (business_id, customer_phone, scheduled_at, notes, channel, created_by)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour', $3, 'call', 'system')`,
      [businessId, From, `Missed call from ${From}. Message: ${TranscriptionText}`]
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling transcription:', error);
    res.sendStatus(200);
  }
});

/**
 * Legacy call history endpoint (backward compatibility)
 * GET /calls/history
 */
router.get('/history', verifyToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const result = await pool.query(
      `SELECT * FROM calls WHERE business_id = $1 ORDER BY started_at DESC LIMIT 20`,
      [businessId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error getting call history:', error);
    res.status(500).json({ error: 'Failed to get call history' });
  }
});

export default router;
