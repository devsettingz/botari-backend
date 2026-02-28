/**
 * Call Manager
 * Botari AI - Voice Call Session Management
 *
 * Manages active call sessions, bridging AI agents into calls,
 * and handling call transfers.
 */
import { NCCOAction } from './VonageService';
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
/**
 * Create a new call session
 */
export declare function createCallSession(callId: number, callUuid: string, businessId: number, customerPhone: string, direction: 'inbound' | 'outbound', employeeId?: number): Promise<CallSession>;
/**
 * Get active call session by UUID
 */
export declare function getCallSession(callUuid: string): CallSession | undefined;
/**
 * Get active call session by database ID
 */
export declare function getCallSessionById(callId: number): CallSession | undefined;
/**
 * Update call session
 */
export declare function updateCallSession(callUuid: string, updates: Partial<CallSession>): CallSession | undefined;
/**
 * Add conversation entry to session
 */
export declare function addConversationEntry(callUuid: string, role: 'user' | 'assistant' | 'system', content: string): void;
/**
 * End call session
 */
export declare function endCallSession(callUuid: string): Promise<void>;
/**
 * Get all active call sessions
 */
export declare function getAllActiveSessions(): CallSession[];
/**
 * Get active calls count for a business
 */
export declare function getBusinessActiveCallCount(businessId: number): number;
/**
 * Bridge AI agent into call
 * This processes user input and generates AI response with NCCO
 */
export declare function bridgeAIAgent(callUuid: string, userInput: string, speechResult?: any): Promise<NCCOAction[]>;
/**
 * Handle call transfer
 */
export declare function transferCall(callUuid: string, targetNumber: string, options?: {
    whisperMessage?: string;
    timeout?: number;
}): Promise<NCCOAction[]>;
/**
 * Put call on hold
 */
export declare function putOnHold(callUuid: string): NCCOAction[];
/**
 * Resume call from hold
 */
export declare function resumeFromHold(callUuid: string, message?: string): Promise<NCCOAction[]>;
/**
 * Send call to voicemail
 */
export declare function sendToVoicemail(callUuid: string, reason?: string): NCCOAction[];
/**
 * Schedule a callback
 */
export declare function scheduleCallback(callUuid: string, customerPhone: string, preferredTime?: Date, notes?: string): Promise<boolean>;
/**
 * Handle no input from user (silence timeout)
 */
export declare function handleNoInput(callUuid: string, attempt?: number): Promise<NCCOAction[]>;
/**
 * Clean up stale sessions (calls that have been inactive for too long)
 */
export declare function cleanupStaleSessions(maxAgeMinutes?: number): Promise<number>;
/**
 * Get call analytics for a business
 */
export declare function getCallAnalytics(businessId: number, startDate: Date, endDate: Date): Promise<{
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    avgDuration: number;
    totalCost: number;
    recordingsCount: number;
}>;
declare const _default: {
    createCallSession: typeof createCallSession;
    getCallSession: typeof getCallSession;
    getCallSessionById: typeof getCallSessionById;
    updateCallSession: typeof updateCallSession;
    addConversationEntry: typeof addConversationEntry;
    endCallSession: typeof endCallSession;
    getAllActiveSessions: typeof getAllActiveSessions;
    getBusinessActiveCallCount: typeof getBusinessActiveCallCount;
    bridgeAIAgent: typeof bridgeAIAgent;
    transferCall: typeof transferCall;
    putOnHold: typeof putOnHold;
    resumeFromHold: typeof resumeFromHold;
    sendToVoicemail: typeof sendToVoicemail;
    scheduleCallback: typeof scheduleCallback;
    handleNoInput: typeof handleNoInput;
    cleanupStaleSessions: typeof cleanupStaleSessions;
    getCallAnalytics: typeof getCallAnalytics;
};
export default _default;
//# sourceMappingURL=CallManager.d.ts.map