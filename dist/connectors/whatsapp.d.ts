/**
 * WhatsApp Baileys Connector for Botari AI
 *
 * This module provides a complete WhatsApp Web integration using @adiwajshing/baileys.
 * It supports multi-business sessions, auto-reconnection, message persistence,
 * and AI agent integration.
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
export declare class WhatsAppManager {
    private sessions;
    private readonly baseSessionPath;
    private maxReconnectAttempts;
    constructor();
    private ensureSessionDirectory;
    private getSessionKey;
    private getSessionPath;
    /**
     * Initialize the manager and restore any persisted sessions
     */
    initialize(): Promise<void>;
    /**
     * Create a new WhatsApp connection and return QR code
     */
    connect(businessId: number, employeeId: number): Promise<ConnectionQR>;
    /**
     * Create the actual Baileys connection
     */
    private createBaileysConnection;
    /**
     * Handle connection state updates from Baileys
     */
    private handleConnectionUpdate;
    /**
     * Handle incoming messages from WhatsApp
     */
    private handleIncomingMessage;
    /**
     * Extract text from various message types
     */
    private extractMessageText;
    /**
     * Send a message via WhatsApp
     */
    sendMessage(businessId: number, to: string, message: string, options?: {
        media?: any;
    }): Promise<void>;
    /**
     * Disconnect a WhatsApp session
     */
    disconnect(businessId: number, employeeId: number, logout?: boolean): Promise<void>;
    /**
     * Get connection status for a business
     */
    getStatus(businessId: number, employeeId: number): {
        status: ConnectionStatus;
        connected: boolean;
        phoneNumber: string | null;
        lastActivity: Date | null;
        connectedAt: Date | null;
    };
    /**
     * Find session by business ID (returns first active session for the business)
     */
    private findSessionByBusinessId;
    /**
     * Get all active sessions
     */
    getAllSessions(): WhatsAppSession[];
    /**
     * Get QR code for a pending session
     */
    getQRCode(businessId: number, employeeId: number): string | null;
    /**
     * Broadcast message to multiple recipients
     */
    broadcastMessage(businessId: number, recipients: string[], message: string, delayMs?: number): Promise<{
        sent: number;
        failed: number;
        errors: string[];
    }>;
}
export declare const whatsappManager: WhatsAppManager;
export declare function startWhatsApp(): Promise<void>;
export declare function linkPhoneToBusiness(phone: string, businessId: number): void;
export default whatsappManager;
//# sourceMappingURL=whatsapp.d.ts.map