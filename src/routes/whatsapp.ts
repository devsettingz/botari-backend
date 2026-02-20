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

import { Router } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import pool from '../db';
import { baileysManager } from '../whatsapp';

const router = Router();

/**
 * POST /api/whatsapp/connect
 * Start WhatsApp connection and generate QR code
 */
router.post('/connect', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { employee_id } = req.body;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    console.log(`[WhatsApp API] Starting connection for business ${businessId}, employee ${employee_id}`);

    // Start connection and get QR code
    const connectionQR = await baileysManager.connect(businessId, employee_id);

    res.json({
      success: true,
      status: 'awaiting_qr',
      qrCode: connectionQR.qrCode,
      sessionId: connectionQR.sessionId,
      expiresAt: connectionQR.expiresAt,
      message: 'Scan this QR code with WhatsApp (Settings > Linked Devices > Link a Device)'
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Connect error:', err);
    
    if (err.message === 'WhatsApp is already connected for this business') {
      return res.status(409).json({ 
        error: 'Already connected',
        message: err.message 
      });
    }

    res.status(500).json({ 
      error: 'Failed to start WhatsApp connection', 
      details: err.message 
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Get WhatsApp connection status
 */
router.get('/status', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { employee_id } = req.query;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    // Get status from manager
    const empId = employee_id ? parseInt(employee_id as string) : await getDefaultEmployeeId(businessId);
    const status = baileysManager.getStatus(businessId, empId);

    // Get all employees with their connection status from database
    const result = await pool.query(
      `SELECT 
        be.employee_id,
        be.connection_status,
        be.whatsapp_number,
        be.is_active,
        be.hired_at,
        be.messages_processed,
        be.last_active,
        ae.display_name,
        ae.employee_role,
        ae.icon_emoji
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 AND be.is_active = true
       ORDER BY be.hired_at DESC`,
      [businessId]
    );

    const employees = result.rows;

    res.json({
      success: true,
      connected: status.connected,
      status: status.status,
      phoneNumber: status.phoneNumber,
      lastActivity: status.lastActivity,
      connectedAt: status.connectedAt,
      employees: employees,
      message: status.connected 
        ? 'WhatsApp connected and active' 
        : 'WhatsApp not connected'
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Status error:', err);
    res.status(500).json({ 
      error: 'Failed to check WhatsApp status',
      details: err.message 
    });
  }
});

/**
 * POST /api/whatsapp/disconnect
 * Disconnect WhatsApp session
 */
router.post('/disconnect', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { employee_id, logout = false } = req.body;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const empId = employee_id || await getDefaultEmployeeId(businessId);

    console.log(`[WhatsApp API] Disconnecting business ${businessId}, employee ${empId} (logout: ${logout})`);

    await baileysManager.disconnect(businessId, empId, logout);

    res.json({
      success: true,
      status: 'disconnected',
      message: logout 
        ? 'WhatsApp logged out successfully' 
        : 'WhatsApp disconnected successfully'
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Disconnect error:', err);
    res.status(500).json({ 
      error: 'Failed to disconnect WhatsApp',
      details: err.message 
    });
  }
});

/**
 * POST /api/whatsapp/send
 * Send a WhatsApp message
 */
router.post('/send', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { to, message, employee_id } = req.body;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    if (!to || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['to', 'message']
      });
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to.replace(/\s/g, ''))) {
      return res.status(400).json({ 
        error: 'Invalid phone number format',
        example: '+1234567890'
      });
    }

    console.log(`[WhatsApp API] Sending message from business ${businessId} to ${to}`);

    await baileysManager.sendMessage(businessId, to, message);

    res.json({
      success: true,
      message: 'Message sent successfully',
      recipient: to,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Send error:', err);
    
    if (err.message === 'WhatsApp is not connected') {
      return res.status(400).json({ 
        error: 'WhatsApp not connected',
        message: 'Please connect WhatsApp first using /api/whatsapp/connect'
      });
    }

    res.status(500).json({ 
      error: 'Failed to send message',
      details: err.message 
    });
  }
});

/**
 * POST /api/whatsapp/broadcast
 * Send message to multiple recipients
 */
router.post('/broadcast', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { recipients, message, delay_ms = 1000 } = req.body;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid recipients',
        message: 'recipients must be a non-empty array of phone numbers'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Limit broadcast size
    if (recipients.length > 100) {
      return res.status(400).json({ 
        error: 'Too many recipients',
        message: 'Maximum 100 recipients allowed per broadcast'
      });
    }

    console.log(`[WhatsApp API] Broadcasting message from business ${businessId} to ${recipients.length} recipients`);

    const results = await baileysManager.broadcastMessage(
      businessId,
      recipients,
      message,
      delay_ms
    );

    res.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: recipients.length,
      errors: results.errors
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Broadcast error:', err);
    res.status(500).json({ 
      error: 'Failed to broadcast message',
      details: err.message 
    });
  }
});

/**
 * GET /api/whatsapp/qr
 * Get current QR code for connection
 */
router.get('/qr', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { employee_id } = req.query;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const empId = employee_id ? parseInt(employee_id as string) : await getDefaultEmployeeId(businessId);
    const qrCode = baileysManager.getQRCode(businessId, empId);

    if (!qrCode) {
      // Check if already connected
      const status = baileysManager.getStatus(businessId, empId);
      if (status.connected) {
        return res.status(400).json({ 
          error: 'Already connected',
          message: 'WhatsApp is already connected'
        });
      }
      
      return res.status(404).json({ 
        error: 'No QR code available',
        message: 'Start a connection first using /api/whatsapp/connect'
      });
    }

    res.json({
      success: true,
      qrCode: qrCode,
      status: 'awaiting_qr',
      message: 'Scan this QR code with WhatsApp'
    });

  } catch (err: any) {
    console.error('[WhatsApp API] QR code error:', err);
    res.status(500).json({ 
      error: 'Failed to get QR code',
      details: err.message 
    });
  }
});

/**
 * GET /api/whatsapp/sessions
 * Get all active sessions for the business
 */
router.get('/sessions', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const allSessions = baileysManager.getAllSessions();
    const businessSessions = allSessions
      .filter(s => s.businessId === businessId)
      .map(s => ({
        businessId: s.businessId,
        employeeId: s.employeeId,
        status: s.status,
        phoneNumber: s.phoneNumber,
        connectedAt: s.connectedAt,
        lastActivity: s.lastActivity
      }));

    res.json({
      success: true,
      sessions: businessSessions,
      count: businessSessions.length
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Sessions error:', err);
    res.status(500).json({ 
      error: 'Failed to get sessions',
      details: err.message 
    });
  }
});

/**
 * POST /api/whatsapp/reconnect
 * Force reconnect a session
 */
router.post('/reconnect', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const businessId = req.user?.business_id;
    const { employee_id } = req.body;

    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    const empId = employee_id || await getDefaultEmployeeId(businessId);

    console.log(`[WhatsApp API] Reconnecting business ${businessId}, employee ${empId}`);

    // Disconnect first
    await baileysManager.disconnect(businessId, empId, false);
    
    // Reconnect
    const connectionQR = await baileysManager.connect(businessId, empId);

    res.json({
      success: true,
      status: 'awaiting_qr',
      qrCode: connectionQR.qrCode,
      sessionId: connectionQR.sessionId,
      expiresAt: connectionQR.expiresAt,
      message: 'Scan this QR code to reconnect WhatsApp'
    });

  } catch (err: any) {
    console.error('[WhatsApp API] Reconnect error:', err);
    res.status(500).json({ 
      error: 'Failed to reconnect WhatsApp',
      details: err.message 
    });
  }
});

/**
 * Helper function to get default employee ID for a business
 */
async function getDefaultEmployeeId(businessId: number): Promise<number> {
  const result = await pool.query(
    `SELECT employee_id 
     FROM business_employees 
     WHERE business_id = $1 AND is_active = true 
     ORDER BY hired_at ASC 
     LIMIT 1`,
    [businessId]
  );

  if (result.rows.length === 0) {
    throw new Error('No active employees found for this business');
  }

  return result.rows[0].employee_id;
}

export default router;
