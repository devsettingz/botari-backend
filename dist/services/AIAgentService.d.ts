/**
 * AI Agent Service
 * Botari AI - Comprehensive AI Employee Service
 *
 * This service integrates with OpenAI to power all AI employees with:
 * - System prompts for each employee persona
 * - Context-aware conversation handling
 * - Function calling for business actions
 * - Multi-channel support (WhatsApp, Email, Voice)
 */
import { PersonaDefinition } from '../agent/personas';
import { BusinessContext, AgentResponse, ActionResult } from '../agent/types';
export type EmployeeType = 'amina' | 'eva' | 'stan' | 'rachel' | 'sonny' | 'penny' | 'linda' | 'zara' | 'omar' | 'kofi';
export declare class AIAgentService {
    private openai;
    private model;
    constructor(model?: string);
    /**
     * Process an incoming message and generate a response
     * Main entry point for all AI employee interactions
     */
    processMessage(employeeId: EmployeeType | string, message: string, context: Partial<BusinessContext> & {
        conversationHistory?: Array<{
            role: 'user' | 'assistant';
            content: string;
        }>;
        channel?: string;
        customerName?: string;
    }): Promise<AgentResponse>;
    /**
     * Generate a response based on conversation history
     * Used for continuing conversations
     */
    generateResponse(employeeId: EmployeeType | string, conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>, context?: Partial<BusinessContext>): Promise<string>;
    /**
     * Handle WhatsApp messages specifically
     * Optimized for WhatsApp's format and constraints
     */
    handleWhatsAppMessage(businessId: number, employeeId: EmployeeType | string | number, customerPhone: string, message: string, options?: {
        customerName?: string;
        mediaUrl?: string;
        replyToMessageId?: string;
    }): Promise<AgentResponse>;
    /**
     * Handle email messages
     * Optimized for email format and professionalism
     */
    handleEmail(businessId: number, employeeId: EmployeeType | string | number, emailContent: {
        from: string;
        subject: string;
        body: string;
        to?: string;
        cc?: string[];
        threadId?: string;
    }, options?: {
        conversationHistory?: Array<{
            role: 'user' | 'assistant';
            content: string;
        }>;
    }): Promise<AgentResponse>;
    /**
     * Handle voice calls
     * Optimized for voice interactions with shorter responses
     */
    handleVoiceCall(businessId: number, employeeId: EmployeeType | string | number, customerPhone: string, transcript: string, options?: {
        isIncoming?: boolean;
        callUuid?: string;
        conversationHistory?: Array<{
            role: 'user' | 'assistant';
            content: string;
        }>;
    }): Promise<AgentResponse>;
    /**
     * Execute a specific action directly
     */
    executeAction(actionName: string, params: any, context: BusinessContext): Promise<ActionResult>;
    /**
     * Get available actions for an employee type
     */
    getEmployeeActions(employeeType: EmployeeType | string): string[];
    /**
     * Get employee persona details
     */
    getEmployeePersona(employeeType: EmployeeType | string): PersonaDefinition | undefined;
    /**
     * Normalize employee type string
     */
    private normalizeEmployeeType;
    /**
     * Build system prompt with context
     */
    private buildSystemPrompt;
    /**
     * Get or create conversation record
     */
    private getOrCreateConversation;
    /**
     * Save messages to database
     */
    private saveMessages;
    /**
     * Get business context from database
     */
    private getBusinessContext;
    /**
     * Resolve employee type from ID or name
     */
    private resolveEmployeeType;
    /**
     * Get conversation history for context
     */
    private getConversationHistory;
    /**
     * Find a voice agent for the business
     */
    private findVoiceAgent;
    /**
     * Optimize response for voice (shorter, clearer)
     */
    private optimizeForVoice;
    /**
     * Log interaction for analytics
     */
    private logInteraction;
}
export declare const aiAgentService: AIAgentService;
export declare function processMessage(employeeId: EmployeeType | string, message: string, context: Parameters<AIAgentService['processMessage']>[2]): Promise<AgentResponse>;
export declare function handleWhatsAppMessage(businessId: number, employeeId: EmployeeType | string | number, customerPhone: string, message: string, options?: Parameters<AIAgentService['handleWhatsAppMessage']>[4]): Promise<AgentResponse>;
export declare function handleEmail(businessId: number, employeeId: EmployeeType | string | number, emailContent: Parameters<AIAgentService['handleEmail']>[2], options?: Parameters<AIAgentService['handleEmail']>[3]): Promise<AgentResponse>;
export declare function generateResponse(employeeId: EmployeeType | string, conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
}>, context?: Partial<BusinessContext>): Promise<string>;
export declare function executeAction(actionName: string, params: any, context: BusinessContext): Promise<ActionResult>;
declare const _default: {
    aiAgentService: AIAgentService;
    processMessage: typeof processMessage;
    handleWhatsAppMessage: typeof handleWhatsAppMessage;
    handleEmail: typeof handleEmail;
    generateResponse: typeof generateResponse;
    executeAction: typeof executeAction;
    AIAgentService: typeof AIAgentService;
};
export default _default;
//# sourceMappingURL=AIAgentService.d.ts.map