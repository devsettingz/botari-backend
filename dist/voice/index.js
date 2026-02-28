"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateConferenceNCCO = exports.handleFallbackWebhook = exports.handleMachineDetectionWebhook = exports.handleTransferWebhook = exports.handleVoicemailWebhook = exports.handleRecordingWebhook = exports.handleInputWebhook = exports.handleEventWebhook = exports.handleAnswerWebhook = exports.getCallAnalytics = exports.cleanupStaleSessions = exports.handleNoInput = exports.scheduleCallback = exports.sendToVoicemail = exports.resumeFromHold = exports.putOnHold = exports.transferCall = exports.bridgeAIAgent = exports.getBusinessActiveCallCount = exports.getAllActiveSessions = exports.endCallSession = exports.addConversationEntry = exports.updateCallSession = exports.getCallSessionById = exports.getCallSession = exports.createCallSession = exports.checkVonageHealth = exports.getActiveCalls = exports.handleDTMF = exports.generateCallSummary = exports.getCallDetails = exports.getCallHistory = exports.handleRecording = exports.endCall = exports.startRecording = exports.handleCallStatus = exports.processSpeechInput = exports.handleInboundCall = exports.makeOutboundCall = exports.getVonageClient = exports.initializeVonage = void 0;
// Vonage Service
var VonageService_1 = require("./VonageService");
Object.defineProperty(exports, "initializeVonage", { enumerable: true, get: function () { return VonageService_1.initializeVonage; } });
Object.defineProperty(exports, "getVonageClient", { enumerable: true, get: function () { return VonageService_1.getVonageClient; } });
Object.defineProperty(exports, "makeOutboundCall", { enumerable: true, get: function () { return VonageService_1.makeOutboundCall; } });
Object.defineProperty(exports, "handleInboundCall", { enumerable: true, get: function () { return VonageService_1.handleInboundCall; } });
Object.defineProperty(exports, "processSpeechInput", { enumerable: true, get: function () { return VonageService_1.processSpeechInput; } });
Object.defineProperty(exports, "handleCallStatus", { enumerable: true, get: function () { return VonageService_1.handleCallStatus; } });
Object.defineProperty(exports, "startRecording", { enumerable: true, get: function () { return VonageService_1.startRecording; } });
Object.defineProperty(exports, "endCall", { enumerable: true, get: function () { return VonageService_1.endCall; } });
Object.defineProperty(exports, "handleRecording", { enumerable: true, get: function () { return VonageService_1.handleRecording; } });
Object.defineProperty(exports, "getCallHistory", { enumerable: true, get: function () { return VonageService_1.getCallHistory; } });
Object.defineProperty(exports, "getCallDetails", { enumerable: true, get: function () { return VonageService_1.getCallDetails; } });
Object.defineProperty(exports, "generateCallSummary", { enumerable: true, get: function () { return VonageService_1.generateCallSummary; } });
Object.defineProperty(exports, "handleDTMF", { enumerable: true, get: function () { return VonageService_1.handleDTMF; } });
Object.defineProperty(exports, "getActiveCalls", { enumerable: true, get: function () { return VonageService_1.getActiveCalls; } });
Object.defineProperty(exports, "checkVonageHealth", { enumerable: true, get: function () { return VonageService_1.checkVonageHealth; } });
// Call Manager
var CallManager_1 = require("./CallManager");
Object.defineProperty(exports, "createCallSession", { enumerable: true, get: function () { return CallManager_1.createCallSession; } });
Object.defineProperty(exports, "getCallSession", { enumerable: true, get: function () { return CallManager_1.getCallSession; } });
Object.defineProperty(exports, "getCallSessionById", { enumerable: true, get: function () { return CallManager_1.getCallSessionById; } });
Object.defineProperty(exports, "updateCallSession", { enumerable: true, get: function () { return CallManager_1.updateCallSession; } });
Object.defineProperty(exports, "addConversationEntry", { enumerable: true, get: function () { return CallManager_1.addConversationEntry; } });
Object.defineProperty(exports, "endCallSession", { enumerable: true, get: function () { return CallManager_1.endCallSession; } });
Object.defineProperty(exports, "getAllActiveSessions", { enumerable: true, get: function () { return CallManager_1.getAllActiveSessions; } });
Object.defineProperty(exports, "getBusinessActiveCallCount", { enumerable: true, get: function () { return CallManager_1.getBusinessActiveCallCount; } });
Object.defineProperty(exports, "bridgeAIAgent", { enumerable: true, get: function () { return CallManager_1.bridgeAIAgent; } });
Object.defineProperty(exports, "transferCall", { enumerable: true, get: function () { return CallManager_1.transferCall; } });
Object.defineProperty(exports, "putOnHold", { enumerable: true, get: function () { return CallManager_1.putOnHold; } });
Object.defineProperty(exports, "resumeFromHold", { enumerable: true, get: function () { return CallManager_1.resumeFromHold; } });
Object.defineProperty(exports, "sendToVoicemail", { enumerable: true, get: function () { return CallManager_1.sendToVoicemail; } });
Object.defineProperty(exports, "scheduleCallback", { enumerable: true, get: function () { return CallManager_1.scheduleCallback; } });
Object.defineProperty(exports, "handleNoInput", { enumerable: true, get: function () { return CallManager_1.handleNoInput; } });
Object.defineProperty(exports, "cleanupStaleSessions", { enumerable: true, get: function () { return CallManager_1.cleanupStaleSessions; } });
Object.defineProperty(exports, "getCallAnalytics", { enumerable: true, get: function () { return CallManager_1.getCallAnalytics; } });
// Webhook Handler
var WebhookHandler_1 = require("./WebhookHandler");
Object.defineProperty(exports, "handleAnswerWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleAnswerWebhook; } });
Object.defineProperty(exports, "handleEventWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleEventWebhook; } });
Object.defineProperty(exports, "handleInputWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleInputWebhook; } });
Object.defineProperty(exports, "handleRecordingWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleRecordingWebhook; } });
Object.defineProperty(exports, "handleVoicemailWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleVoicemailWebhook; } });
Object.defineProperty(exports, "handleTransferWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleTransferWebhook; } });
Object.defineProperty(exports, "handleMachineDetectionWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleMachineDetectionWebhook; } });
Object.defineProperty(exports, "handleFallbackWebhook", { enumerable: true, get: function () { return WebhookHandler_1.handleFallbackWebhook; } });
Object.defineProperty(exports, "generateConferenceNCCO", { enumerable: true, get: function () { return WebhookHandler_1.generateConferenceNCCO; } });
//# sourceMappingURL=index.js.map