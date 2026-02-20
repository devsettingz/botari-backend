/**
 * WhatsApp Baileys Connector for Botari AI
 * 
 * This module provides a complete WhatsApp Web integration using @adiwajshing/baileys.
 * It supports multi-business sessions, auto-reconnection, message persistence,
 * and AI agent integration.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  AnyMessageContent,
  proto,
  BaileysEventMap,
  isJidUser,
  fetchLatestBaileysVersion
} from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import { Pool } from 'pg';
import { routeMessage } from '../agent';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'awaiting_qr' 
  | 'connected' 
  | 'reconnecting';

export interface WhatsAppSession {
  businessId: number;
  employeeId: number;
  socket: WASocket | null;
  status: ConnectionStatus;
  qrCode: string | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastActivity: Date;
  reconnectAttempts: number;
  sessionPath: string;
  phoneNumber: string | null;
}

export interface MessageHistory {
  id: number;
  businessId: number;
  from: string;
  to: string;
  content: string;
  direction: 'incoming' | 'outgoing';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface ConnectionQR {
  qrCode: string;
  sessionId: string;
  expiresAt: Date;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

class WhatsAppDatabase {
  /**
   * Get or create a WhatsApp session record in the database
   */
  static async getSession(businessId: number, employeeId: number): Promise<any | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM whatsapp_sessions 
         WHERE business_id = $1 AND employee_id = $2`,
        [businessId, employeeId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting session from DB:', error);
      return null;
    }
  }

  /**
   * Save or update session credentials
   */
  static async saveSession(
    businessId: number, 
    employeeId: number, 
    status: ConnectionStatus,
    phoneNumber?: string | null,
    credentials?: any
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO whatsapp_sessions 
         (business_id, employee_id, status, phone_number, credentials, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (business_id, employee_id) 
         DO UPDATE SET 
           status = EXCLUDED.status,
           phone_number = COALESCE(EXCLUDED.phone_number, whatsapp_sessions.phone_number),
           credentials = COALESCE(EXCLUDED.credentials, whatsapp_sessions.credentials),
           updated_at = NOW()`,
        [businessId, employeeId, status, phoneNumber, credentials ? JSON.stringify(credentials) : null]
      );
    } catch (error) {
      console.error('Error saving session to DB:', error);
    }
  }

  /**
   * Update employee connection status in business_employees table
   */
  static async updateEmployeeStatus(
    businessId: number, 
    employeeId: number, 
    status: ConnectionStatus,
    phoneNumber?: string
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE business_employees 
         SET connection_status = $1, 
             whatsapp_number = COALESCE($2, whatsapp_number),
             updated_at = NOW()
         WHERE business_id = $3 AND employee_id = $4`,
        [status, phoneNumber, businessId, employeeId]
      );
    } catch (error) {
      console.error('Error updating employee status:', error);
    }
  }

  /**
   * Save message to history
   */
  static async saveMessage(
    businessId: number,
    from: string,
    to: string,
    content: string,
    direction: 'incoming' | 'outgoing',
    status: 'sent' | 'delivered' | 'read' | 'failed' = 'sent'
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO whatsapp_messages 
         (business_id, sender, recipient, content, direction, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [businessId, from, to, content, direction, status]
      );
    } catch (error) {
      console.error('Error saving message to DB:', error);
    }
  }

  /**
   * Get all active sessions for restoration on startup
   */
  static async getAllActiveSessions(): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT ws.*, be.business_id 
         FROM whatsapp_sessions ws
         JOIN business_employees be ON ws.business_id = be.business_id AND ws.employee_id = be.employee_id
         WHERE ws.status IN ('connected', 'connecting')`
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }
}

// ============================================================================
// WHATSAPP MANAGER CLASS
// ============================================================================

export class WhatsAppManager {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private readonly baseSessionPath: string;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.baseSessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions';
    this.ensureSessionDirectory();
  }

  private ensureSessionDirectory(): void {
    if (!fs.existsSync(this.baseSessionPath)) {
      fs.mkdirSync(this.baseSessionPath, { recursive: true });
    }
  }

  private getSessionKey(businessId: number, employeeId: number): string {
    return `${businessId}_${employeeId}`;
  }

  private getSessionPath(businessId: number, employeeId: number): string {
    return path.join(this.baseSessionPath, `session_${businessId}_${employeeId}`);
  }

  /**
   * Initialize the manager and restore any persisted sessions
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing WhatsApp Manager...');
    
    // Restore sessions from database on startup
    const activeSessions = await WhatsAppDatabase.getAllActiveSessions();
    
    for (const session of activeSessions) {
      console.log(`🔄 Restoring session for business ${session.business_id}, employee ${session.employee_id}`);
      try {
        await this.connect(session.business_id, session.employee_id);
      } catch (error) {
        console.error(`Failed to restore session for business ${session.business_id}:`, error);
      }
    }
    
    console.log('✅ WhatsApp Manager initialized');
  }

  /**
   * Create a new WhatsApp connection and return QR code
   */
  async connect(businessId: number, employeeId: number): Promise<ConnectionQR> {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    
    // Check if already connected
    const existingSession = this.sessions.get(sessionKey);
    if (existingSession?.status === 'connected') {
      throw new Error('WhatsApp is already connected for this business');
    }

    // Clean up existing session if any
    if (existingSession) {
      await this.disconnect(businessId, employeeId);
    }

    const sessionPath = this.getSessionPath(businessId, employeeId);
    
    // Initialize session object
    const session: WhatsAppSession = {
      businessId,
      employeeId,
      socket: null,
      status: 'connecting',
      qrCode: null,
      connectedAt: null,
      disconnectedAt: null,
      lastActivity: new Date(),
      reconnectAttempts: 0,
      sessionPath,
      phoneNumber: null
    };

    this.sessions.set(sessionKey, session);

    // Update database status
    await WhatsAppDatabase.updateEmployeeStatus(businessId, employeeId, 'connecting');
    await WhatsAppDatabase.saveSession(businessId, employeeId, 'connecting');

    return new Promise((resolve, reject) => {
      this.createBaileysConnection(session, resolve, reject);
    });
  }

  /**
   * Create the actual Baileys connection
   */
  private async createBaileysConnection(
    session: WhatsAppSession,
    resolve: (qr: ConnectionQR) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    try {
      // Get latest Baileys version for compatibility
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

      // Initialize auth state
      const { state, saveCreds } = await useMultiFileAuthState(session.sessionPath);

      // Create the socket
      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['Botari AI', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false,
        getMessage: async () => undefined
      });

      session.socket = sock;

      // Handle connection updates
      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        await this.handleConnectionUpdate(session, update, resolve, reject);
      });

      // Handle credential updates
      sock.ev.on('creds.update', async (creds: any) => {
        await saveCreds();
        // Save credentials to database for persistence
        await WhatsAppDatabase.saveSession(
          session.businessId,
          session.employeeId,
          session.status,
          session.phoneNumber,
          creds
        );
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (m: BaileysEventMap['messages.upsert']) => {
        await this.handleIncomingMessage(session, m);
      });

      // Handle message status updates (delivered, read)
      sock.ev.on('messages.update', async (update: BaileysEventMap['messages.update']) => {
        console.log(`Message update for business ${session.businessId}:`, update);
      });

    } catch (error) {
      console.error('Error creating Baileys connection:', error);
      session.status = 'disconnected';
      reject(error instanceof Error ? error : new Error('Failed to create connection'));
    }
  }

  /**
   * Handle connection state updates from Baileys
   */
  private async handleConnectionUpdate(
    session: WhatsAppSession,
    update: Partial<ConnectionState>,
    resolve?: (qr: ConnectionQR) => void,
    reject?: (error: Error) => void
  ): Promise<void> {
    const { connection, lastDisconnect, qr } = update;
    const sessionKey = this.getSessionKey(session.businessId, session.employeeId);

    // Handle QR code generation
    if (qr && resolve) {
      console.log(`📱 QR Code generated for business ${session.businessId}`);
      
      try {
        // Generate QR code as data URL
        const qrCodeUrl = await QRCode.toDataURL(qr, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        session.qrCode = qrCodeUrl;
        session.status = 'awaiting_qr';

        await WhatsAppDatabase.updateEmployeeStatus(
          session.businessId, 
          session.employeeId, 
          'awaiting_qr'
        );

        resolve({
          qrCode: qrCodeUrl,
          sessionId: sessionKey,
          expiresAt: new Date(Date.now() + 60000) // QR expires in 60 seconds
        });
      } catch (error) {
        reject?.(error instanceof Error ? error : new Error('Failed to generate QR code'));
      }
    }

    // Handle connection state changes
    if (connection) {
      switch (connection) {
        case 'connecting':
          session.status = 'connecting';
          console.log(`🔄 Connecting WhatsApp for business ${session.businessId}...`);
          break;

        case 'open':
          session.status = 'connected';
          session.connectedAt = new Date();
          session.reconnectAttempts = 0;
          session.qrCode = null;

          // Get the connected phone number
          const user = session.socket?.user;
          if (user?.id) {
            session.phoneNumber = user.id.split(':')[0];
          }

          console.log(`✅ WhatsApp connected for business ${session.businessId} (${session.phoneNumber})`);

          await WhatsAppDatabase.updateEmployeeStatus(
            session.businessId,
            session.employeeId,
            'connected',
            session.phoneNumber || undefined
          );

          await WhatsAppDatabase.saveSession(
            session.businessId,
            session.employeeId,
            'connected',
            session.phoneNumber
          );
          break;

        case 'close':
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`❌ WhatsApp disconnected for business ${session.businessId}. Reason: ${statusCode}`);

          session.status = 'disconnected';
          session.disconnectedAt = new Date();
          session.socket = null;

          await WhatsAppDatabase.updateEmployeeStatus(
            session.businessId,
            session.employeeId,
            'disconnected'
          );

          await WhatsAppDatabase.saveSession(
            session.businessId,
            session.employeeId,
            'disconnected'
          );

          // Auto-reconnect if not logged out
          if (shouldReconnect && session.reconnectAttempts < this.maxReconnectAttempts) {
            session.reconnectAttempts++;
            session.status = 'reconnecting';
            console.log(`🔄 Auto-reconnecting (attempt ${session.reconnectAttempts})...`);
            
            setTimeout(() => {
              this.connect(session.businessId, session.employeeId).catch(console.error);
            }, 5000 * session.reconnectAttempts);
          } else if (session.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`Max reconnection attempts reached for business ${session.businessId}`);
          }
          break;

        default:
          console.log(`Connection state for business ${session.businessId}: ${connection}`);
      }
    }
  }

  /**
   * Handle incoming messages from WhatsApp
   */
  private async handleIncomingMessage(
    session: WhatsAppSession,
    m: BaileysEventMap['messages.upsert']
  ): Promise<void> {
    const msg = m.messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    // Only process user messages (not group or status)
    if (!isJidUser(msg.key.remoteJid!)) return;

    const sender = msg.key.remoteJid!;
    const phoneNumber = sender.split('@')[0];
    
    // Extract message text
    const text = this.extractMessageText(msg.message);
    if (!text.trim()) return;

    session.lastActivity = new Date();

    console.log(`📩 WhatsApp from ${phoneNumber} (Business ${session.businessId}): ${text.substring(0, 50)}...`);

    // Save incoming message
    await WhatsAppDatabase.saveMessage(
      session.businessId,
      phoneNumber,
      session.phoneNumber || 'bot',
      text,
      'incoming',
      'delivered'
    );

    try {
      // Process through AI agent
      const reply = await routeMessage(
        text,
        phoneNumber,
        'whatsapp',
        session.businessId
      );

      // Send AI reply
      await this.sendMessage(session.businessId, sender, reply);

    } catch (error) {
      console.error('Error processing WhatsApp message:', error);
      
      // Send error message to user
      await this.sendMessage(
        session.businessId,
        sender,
        "Sorry, I'm having technical difficulties. Please try again shortly."
      );
    }
  }

  /**
   * Extract text from various message types
   */
  private extractMessageText(message: proto.IMessage): string {
    if (message.conversation) {
      return message.conversation;
    }
    if (message.extendedTextMessage?.text) {
      return message.extendedTextMessage.text;
    }
    if (message.imageMessage?.caption) {
      return `[Image] ${message.imageMessage.caption}`;
    }
    if (message.videoMessage?.caption) {
      return `[Video] ${message.videoMessage.caption}`;
    }
    if (message.audioMessage) {
      return '[Audio message]';
    }
    if (message.documentMessage) {
      return `[Document: ${message.documentMessage.fileName || 'file'}]`;
    }
    if (message.locationMessage) {
      return `[Location: ${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}]`;
    }
    return '';
  }

  /**
   * Send a message via WhatsApp
   */
  async sendMessage(
    businessId: number,
    to: string,
    message: string,
    options?: { media?: any }
  ): Promise<void> {
    // Find session for this business
    const session = this.findSessionByBusinessId(businessId);
    
    if (!session) {
      throw new Error(`No WhatsApp session found for business ${businessId}`);
    }

    if (session.status !== 'connected' || !session.socket) {
      throw new Error('WhatsApp is not connected');
    }

    // Ensure proper JID format
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    try {
      const messageContent: AnyMessageContent = options?.media 
        ? { ...options.media, caption: message }
        : { text: message };

      const result = await session.socket.sendMessage(jid, messageContent);

      // Save outgoing message
      await WhatsAppDatabase.saveMessage(
        businessId,
        session.phoneNumber || 'bot',
        to.replace('@s.whatsapp.net', ''),
        message,
        'outgoing',
        'sent'
      );

      console.log(`✅ Message sent to ${to} for business ${businessId}`);

    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Disconnect a WhatsApp session
   */
  async disconnect(businessId: number, employeeId: number, logout: boolean = false): Promise<void> {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      console.log(`No active session found for business ${businessId}, employee ${employeeId}`);
      return;
    }

    console.log(`Disconnecting WhatsApp for business ${businessId}...`);

    try {
      if (session.socket) {
        if (logout) {
          await session.socket.logout();
        } else {
          session.socket.end(undefined);
        }
      }
    } catch (error) {
      console.error('Error during disconnect:', error);
    }

    // Clean up session files if logging out
    if (logout && fs.existsSync(session.sessionPath)) {
      fs.rmSync(session.sessionPath, { recursive: true, force: true });
    }

    // Update database
    await WhatsAppDatabase.updateEmployeeStatus(businessId, employeeId, 'disconnected');
    await WhatsAppDatabase.saveSession(businessId, employeeId, 'disconnected');

    // Remove from memory
    this.sessions.delete(sessionKey);

    console.log(`✅ WhatsApp disconnected for business ${businessId}`);
  }

  /**
   * Get connection status for a business
   */
  getStatus(businessId: number, employeeId: number): {
    status: ConnectionStatus;
    connected: boolean;
    phoneNumber: string | null;
    lastActivity: Date | null;
    connectedAt: Date | null;
  } {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        status: 'disconnected',
        connected: false,
        phoneNumber: null,
        lastActivity: null,
        connectedAt: null
      };
    }

    return {
      status: session.status,
      connected: session.status === 'connected',
      phoneNumber: session.phoneNumber,
      lastActivity: session.lastActivity,
      connectedAt: session.connectedAt
    };
  }

  /**
   * Find session by business ID (returns first active session for the business)
   */
  private findSessionByBusinessId(businessId: number): WhatsAppSession | undefined {
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      if (session.businessId === businessId && session.status === 'connected') {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): WhatsAppSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get QR code for a pending session
   */
  getQRCode(businessId: number, employeeId: number): string | null {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    const session = this.sessions.get(sessionKey);
    return session?.qrCode || null;
  }

  /**
   * Broadcast message to multiple recipients
   */
  async broadcastMessage(
    businessId: number,
    recipients: string[],
    message: string,
    delayMs: number = 1000
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const recipient of recipients) {
      try {
        await this.sendMessage(businessId, recipient, message);
        results.sent++;
        
        // Add delay to avoid rate limiting
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${recipient}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const whatsappManager = new WhatsAppManager();

// Legacy function for backward compatibility
export async function startWhatsApp(): Promise<void> {
  await whatsappManager.initialize();
}

// Legacy function for backward compatibility
export function linkPhoneToBusiness(phone: string, businessId: number): void {
  // This is now handled internally by the session
  console.log(`Phone ${phone} linked to business ${businessId}`);
}

// Default export
export default whatsappManager;
