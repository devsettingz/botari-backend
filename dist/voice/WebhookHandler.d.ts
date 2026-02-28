/**
 * Vonage Webhook Handler
 * Botari AI - Voice Call Webhook Endpoints
 *
 * Handles all Vonage webhooks:
 * - answer_url: Initial call answering
 * - event_url: Call status updates
 * - input: Speech/DTMF input
 * - recording: Recording callbacks
 * - transfer: Call transfer events
 * - voicemail: Voicemail recordings
 */
import { Request, Response } from 'express';
import { NCCOAction } from './VonageService';
/**
 * Handle answer_url webhook - called when call is answered
 * Returns NCCO to control the call flow
 */
export declare function handleAnswerWebhook(req: Request, res: Response): Promise<void>;
/**
 * Handle event_url webhook - call status updates
 */
export declare function handleEventWebhook(req: Request, res: Response): Promise<void>;
/**
 * Handle input webhook - speech or DTMF input
 */
export declare function handleInputWebhook(req: Request, res: Response): Promise<void>;
/**
 * Handle recording webhook
 */
export declare function handleRecordingWebhook(req: Request, res: Response): Promise<void>;
/**
 * Handle voicemail webhook
 */
export declare function handleVoicemailWebhook(req: Request, res: Response): Promise<void>;
/**
 * Handle transfer webhook
 */
export declare function handleTransferWebhook(req: Request, res: Response): Promise<void>;
/**
 * Handle machine detection webhook
 */
export declare function handleMachineDetectionWebhook(req: Request, res: Response): Promise<void>;
/**
 * Generate NCCO for conference/bridge
 */
export declare function generateConferenceNCCO(conferenceName: string, options?: {
    musicOnHold?: boolean;
    record?: boolean;
    muted?: boolean;
}): NCCOAction[];
/**
 * Handle fallback webhook (when primary webhook fails)
 */
export declare function handleFallbackWebhook(req: Request, res: Response): void;
declare const _default: {
    handleAnswerWebhook: typeof handleAnswerWebhook;
    handleEventWebhook: typeof handleEventWebhook;
    handleInputWebhook: typeof handleInputWebhook;
    handleRecordingWebhook: typeof handleRecordingWebhook;
    handleVoicemailWebhook: typeof handleVoicemailWebhook;
    handleTransferWebhook: typeof handleTransferWebhook;
    handleMachineDetectionWebhook: typeof handleMachineDetectionWebhook;
    handleFallbackWebhook: typeof handleFallbackWebhook;
    generateConferenceNCCO: typeof generateConferenceNCCO;
};
export default _default;
//# sourceMappingURL=WebhookHandler.d.ts.map