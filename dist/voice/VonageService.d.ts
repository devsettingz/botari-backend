/**
 * Vonage Voice Service
 * Botari AI - Complete Voice Call Integration
 *
 * This service provides:
 * - Outbound call initiation
 * - Text-to-Speech (TTS) for AI responses
 * - Speech-to-Text (STT) for user input
 * - Call recording management
 * - Call status tracking
 */
import { Vonage } from '@vonage/server-sdk';
/**
 * Initialize Vonage client with credentials
 */
export declare function initializeVonage(): Vonage;
/**
 * Get Vonage client instance
 */
export declare function getVonageClient(): Vonage;
/**
 * Call record interface
 */
export interface CallRecord {
    id: number;
    business_id: number;
    employee_id?: number;
    customer_phone: string;
    direction: 'inbound' | 'outbound';
    status: 'ringing' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    started_at: Date;
    ended_at?: Date;
    duration_seconds?: number;
    recording_url?: string;
    transcript?: string;
    ai_summary?: string;
    cost?: number;
    metadata?: any;
    vonage_call_uuid?: string;
}
/**
 * Active call session
 */
export interface ActiveCall {
    callUuid: string;
    businessId: number;
    employeeId?: number;
    customerPhone: string;
    direction: 'inbound' | 'outbound';
    status: string;
    startedAt: Date;
    conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    recordingUrl?: string;
    metadata?: any;
}
/**
 * NCCO (Nexmo Call Control Object) actions
 */
export type NCCOAction = {
    action: 'talk';
    text: string;
    voiceName?: string;
    language?: string;
    style?: number;
    premium?: boolean;
} | {
    action: 'input';
    eventUrl: string[];
    speech?: {
        language: string;
        context?: string[];
        endOnSilence?: number;
        uuid?: string[];
    };
    dtmf?: {
        maxDigits?: number;
        submitOnHash?: boolean;
    };
    type?: string[];
} | {
    action: 'record';
    eventUrl: string[];
    beepStart?: boolean;
    endOnSilence?: number;
    endOnKey?: string;
    timeOut?: number;
    channels?: number;
    split?: string;
    format?: 'mp3' | 'wav' | 'ogg';
} | {
    action: 'stream';
    streamUrl: string[];
    level?: number;
    bargeIn?: boolean;
    loop?: number;
} | {
    action: 'connect';
    endpoint: Array<{
        type: 'phone';
        number: string;
        dtmfAnswer?: string;
    }>;
    from?: string;
    randomFromNumber?: boolean;
    eventUrl?: string[];
    eventType?: string;
    timeout?: number;
    limit?: number;
    machineDetection?: string;
} | {
    action: 'conversation';
    name: string;
    musicOnHoldUrl?: string[];
    startOnEnter?: boolean;
    endOnExit?: boolean;
    record?: boolean;
    eventUrl?: string[];
};
/**
 * Make an outbound call
 */
export declare function makeOutboundCall(to: string, businessId: number, employeeId: number, options?: {
    greetingText?: string;
    voiceName?: string;
    fromNumber?: string;
    metadata?: any;
}): Promise<{
    success: boolean;
    callUuid?: string;
    error?: string;
    dbId?: number;
}>;
/**
 * Handle inbound call - generates NCCO for answer_url webhook
 */
export declare function handleInboundCall(from: string, to: string, businessId: number): Promise<NCCOAction[]>;
/**
 * Process speech input and generate AI response
 */
export declare function processSpeechInput(callId: number, speechText: string, callUuid: string): Promise<NCCOAction[]>;
/**
 * Handle call status events
 */
export declare function handleCallStatus(callId: number, status: string, details: any): Promise<void>;
/**
 * Start call recording
 */
export declare function startRecording(callId: number, callUuid: string): Promise<boolean>;
/**
 * End an active call
 */
export declare function endCall(callId: number, callUuid?: string): Promise<boolean>;
/**
 * Handle recording completion
 */
export declare function handleRecording(callId: number, recordingUrl: string, duration: number): Promise<void>;
/**
 * Get call history for a business
 */
export declare function getCallHistory(businessId: number, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
}): Promise<{
    calls: CallRecord[];
    total: number;
}>;
/**
 * Get single call details
 */
export declare function getCallDetails(callId: number, businessId?: number): Promise<CallRecord | null>;
/**
 * Generate AI summary for a call
 */
export declare function generateCallSummary(callId: number): Promise<string | null>;
/**
 * Handle DTMF (keypad) input
 */
export declare function handleDTMF(callId: number, digits: string): Promise<NCCOAction[]>;
/**
 * Get active calls
 */
export declare function getActiveCalls(businessId?: number): Promise<CallRecord[]>;
/**
 * Check Vonage service health
 */
export declare function checkVonageHealth(): Promise<{
    healthy: boolean;
    message: string;
}>;
declare const _default: {
    initializeVonage: typeof initializeVonage;
    getVonageClient: typeof getVonageClient;
    makeOutboundCall: typeof makeOutboundCall;
    handleInboundCall: typeof handleInboundCall;
    processSpeechInput: typeof processSpeechInput;
    handleCallStatus: typeof handleCallStatus;
    startRecording: typeof startRecording;
    endCall: typeof endCall;
    handleRecording: typeof handleRecording;
    getCallHistory: typeof getCallHistory;
    getCallDetails: typeof getCallDetails;
    generateCallSummary: typeof generateCallSummary;
    handleDTMF: typeof handleDTMF;
    getActiveCalls: typeof getActiveCalls;
    checkVonageHealth: typeof checkVonageHealth;
};
export default _default;
//# sourceMappingURL=VonageService.d.ts.map