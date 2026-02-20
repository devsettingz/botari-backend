/**
 * Baileys Manager for Botari AI
 * 
 * Manages multiple WhatsApp sessions using @adiwajshing/baileys.
 * Features:
 * - Multi-business session management
 * - PostgreSQL-based session persistence
 * - QR code generation for connection
 * - Incoming message handling with AI routing
 * - Automatic reconnection
 */

import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
  AnyMessageContent,
  proto,
  BaileysEventMap,
  isJidUser,
  fetchLatestBaileysVersion,
  AuthenticationState
} from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { routeMessage } from '../agent';
import {
  usePostgreSQLAuthState,
  updateSessionStatus,
  updateEmployeeStatus,
  getAllActiveSessions,
  saveMessage,
  clearSessionFromDB
} from './sessionStore';

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
  phoneNumber: string | null;
  saveCreds?: () => Promise<void>;
}

export interface ConnectionQR {
  qrCode: string;
  sessionId: string;
  expiresAt: Date;
}

export interface SessionInfo {
  businessId: number;
  employeeId: number;
  status: ConnectionStatus;
  phoneNumber: string | null;
  connectedAt: Date | null;
  lastActivity: Date;
}

// ============================================================================
// BAILEYS MANAGER CLASS
// ============================================================================

export class BaileysManager {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private maxReconnectAttempts: number = 5;
  private qrExpirationMs: number = 60000; // 60 seconds

  /**
   * Generate unique session key
   */
  private getSessionKey(businessId: number, employeeId: number): string {
    return `${businessId}_${employeeId}`;
  }

  /**
   * Initialize manager and restore persisted sessions
   */
  async initialize(): Promise<void> {
    console.log('[BaileysManager] Initializing...');
    
    const activeSessions = await getAllActiveSessions();
    
    for (const session of activeSessions) {
      console.log(`[BaileysManager] Restoring session for business ${session.business_id}, employee ${session.employee_id}`);
      try {
        await this.connect(session.business_id, session.employee_id);
      } catch (error) {
        console.error(`[BaileysManager] Failed to restore session for business ${session.business_id}:`, error);
      }
    }
    
    console.log('[BaileysManager] Initialization complete');
  }

  /**
   * Create new WhatsApp connection
   */
  async connect(businessId: number, employeeId: number): Promise<ConnectionQR> {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    
    // Check if already connected
    const existingSession = this.sessions.get(sessionKey);
    if (existingSession?.status === 'connected') {
      throw new Error('WhatsApp is already connected for this business');
    }

    // Clean up existing session
    if (existingSession) {
      await this.disconnect(businessId, employeeId);
    }

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
      phoneNumber: null
    };

    this.sessions.set(sessionKey, session);

    // Update database status
    await updateEmployeeStatus(businessId, employeeId, 'connecting');
    await updateSessionStatus(businessId, employeeId, 'connecting');

    return new Promise((resolve, reject) => {
      this.createBaileysConnection(session, resolve, reject);
    });
  }

  /**
   * Create the Baileys connection
   */
  private async createBaileysConnection(
    session: WhatsAppSession,
    resolve: (qr: ConnectionQR) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    try {
      // Get Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`[BaileysManager] Using version ${version.join('.')}, isLatest: ${isLatest}`);

      // Initialize PostgreSQL auth state
      const { state, saveCreds } = await usePostgreSQLAuthState(
        session.businessId,
        session.employeeId
      );
      session.saveCreds = saveCreds;

      // Create socket
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
      sock.ev.on('creds.update', async () => {
        await saveCreds();
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (m: BaileysEventMap['messages.upsert']) => {
        await this.handleIncomingMessage(session, m);
      });

      // Handle message updates (delivered, read)
      sock.ev.on('messages.update', async (updates: BaileysEventMap['messages.update']) => {
        for (const update of updates) {
          console.log(`[BaileysManager] Message update for business ${session.businessId}:`, update.update);
        }
      });

    } catch (error) {
      console.error('[BaileysManager] Error creating connection:', error);
      session.status = 'disconnected';
      reject(error instanceof Error ? error : new Error('Failed to create connection'));
    }
  }

  /**
   * Handle connection state updates
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
      console.log(`[BaileysManager] QR generated for business ${session.businessId}`);
      
      try {
        const qrCodeUrl = await QRCode.toDataURL(qr, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });

        session.qrCode = qrCodeUrl;
        session.status = 'awaiting_qr';

        await updateEmployeeStatus(session.businessId, session.employeeId, 'awaiting_qr');
        await updateSessionStatus(session.businessId, session.employeeId, 'awaiting_qr');

        resolve({
          qrCode: qrCodeUrl,
          sessionId: sessionKey,
          expiresAt: new Date(Date.now() + this.qrExpirationMs)
        });

        // Auto-clear QR after expiration
        setTimeout(() => {
          if (session.status === 'awaiting_qr' && session.qrCode) {
            console.log(`[BaileysManager] QR expired for business ${session.businessId}`);
            session.qrCode = null;
          }
        }, this.qrExpirationMs);

      } catch (error) {
        reject?.(error instanceof Error ? error : new Error('Failed to generate QR'));
      }
    }

    // Handle connection state
    if (connection) {
      switch (connection) {
        case 'connecting':
          session.status = 'connecting';
          console.log(`[BaileysManager] Connecting for business ${session.businessId}...`);
          break;

        case 'open':
          session.status = 'connected';
          session.connectedAt = new Date();
          session.reconnectAttempts = 0;
          session.qrCode = null;

          // Get phone number
          const user = session.socket?.user;
          if (user?.id) {
            session.phoneNumber = user.id.split(':')[0];
          }

          console.log(`[BaileysManager] Connected for business ${session.businessId} (${session.phoneNumber})`);

          await updateEmployeeStatus(
            session.businessId,
            session.employeeId,
            'connected',
            session.phoneNumber || undefined
          );
          await updateSessionStatus(
            session.businessId,
            session.employeeId,
            'connected',
            session.phoneNumber || undefined
          );
          break;

        case 'close':
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          const errorMessage = (lastDisconnect?.error as Error)?.message || 'Unknown error';

          console.log(`[BaileysManager] Disconnected for business ${session.businessId}. Reason: ${statusCode}, Error: ${errorMessage}`);

          session.status = 'disconnected';
          session.disconnectedAt = new Date();
          session.socket = null;

          await updateEmployeeStatus(
            session.businessId,
            session.employeeId,
            'disconnected'
          );
          await updateSessionStatus(
            session.businessId,
            session.employeeId,
            'disconnected'
          );

          // Auto-reconnect if not logged out
          if (shouldReconnect && session.reconnectAttempts < this.maxReconnectAttempts) {
            session.reconnectAttempts++;
            session.status = 'reconnecting';
            console.log(`[BaileysManager] Auto-reconnecting attempt ${session.reconnectAttempts}...`);
            
            setTimeout(() => {
              this.connect(session.businessId, session.employeeId).catch(err => {
                console.error(`[BaileysManager] Reconnect failed:`, err);
              });
            }, 5000 * session.reconnectAttempts);
          }
          break;
      }
    }
  }

  /**
   * Handle incoming messages
   */
  private async handleIncomingMessage(
    session: WhatsAppSession,
    m: BaileysEventMap['messages.upsert']
  ): Promise<void> {
    const msg = m.messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    // Only process user messages
    if (!isJidUser(msg.key.remoteJid!)) return;

    const sender = msg.key.remoteJid!;
    const phoneNumber = sender.split('@')[0];
    
    // Extract text
    const text = this.extractMessageText(msg.message);
    if (!text.trim()) return;

    session.lastActivity = new Date();

    console.log(`[BaileysManager] Message from ${phoneNumber} to business ${session.businessId}: ${text.substring(0, 50)}...`);

    // Save incoming message
    await saveMessage(
      session.businessId,
      phoneNumber,
      session.phoneNumber || 'bot',
      text,
      'incoming',
      'delivered'
    );

    // Process through AI
    try {
      const reply = await routeMessage(
        text,
        phoneNumber,
        'whatsapp',
        session.businessId
      );

      // Send reply
      await this.sendMessage(session.businessId, sender, reply);

    } catch (error) {
      console.error('[BaileysManager] Error processing message:', error);
      
      await this.sendMessage(
        session.businessId,
        sender,
        "Sorry, I'm having technical difficulties. Please try again shortly."
      );
    }
  }

  /**
   * Extract text from message
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
      const lat = message.locationMessage.degreesLatitude;
      const long = message.locationMessage.degreesLongitude;
      return `[Location: ${lat}, ${long}]`;
    }
    return '';
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(
    businessId: number,
    to: string,
    message: string
  ): Promise<void> {
    // Find session
    const session = this.findSessionByBusinessId(businessId);
    
    if (!session) {
      throw new Error(`No WhatsApp session found for business ${businessId}`);
    }

    if (session.status !== 'connected' || !session.socket) {
      throw new Error('WhatsApp is not connected');
    }

    // Format JID
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    try {
      const messageContent: AnyMessageContent = { text: message };
      await session.socket.sendMessage(jid, messageContent);

      // Save outgoing message
      await saveMessage(
        businessId,
        session.phoneNumber || 'bot',
        to.replace('@s.whatsapp.net', ''),
        message,
        'outgoing',
        'sent'
      );

      console.log(`[BaileysManager] Message sent to ${to} for business ${businessId}`);

    } catch (error) {
      console.error('[BaileysManager] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Disconnect session
   */
  async disconnect(businessId: number, employeeId: number, logout: boolean = false): Promise<void> {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      console.log(`[BaileysManager] No active session for business ${businessId}`);
      return;
    }

    console.log(`[BaileysManager] Disconnecting business ${businessId}...`);

    try {
      if (session.socket) {
        if (logout) {
          await session.socket.logout();
          // Clear all session data on logout
          await clearSessionFromDB(businessId, employeeId);
        } else {
          session.socket.end(undefined);
        }
      }
    } catch (error) {
      console.error('[BaileysManager] Error during disconnect:', error);
    }

    // Update database
    await updateEmployeeStatus(businessId, employeeId, 'disconnected');
    await updateSessionStatus(businessId, employeeId, 'disconnected');

    // Remove from memory
    this.sessions.delete(sessionKey);

    console.log(`[BaileysManager] Disconnected business ${businessId}`);
  }

  /**
   * Get connection status
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
   * Get QR code
   */
  getQRCode(businessId: number, employeeId: number): string | null {
    const sessionKey = this.getSessionKey(businessId, employeeId);
    const session = this.sessions.get(sessionKey);
    return session?.qrCode || null;
  }

  /**
   * Find session by business ID
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
   * Get all sessions
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => ({
      businessId: s.businessId,
      employeeId: s.employeeId,
      status: s.status,
      phoneNumber: s.phoneNumber,
      connectedAt: s.connectedAt,
      lastActivity: s.lastActivity
    }));
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
// SINGLETON INSTANCE
// ============================================================================

export const baileysManager = new BaileysManager();

export default baileysManager;
