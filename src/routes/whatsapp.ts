import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import pool from '../db';
import QRCode from 'qrcode';

const router = Router();

// Store active sessions (use Redis in production)
const whatsappSessions = new Map();

// POST /api/whatsapp/connect - Generate QR code for pairing
router.post('/connect', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId;
    
    // Generate QR code for WhatsApp Web pairing
    const sessionId = `business_${businessId}_${Date.now()}`;
    const qrData = `BOTARI:${sessionId}`;
    const qrCodeUrl = await QRCode.toDataURL(qrData);
    
    whatsappSessions.set(businessId.toString(), {
      sessionId,
      status: 'awaiting_scan',
      qrCode: qrCodeUrl,
      createdAt: new Date()
    });

    res.json({ 
      status: 'awaiting_scan',
      qrCode: qrCodeUrl,
      message: 'Scan this QR code with WhatsApp (Settings > Linked Devices > Link a Device)'
    });
  } catch (err: any) {
    console.error('WhatsApp connect error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GET /api/whatsapp/status - Check connection status
router.get('/status', verifyToken, async (req: any, res: any) => {
  try {
    const businessId = req.userId.toString();
    const session = whatsappSessions.get(businessId);
    
    if (session?.status === 'connected') {
      return res.json({ 
        connected: true,
        status: 'connected',
        message: 'WhatsApp connected and active'
      });
    }
    
    if (session?.status === 'awaiting_scan') {
      return res.json({ 
        connected: false,
        status: 'awaiting_scan',
        qrCode: session.qrCode,
        message: 'Scan QR code to connect'
      });
    }

    res.json({ 
      connected: false,
      status: 'disconnected',
      message: 'WhatsApp not connected. Click connect to start.'
    });
  } catch (err: any) {
    console.error('WhatsApp status error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Webhook for incoming messages
router.post('/webhook', async (req, res) => {
  try {
    const { From, Body } = req.body;
    
    if (!From || !Body) {
      return res.sendStatus(400);
    }
    
    console.log(`WhatsApp from ${From}: ${Body}`);
    
    // Process through AI agent
    const { routeMessage } = await import('../agent');
    const reply = await routeMessage(Body, From, 'whatsapp', 1);
    
    console.log(`Reply: ${reply}`);
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

export default router;