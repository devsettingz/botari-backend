/**
 * Voice Module - Botari AI
 * Complete Voice Call Integration using Vonage
 *
 * This module provides voice calling capabilities including:
 * - Outbound call initiation
 * - Inbound call handling
 * - Text-to-Speech (TTS)
 * - Speech-to-Text (STT)
 * - Call recording
 * - AI agent integration
 */
export { initializeVonage, getVonageClient, makeOutboundCall, handleInboundCall, processSpeechInput, handleCallStatus, startRecording, endCall, handleRecording, getCallHistory, getCallDetails, generateCallSummary, handleDTMF, getActiveCalls, checkVonageHealth, CallRecord, ActiveCall, NCCOAction, } from './VonageService';
export { createCallSession, getCallSession, getCallSessionById, updateCallSession, addConversationEntry, endCallSession, getAllActiveSessions, getBusinessActiveCallCount, bridgeAIAgent, transferCall, putOnHold, resumeFromHold, sendToVoicemail, scheduleCallback, handleNoInput, cleanupStaleSessions, getCallAnalytics, CallSession, } from './CallManager';
export { handleAnswerWebhook, handleEventWebhook, handleInputWebhook, handleRecordingWebhook, handleVoicemailWebhook, handleTransferWebhook, handleMachineDetectionWebhook, handleFallbackWebhook, generateConferenceNCCO, } from './WebhookHandler';
//# sourceMappingURL=index.d.ts.map