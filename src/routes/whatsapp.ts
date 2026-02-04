import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import pool from '../db';
import QRCode from 'qrcode';

const router = Router();

// Store active sessions in memory (use Redis in production)
const whatsappSessions = new Map();

// POST /api/whatsapp/connect - Generate QR code for pairing
router.post('/connect', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    const { employee_id } = req.body;
    
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    console.log(`Generating QR for business ${businessId}, employee ${employee_id}`);

    // Generate unique session ID
    const sessionId = `biz_${businessId}_emp_${employee_id || 'default'}_${Date.now()}`;
    const qrData = `BOTARI:${sessionId}`;
    const qrCodeUrl = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    // Store session
    whatsappSessions.set(businessId.toString(), {
      sessionId,
      employeeId: employee_id,
      status: 'awaiting_scan',
      qrCode: qrCodeUrl,
      createdAt: new Date()
    });

    // Update employee connection status in DB if employee_id provided
    if (employee_id) {
      await pool.query(
        `UPDATE business_employees 
         SET connection_status = 'connecting', updated_at = NOW()
         WHERE business_id = $1 AND employee_id = $2`,
        [businessId, employee_id]
      );
    }

    res.json({ 
      status: 'awaiting_scan',
      qrCode: qrCodeUrl,
      sessionId,
      message: 'Scan this QR code with WhatsApp (Settings > Linked Devices > Link a Device)'
    });
  } catch (err: any) {
    console.error('WhatsApp connect error:', err);
    res.status(500).json({ error: 'Failed to generate QR code', details: err.message });
  }
});

// GET /api/whatsapp/status - Check connection status
router.get('/status', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    // Get all active employees with their connection status
    const result = await pool.query(
      `SELECT be.employee_id, be.connection_status, be.whatsapp_number, 
              ae.display_name, ae.employee_role
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 AND be.is_active = true`,
      [businessId]
    );

    const employees = result.rows;
    const connected = employees.some((emp: any) => emp.connection_status === 'connected');
    const session = whatsappSessions.get(businessId.toString());
    
    res.json({ 
      connected,
      status: connected ? 'connected' : (session?.status || 'disconnected'),
      employees: employees,
      message: connected ? 'WhatsApp connected and active' : 'WhatsApp not connected'
    });
  } catch (err: any) {
    console.error('WhatsApp status error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// POST /api/whatsapp/verify - Mark connection as successful (simulates QR scan)
router.post('/verify', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    const { employee_id, phone_number } = req.body;
    
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    // Update session
    const sessionKey = businessId.toString();
    if (whatsappSessions.has(sessionKey)) {
      const session = whatsappSessions.get(sessionKey);
      session.status = 'connected';
      session.connectedAt = new Date();
      whatsappSessions.set(sessionKey, session);
    }

    // Update database
    if (employee_id) {
      await pool.query(
        `UPDATE business_employees 
         SET connection_status = 'connected', 
             whatsapp_number = $1,
             updated_at = NOW()
         WHERE business_id = $2 AND employee_id = $3`,
        [phone_number || '+2340000000000', businessId, employee_id]
      );
    }

    res.json({ 
      success: true, 
      status: 'connected',
      message: 'WhatsApp connected successfully' 
    });
  } catch (err: any) {
    console.error('WhatsApp verify error:', err);
    res.status(500).json({ error: 'Failed to verify connection' });
  }
});

// POST /api/whatsapp/disconnect - Disconnect WhatsApp
router.post('/disconnect', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    const { employee_id } = req.body;
    
    if (!businessId) {
      return res.status(401).json({ error: 'Business ID not found' });
    }

    // Remove session
    whatsappSessions.delete(businessId.toString());

    // Update database
    if (employee_id) {
      await pool.query(
        `UPDATE business_employees 
         SET connection_status = 'disconnected',
             updated_at = NOW()
         WHERE business_id = $1 AND employee_id = $2`,
        [businessId, employee_id]
      );
    }

    res.json({ 
      success: true, 
      message: 'WhatsApp disconnected successfully' 
    });
  } catch (err: any) {
    console.error('WhatsApp disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Webhook for incoming messages (from Twilio or WhatsApp Business API)
router.post('/webhook', async (req, res) => {
  try {
    const { From, Body, WaId } = req.body;
    
    if (!From || !Body) {
      return res.sendStatus(400);
    }
    
    console.log(`WhatsApp from ${From}: ${Body}`);
    
    // TODO: Process through AI agent
    // const { routeMessage } = await import('../agent');
    // const reply = await routeMessage(Body, From, 'whatsapp', 1);
    
    console.log(`Webhook received - To be processed by AI`);
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// Get QR code for current session
router.get('/qr', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId || req.user?.business_id;
    const session = whatsappSessions.get(businessId.toString());
    
    if (!session || session.status !== 'awaiting_scan') {
      return res.status(404).json({ error: 'No active QR code session' });
    }
    
    res.json({
      qrCode: session.qrCode,
      status: session.status,
      createdAt: session.createdAt
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

export default router;