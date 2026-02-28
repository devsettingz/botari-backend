"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.baileysManager = exports.BaileysManager = void 0;
const baileys_1 = __importStar(require("@adiwajshing/baileys"));
const QRCode = __importStar(require("qrcode"));
const agent_1 = require("../agent");
const sessionStore_1 = require("./sessionStore");
// ============================================================================
// BAILEYS MANAGER CLASS
// ============================================================================
class BaileysManager {
    constructor() {
        this.sessions = new Map();
        this.maxReconnectAttempts = 5;
        this.qrExpirationMs = 60000; // 60 seconds
    }
    /**
     * Generate unique session key
     */
    getSessionKey(businessId, employeeId) {
        return `${businessId}_${employeeId}`;
    }
    /**
     * Initialize manager and restore persisted sessions
     */
    async initialize() {
        console.log('[BaileysManager] Initializing...');
        const activeSessions = await (0, sessionStore_1.getAllActiveSessions)();
        for (const session of activeSessions) {
            console.log(`[BaileysManager] Restoring session for business ${session.business_id}, employee ${session.employee_id}`);
            try {
                await this.connect(session.business_id, session.employee_id);
            }
            catch (error) {
                console.error(`[BaileysManager] Failed to restore session for business ${session.business_id}:`, error);
            }
        }
        console.log('[BaileysManager] Initialization complete');
    }
    /**
     * Create new WhatsApp connection
     */
    async connect(businessId, employeeId) {
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
        const session = {
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
        await (0, sessionStore_1.updateEmployeeStatus)(businessId, employeeId, 'connecting');
        await (0, sessionStore_1.updateSessionStatus)(businessId, employeeId, 'connecting');
        return new Promise((resolve, reject) => {
            this.createBaileysConnection(session, resolve, reject);
        });
    }
    /**
     * Create the Baileys connection
     */
    async createBaileysConnection(session, resolve, reject) {
        try {
            // Get Baileys version
            const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
            console.log(`[BaileysManager] Using version ${version.join('.')}, isLatest: ${isLatest}`);
            // Initialize PostgreSQL auth state
            const { state, saveCreds } = await (0, sessionStore_1.usePostgreSQLAuthState)(session.businessId, session.employeeId);
            session.saveCreds = saveCreds;
            // Create socket
            const sock = (0, baileys_1.default)({
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
            sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(session, update, resolve, reject);
            });
            // Handle credential updates
            sock.ev.on('creds.update', async () => {
                await saveCreds();
            });
            // Handle incoming messages
            sock.ev.on('messages.upsert', async (m) => {
                await this.handleIncomingMessage(session, m);
            });
            // Handle message updates (delivered, read)
            sock.ev.on('messages.update', async (updates) => {
                for (const update of updates) {
                    console.log(`[BaileysManager] Message update for business ${session.businessId}:`, update.update);
                }
            });
        }
        catch (error) {
            console.error('[BaileysManager] Error creating connection:', error);
            session.status = 'disconnected';
            reject(error instanceof Error ? error : new Error('Failed to create connection'));
        }
    }
    /**
     * Handle connection state updates
     */
    async handleConnectionUpdate(session, update, resolve, reject) {
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
                await (0, sessionStore_1.updateEmployeeStatus)(session.businessId, session.employeeId, 'awaiting_qr');
                await (0, sessionStore_1.updateSessionStatus)(session.businessId, session.employeeId, 'awaiting_qr');
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
            }
            catch (error) {
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
                    await (0, sessionStore_1.updateEmployeeStatus)(session.businessId, session.employeeId, 'connected', session.phoneNumber || undefined);
                    await (0, sessionStore_1.updateSessionStatus)(session.businessId, session.employeeId, 'connected', session.phoneNumber || undefined);
                    break;
                case 'close':
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
                    const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                    console.log(`[BaileysManager] Disconnected for business ${session.businessId}. Reason: ${statusCode}, Error: ${errorMessage}`);
                    session.status = 'disconnected';
                    session.disconnectedAt = new Date();
                    session.socket = null;
                    await (0, sessionStore_1.updateEmployeeStatus)(session.businessId, session.employeeId, 'disconnected');
                    await (0, sessionStore_1.updateSessionStatus)(session.businessId, session.employeeId, 'disconnected');
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
    async handleIncomingMessage(session, m) {
        const msg = m.messages?.[0];
        if (!msg || !msg.message || msg.key.fromMe)
            return;
        // Only process user messages
        if (!(0, baileys_1.isJidUser)(msg.key.remoteJid))
            return;
        const sender = msg.key.remoteJid;
        const phoneNumber = sender.split('@')[0];
        // Extract text
        const text = this.extractMessageText(msg.message);
        if (!text.trim())
            return;
        session.lastActivity = new Date();
        console.log(`[BaileysManager] Message from ${phoneNumber} to business ${session.businessId}: ${text.substring(0, 50)}...`);
        // Save incoming message
        await (0, sessionStore_1.saveMessage)(session.businessId, phoneNumber, session.phoneNumber || 'bot', text, 'incoming', 'delivered');
        // Process through AI
        try {
            const reply = await (0, agent_1.routeMessage)(text, phoneNumber, 'whatsapp', session.businessId);
            // Send reply
            await this.sendMessage(session.businessId, sender, reply);
        }
        catch (error) {
            console.error('[BaileysManager] Error processing message:', error);
            await this.sendMessage(session.businessId, sender, "Sorry, I'm having technical difficulties. Please try again shortly.");
        }
    }
    /**
     * Extract text from message
     */
    extractMessageText(message) {
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
    async sendMessage(businessId, to, message) {
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
            const messageContent = { text: message };
            await session.socket.sendMessage(jid, messageContent);
            // Save outgoing message
            await (0, sessionStore_1.saveMessage)(businessId, session.phoneNumber || 'bot', to.replace('@s.whatsapp.net', ''), message, 'outgoing', 'sent');
            console.log(`[BaileysManager] Message sent to ${to} for business ${businessId}`);
        }
        catch (error) {
            console.error('[BaileysManager] Error sending message:', error);
            throw error;
        }
    }
    /**
     * Disconnect session
     */
    async disconnect(businessId, employeeId, logout = false) {
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
                    await (0, sessionStore_1.clearSessionFromDB)(businessId, employeeId);
                }
                else {
                    session.socket.end(undefined);
                }
            }
        }
        catch (error) {
            console.error('[BaileysManager] Error during disconnect:', error);
        }
        // Update database
        await (0, sessionStore_1.updateEmployeeStatus)(businessId, employeeId, 'disconnected');
        await (0, sessionStore_1.updateSessionStatus)(businessId, employeeId, 'disconnected');
        // Remove from memory
        this.sessions.delete(sessionKey);
        console.log(`[BaileysManager] Disconnected business ${businessId}`);
    }
    /**
     * Get connection status
     */
    getStatus(businessId, employeeId) {
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
    getQRCode(businessId, employeeId) {
        const sessionKey = this.getSessionKey(businessId, employeeId);
        const session = this.sessions.get(sessionKey);
        return session?.qrCode || null;
    }
    /**
     * Find session by business ID
     */
    findSessionByBusinessId(businessId) {
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
    getAllSessions() {
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
    async broadcastMessage(businessId, recipients, message, delayMs = 1000) {
        const results = { sent: 0, failed: 0, errors: [] };
        for (const recipient of recipients) {
            try {
                await this.sendMessage(businessId, recipient, message);
                results.sent++;
                if (delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            catch (error) {
                results.failed++;
                results.errors.push(`${recipient}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return results;
    }
}
exports.BaileysManager = BaileysManager;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
exports.baileysManager = new BaileysManager();
exports.default = exports.baileysManager;
//# sourceMappingURL=BaileysManager.js.map