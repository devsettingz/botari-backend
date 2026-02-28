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
import { WASocket } from '@adiwajshing/baileys';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'awaiting_qr' | 'connected' | 'reconnecting';
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
export declare class BaileysManager {
    private sessions;
    private maxReconnectAttempts;
    private qrExpirationMs;
    /**
     * Generate unique session key
     */
    private getSessionKey;
    /**
     * Initialize manager and restore persisted sessions
     */
    initialize(): Promise<void>;
    /**
     * Create new WhatsApp connection
     */
    connect(businessId: number, employeeId: number): Promise<ConnectionQR>;
    /**
     * Create the Baileys connection
     */
    private createBaileysConnection;
    /**
     * Handle connection state updates
     */
    private handleConnectionUpdate;
    /**
     * Handle incoming messages
     */
    private handleIncomingMessage;
    /**
     * Extract text from message
     */
    private extractMessageText;
    /**
     * Send WhatsApp message
     */
    sendMessage(businessId: number, to: string, message: string): Promise<void>;
    /**
     * Disconnect session
     */
    disconnect(businessId: number, employeeId: number, logout?: boolean): Promise<void>;
    /**
     * Get connection status
     */
    getStatus(businessId: number, employeeId: number): {
        status: ConnectionStatus;
        connected: boolean;
        phoneNumber: string | null;
        lastActivity: Date | null;
        connectedAt: Date | null;
    };
    /**
     * Get QR code
     */
    getQRCode(businessId: number, employeeId: number): string | null;
    /**
     * Find session by business ID
     */
    private findSessionByBusinessId;
    /**
     * Get all sessions
     */
    getAllSessions(): SessionInfo[];
    /**
     * Broadcast message to multiple recipients
     */
    broadcastMessage(businessId: number, recipients: string[], message: string, delayMs?: number): Promise<{
        sent: number;
        failed: number;
        errors: string[];
    }>;
}
export declare const baileysManager: BaileysManager;
export default baileysManager;
//# sourceMappingURL=BaileysManager.d.ts.map