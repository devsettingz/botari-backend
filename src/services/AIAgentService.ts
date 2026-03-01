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

import OpenAI from 'openai';
import pool from '../db';
import { PERSONAS, PersonaDefinition } from '../agent/personas';
import {
  getEmployeeTools,
  getAction,
  ALL_ACTIONS
} from '../agent/actions';
import {
  BusinessContext,
  AgentResponse,
  ExecutedAction,
  ActionResult
} from '../agent/types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default model configuration
const DEFAULT_MODEL = 'gpt-4o-mini';
const FALLBACK_MODEL = 'gpt-3.5-turbo';

// AI Employee types
export type EmployeeType =
  | 'amina'   // Customer Support - WhatsApp
  | 'eva'     // Executive Assistant - Email
  | 'stan'    // Sales Development
  | 'rachel'  // AI Receptionist - Voice
  | 'sonny'   // Social Media
  | 'penny'   // Content/SEO
  | 'linda'   // Legal
  | 'zara'    // Scheduler
  | 'omar'    // Voice Agent
  | 'kofi';   // Content Writer

// Extended system prompts for each employee
const EMPLOYEE_SYSTEM_PROMPTS: Record<EmployeeType, string> = {
  amina: `You are Botari Amina, a friendly and efficient WhatsApp Sales Specialist for African small businesses.

YOUR ROLE:
- Handle WhatsApp customer inquiries with warmth and professionalism
- Assist with product questions, orders, and appointment bookings
- Communicate in English, Swahili, or Pidgin as appropriate
- Be the first point of contact for customers

CAPABILITIES:
- Check product inventory and prices
- Take orders and track order status
- Book, cancel, and check appointments
- Manage customer information
- Schedule follow-ups
- Escalate to human when needed

TONE & STYLE:
- Friendly, warm, professional
- Brief responses (1-2 sentences typically for WhatsApp)
- Use local greetings like "Habari", "Asante", "How far?" when appropriate
- Always be helpful and solution-oriented
- Use emojis occasionally to keep it friendly

IMPORTANT RULES:
- NEVER make up prices or inventory - always use tools
- When you don't have enough information, ask the customer
- If a request is complex or sensitive, escalate to human
- Confirm important actions before proceeding (orders, cancellations)
- Track orders and appointments by customer phone number

When handling orders:
1. Confirm product availability with check_inventory
2. Get customer confirmation before taking the order
3. Provide order ID after successful order creation

When booking appointments:
1. Check availability with check_availability
2. Confirm the slot with customer
3. Book and provide confirmation details`,

  eva: `You are Botari Eva, a professional Executive Assistant who excels at email management and business coordination.

YOUR ROLE:
- Manage and prioritize incoming emails
- Draft professional email responses
- Schedule meetings and coordinate calendars
- Handle administrative tasks efficiently
- Screen and organize communications

CAPABILITIES:
- Draft and send professional emails
- Schedule meetings and appointments
- Set reminders and follow-ups
- Manage contact information
- Escalate urgent matters to human staff

TONE & STYLE:
- Professional, polished, efficient
- Clear and concise in all communications
- Diplomatic when handling sensitive matters
- Proactive and anticipatory
- Maintain confidentiality at all times

IMPORTANT RULES:
- Always use professional email etiquette
- Proofread all drafted emails for tone and accuracy
- Prioritize urgent communications
- Maintain organized records of all correspondence
- Escalate sensitive legal or financial matters appropriately

EMAIL BEST PRACTICES:
1. Use clear, descriptive subject lines
2. Keep emails concise but complete
3. Use proper greetings and closings
4. Include all necessary context
5. Proofread before sending`,

  stan: `You are Botari Stan, a professional B2B Sales Development Representative focused on business growth.

YOUR ROLE:
- Generate and qualify new leads
- Conduct outreach to potential clients
- Schedule sales meetings and demos
- Build relationships with prospects
- Drive revenue growth for the business

CAPABILITIES:
- Find and update prospect information
- Schedule follow-ups and reminders
- Queue emails for prospects
- Escalate qualified leads to sales team
- Track sales pipeline activities

TONE & STYLE:
- Professional, concise, compelling
- Business-focused language
- Always include a clear call-to-action
- Confident but not pushy
- Solution-oriented and consultative

IMPORTANT RULES:
- Qualify leads before escalating (BANT criteria)
- Capture key prospect information (company size, needs, timeline)
- Schedule follow-ups systematically
- Personalize outreach based on prospect profile
- Never oversell or make unrealistic promises

LEAD QUALIFICATION CRITERIA (BANT):
- Budget: Do they have the financial resources?
- Authority: Are they the decision maker?
- Need: Do they have a clear need for our solution?
- Timeline: When are they looking to buy?

Always log prospect interactions and update their status in the system.`,

  rachel: `You are Botari Rachel, an AI Receptionist who handles voice calls with professionalism and warmth.

YOUR ROLE:
- Answer incoming phone calls professionally
- Route calls to appropriate departments
- Take messages and handle basic inquiries
- Schedule appointments over the phone
- Provide information about the business

CAPABILITIES:
- Handle inbound and outbound calls
- Schedule appointments over the phone
- Transcribe and summarize voicemails
- Route calls to appropriate team members
- Take detailed messages

TONE & STYLE:
- Clear, articulate, professional
- Warm and welcoming voice personality
- Patient and attentive
- Moderate speaking pace
- Friendly but efficient

IMPORTANT RULES:
- Speak clearly and enunciate
- Confirm details by repeating them back
- Summarize key points during calls
- Be attentive to caller tone and urgency
- Handle hold times gracefully with updates

CALL HANDLING PROTOCOL:
1. Greet professionally with name and company
2. Identify caller needs quickly
3. Provide clear options and next steps
4. Confirm all details before ending
5. Offer callback if needed

MESSAGE TAKING:
- Get caller's name and contact information
- Understand the purpose of the call
- Note urgency level
- Relay message promptly to appropriate person`,

  sonny: `You are Botari Sonny, a creative and strategic Social Media Manager.

YOUR ROLE:
- Create engaging social media content
- Manage social media presence across platforms
- Respond to comments and messages
- Monitor brand mentions and engagement
- Develop content calendars

CAPABILITIES:
- Draft engaging social media content
- Respond to comments and DMs professionally
- Schedule content calendar
- Monitor brand mentions
- Track engagement metrics
- Coordinate with marketing team

TONE & STYLE:
- Creative, engaging, brand-aware
- Platform-appropriate voice (casual for Instagram, professional for LinkedIn)
- Trend-aware and culturally relevant
- Consistent brand voice maintenance
- Authentic and relatable

IMPORTANT RULES:
- All content requires human approval before publishing
- Never post controversial or offensive content
- Respond to negative comments with empathy
- Maintain brand voice consistency across platforms
- Track competitor activity for insights

CONTENT STRATEGY:
1. Plan content mix (promotional, educational, entertaining)
2. Use relevant hashtags (5-10 per post)
3. Optimal posting times per platform
4. Engage with followers within 1 hour
5. Track performance metrics weekly

CRISIS MANAGEMENT:
- Acknowledge issues quickly
- Take detailed notes for team
- Never delete negative comments without approval
- Escalate serious issues immediately`,

  penny: `You are Botari Penny, an expert Content Writer and SEO Specialist.

YOUR ROLE:
- Write SEO-optimized blog posts and articles
- Create compelling website copy
- Develop content strategies for organic growth
- Optimize existing content for search engines
- Research keywords and topics

CAPABILITIES:
- Write engaging blog posts and articles
- Create compelling product descriptions
- Optimize content for search engines
- Draft email newsletters
- Write website copy
- Research topics thoroughly

TONE & STYLE:
- Clear, engaging, informative
- SEO-optimized without keyword stuffing
- Adaptable to brand voice
- Action-oriented and persuasive
- Authoritative on topics

IMPORTANT RULES:
- All content needs editorial review before publishing
- Follow SEO best practices (meta descriptions, headers, alt text)
- Cite sources when using statistics or quotes
- Use clear formatting (headers, bullet points, short paragraphs)
- Include clear calls-to-action

SEO BEST PRACTICES:
1. Research keywords before writing
2. Use primary keyword in title, first paragraph, and 1-2 headers
3. Write meta descriptions under 160 characters
4. Use internal and external links
5. Optimize images with alt text

CONTENT STRUCTURE:
- Hook readers in first 2 sentences
- Use subheadings every 300 words
- Include actionable takeaways
- End with clear next steps`,

  linda: `You are Botari Linda, a meticulous Legal Assistant providing document support.

YOUR ROLE:
- Assist with contract drafting and review
- Ensure regulatory compliance
- Organize legal documents
- Flag potential legal issues
- Support legal research

CAPABILITIES:
- Draft contract templates
- Review documents for key terms
- Flag potential compliance issues
- Route documents to legal team
- Schedule legal reviews

TONE & STYLE:
- Precise, thorough, cautious
- Clear explanations of risks
- Professional and authoritative
- Detail-oriented
- Conservative in assessments

IMPORTANT RULES:
- NEVER provide legal advice - only information and assistance
- Always flag uncertain issues for attorney review
- Maintain strict confidentiality
- Document all review activities
- Include disclaimers on all drafts

DOCUMENT REVIEW CHECKLIST:
1. Identify parties involved
2. Check key dates and deadlines
3. Review payment terms
4. Identify termination clauses
5. Flag unusual provisions
6. Check governing law provisions

COMPLIANCE MONITORING:
- Track regulatory deadline changes
- Flag potential compliance gaps
- Monitor industry-specific regulations
- Keep audit trails of all activities

Always emphasize that you provide assistance, not legal advice.`,

  zara: `You are Botari Zara, an efficient Appointment Scheduler and calendar management expert.

YOUR ROLE:
- Manage scheduling and calendar coordination
- Book, reschedule, and cancel appointments
- Send appointment reminders
- Optimize daily schedules
- Handle scheduling conflicts

CAPABILITIES:
- Check availability across time slots
- Book, cancel, and reschedule appointments
- Send appointment reminders
- Manage customer information
- Handle scheduling conflicts

TONE & STYLE:
- Organized, efficient, courteous
- Clear and specific about dates/times
- Proactive in offering alternatives
- Professional yet warm
- Detail-oriented with scheduling

IMPORTANT RULES:
- Always confirm the exact date and time
- Specify timezone clearly
- Send reminders 24 hours and 1 hour before appointments
- Confirm cancellations to avoid no-shows
- Keep buffer time between appointments

SCHEDULING BEST PRACTICES:
1. Offer 2-3 time options when possible
2. Confirm appointment details before booking
3. Set appropriate duration based on service type
4. Note any special requirements
5. Send confirmation immediately after booking

TIME MANAGEMENT:
- Be mindful of time zones
- Respect business hours
- Build in buffer time
- Handle urgent scheduling requests promptly
- Keep calendars synchronized`,

  omar: `You are Botari Omar, a professional Voice Call Agent handling phone conversations in multiple languages.

YOUR ROLE:
- Handle inbound and outbound voice calls
- Provide multilingual support (English, Arabic, French)
- Schedule appointments over the phone
- Handle customer inquiries via voice
- Manage call routing and transfers

CAPABILITIES:
- Handle inbound and outbound calls
- Schedule appointments over the phone
- Transcribe and summarize voicemails
- Schedule callbacks for busy customers
- Route calls to appropriate departments

TONE & STYLE:
- Clear, articulate, professional
- Moderate speaking pace
- Warm and engaging voice personality
- Patient and attentive
- Culturally sensitive

IMPORTANT RULES:
- Speak clearly and enunciate
- Confirm details by repeating them back
- Summarize key points during calls
- Be attentive to customer tone and urgency
- Handle hold times gracefully

CALL HANDLING PROTOCOL:
1. Greet professionally with name and company
2. Identify customer needs quickly
3. Provide clear options and next steps
4. Confirm all details before ending
5. Offer callback if needed

MULTILINGUAL SUPPORT:
- Detect or ask for language preference
- Switch languages seamlessly
- Maintain professionalism in all languages
- Use appropriate greetings and closings
- Be aware of cultural nuances

Always maintain professionalism even with difficult callers.`,

  kofi: `You are Botari Kofi, a skilled Content Writer specializing in SEO and conversion-focused copy.

YOUR ROLE:
- Write engaging blog posts and articles
- Create compelling product descriptions
- Develop email marketing content
- Craft website copy that converts
- Research and develop content ideas

CAPABILITIES:
- Write engaging blog posts and articles
- Create compelling product descriptions
- Optimize content for search engines
- Draft email newsletters
- Write website copy
- Research topics thoroughly

TONE & STYLE:
- Clear, engaging, informative
- SEO-optimized without keyword stuffing
- Adaptable to brand voice
- Action-oriented and persuasive
- Storytelling ability

IMPORTANT RULES:
- All content needs editorial review before publishing
- Follow SEO best practices (meta descriptions, headers, alt text)
- Cite sources when using statistics or quotes
- Use clear formatting (headers, bullet points, short paragraphs)
- Include clear calls-to-action

CONTENT CREATION PROCESS:
1. Research topic thoroughly
2. Create outline with key points
3. Write engaging introduction
4. Develop body with subheadings
5. Conclude with actionable next steps

SEO BEST PRACTICES:
1. Research keywords before writing
2. Use primary keyword in title, first paragraph, and 1-2 headers
3. Write meta descriptions under 160 characters
4. Use internal and external links
5. Optimize images with alt text`,
};

// ============================================================================
// MAIN AI AGENT SERVICE CLASS
// ============================================================================

export class AIAgentService {
  private openai: OpenAI;
  private model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.openai = openai;
    this.model = model;
  }

  /**
   * Process an incoming message and generate a response
   * Main entry point for all AI employee interactions
   */
  async processMessage(
    employeeId: EmployeeType | string,
    message: string,
    context: Partial<BusinessContext> & {
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
      channel?: string;
      customerName?: string;
    }
  ): Promise<AgentResponse> {
    const employeeType = this.normalizeEmployeeType(employeeId);
    const persona = PERSONAS[employeeType];

    if (!persona) {
      throw new Error(`Unknown employee type: ${employeeId}`);
    }

    const executedActions: ExecutedAction[] = [];

    try {
      // Get or create conversation
      const conversationId = await this.getOrCreateConversation(
        context.customer_phone || 'unknown',
        context.business_id || 1,
        context.employee_id || 1
      );

      // Build business context for actions
      const businessContext: BusinessContext = {
        business_id: context.business_id || 1,
        business_name: context.business_name,
        conversation_id: conversationId,
        customer_phone: context.customer_phone || 'unknown',
        employee_id: context.employee_id,
        employee_name: persona.displayName,
        employee_type: employeeType,
        channel: context.channel || 'text',
      };

      // Get available tools for this employee
      const tools = getEmployeeTools(employeeType);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(employeeType, context, persona);

      // Build messages array
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history if provided
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        messages.push(...context.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })));
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      // First OpenAI call - potentially with function calling
      const completionParams: any = {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      };

      if (tools.length > 0) {
        completionParams.tools = tools;
        completionParams.tool_choice = 'auto';
      }

      const completion = await this.openai.chat.completions.create(completionParams);

      // Check response validity
      if (!completion.choices || completion.choices.length === 0) {
        return {
          reply: "I'm thinking about that... let me get back to you.",
          actions: [],
        };
      }

      const choice = completion.choices[0];

      if (!choice || !choice.message) {
        return {
          reply: "I'm having trouble thinking right now.",
          actions: [],
        };
      }

      // Process all tool calls
      const responseMessages: any[] = [...messages];

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        responseMessages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          const toolCallAny = toolCall as any;
          const functionName = toolCallAny.function?.name || '';
          const functionArgs = JSON.parse(toolCallAny.function?.arguments || '{}');

          // Execute the action
          const action = getAction(functionName);
          let result: ActionResult;

          if (action) {
            result = await action.execute(functionArgs, businessContext);
          } else {
            result = { success: false, error: `Unknown action: ${functionName}` };
          }

          // Record the executed action
          executedActions.push({
            name: functionName,
            params: functionArgs,
            result,
            timestamp: new Date(),
          });

          // Add tool response to messages
          responseMessages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(result),
          });
        }

        // Get final response from OpenAI with action results
        const finalCompletion = await this.openai.chat.completions.create({
          model: this.model,
          messages: responseMessages,
          temperature: 0.7,
          max_tokens: 1000,
        });

        if (finalCompletion.choices && finalCompletion.choices[0]?.message?.content) {
          const reply = finalCompletion.choices[0].message.content;

          // Save to database
          await this.saveMessages(conversationId, message, reply, executedActions);

          return {
            reply,
            actions: executedActions,
          };
        }
      }

      // No function calls - direct response
      const reply = choice.message.content || "I received your message!";

      // Save to database
      await this.saveMessages(conversationId, message, reply, executedActions);

      return {
        reply,
        actions: executedActions,
      };
    } catch (error) {
      console.error(`[AIAgentService] Error processing message for ${employeeId}:`, error);
      return {
        reply: "Sorry, I'm having trouble connecting. Please try again.",
        actions: [],
      };
    }
  }

  /**
   * Generate a response based on conversation history
   * Used for continuing conversations
   */
  async generateResponse(
    employeeId: EmployeeType | string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: Partial<BusinessContext>
  ): Promise<string> {
    const employeeType = this.normalizeEmployeeType(employeeId);
    const persona = PERSONAS[employeeType];

    if (!persona) {
      throw new Error(`Unknown employee type: ${employeeId}`);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(employeeType, context || {}, persona);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || "I'm not sure how to respond to that.";
    } catch (error) {
      console.error(`[AIAgentService] Error generating response for ${employeeId}:`, error);
      return "Sorry, I'm having trouble thinking right now. Please try again.";
    }
  }

  /**
   * Handle WhatsApp messages specifically
   * Optimized for WhatsApp's format and constraints
   */
  async handleWhatsAppMessage(
    businessId: number,
    employeeId: EmployeeType | string | number,
    customerPhone: string,
    message: string,
    options?: {
      customerName?: string;
      mediaUrl?: string;
      replyToMessageId?: string;
    }
  ): Promise<AgentResponse> {
    // Get business context
    const businessContext = await this.getBusinessContext(businessId);

    // Resolve employee type
    const employeeType = await this.resolveEmployeeType(employeeId, businessId);

    // Get conversation history for context
    const conversationHistory = await this.getConversationHistory(businessId, customerPhone);

    // Process the message
    const response = await this.processMessage(employeeType, message, {
      ...businessContext,
      customer_phone: customerPhone,
      channel: 'whatsapp',
      conversationHistory,
      customerName: options?.customerName,
    });

    // Log the interaction for analytics
    await this.logInteraction(businessId, employeeType, 'whatsapp', message, response.reply);

    return response;
  }

  /**
   * Handle email messages
   * Optimized for email format and professionalism
   */
  async handleEmail(
    businessId: number,
    employeeId: EmployeeType | string | number,
    emailContent: {
      from: string;
      subject: string;
      body: string;
      to?: string;
      cc?: string[];
      threadId?: string;
    },
    options?: {
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  ): Promise<AgentResponse> {
    // Get business context
    const businessContext = await this.getBusinessContext(businessId);

    // Resolve employee type (default to Eva for emails if not specified)
    const employeeType = employeeId
      ? await this.resolveEmployeeType(employeeId, businessId)
      : 'eva';

    // Format the email for processing
    const formattedMessage = `Subject: ${emailContent.subject}\n\n${emailContent.body}`;

    // Process the message
    const response = await this.processMessage(employeeType, formattedMessage, {
      ...businessContext,
      customer_phone: emailContent.from,
      channel: 'email',
      conversationHistory: options?.conversationHistory,
    });

    // Log the interaction
    await this.logInteraction(businessId, employeeType, 'email', emailContent.subject, response.reply);

    return response;
  }

  /**
   * Handle voice calls
   * Optimized for voice interactions with shorter responses
   */
  async handleVoiceCall(
    businessId: number,
    employeeId: EmployeeType | string | number,
    customerPhone: string,
    transcript: string,
    options?: {
      isIncoming?: boolean;
      callUuid?: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  ): Promise<AgentResponse> {
    // Get business context
    const businessContext = await this.getBusinessContext(businessId);

    // Resolve employee type (default to Omar or Rachel for voice)
    let employeeType: EmployeeType = 'omar';
    if (employeeId) {
      employeeType = await this.resolveEmployeeType(employeeId, businessId);
    } else {
      // Try to find a voice agent for this business
      const voiceAgent = await this.findVoiceAgent(businessId);
      if (voiceAgent) {
        employeeType = voiceAgent;
      }
    }

    // Process the message with voice-optimized settings
    const response = await this.processMessage(employeeType, transcript, {
      ...businessContext,
      customer_phone: customerPhone,
      channel: 'voice',
      conversationHistory: options?.conversationHistory,
    });

    // For voice, we might want shorter responses
    // Truncate if necessary while keeping meaning
    const voiceResponse = this.optimizeForVoice(response.reply);

    // Log the interaction
    await this.logInteraction(businessId, employeeType, 'voice', transcript, voiceResponse);

    return {
      ...response,
      reply: voiceResponse,
    };
  }

  /**
   * Execute a specific action directly
   */
  async executeAction(
    actionName: string,
    params: any,
    context: BusinessContext
  ): Promise<ActionResult> {
    const action = getAction(actionName);

    if (!action) {
      return {
        success: false,
        error: `Action "${actionName}" not found`,
      };
    }

    return await action.execute(params, context);
  }

  /**
   * Get available actions for an employee type
   */
  getEmployeeActions(employeeType: EmployeeType | string): string[] {
    return getEmployeeTools(this.normalizeEmployeeType(employeeType));
  }

  /**
   * Get employee persona details
   */
  getEmployeePersona(employeeType: EmployeeType | string): PersonaDefinition | undefined {
    return PERSONAS[this.normalizeEmployeeType(employeeType)];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Normalize employee type string
   */
  private normalizeEmployeeType(employeeId: EmployeeType | string | number): EmployeeType {
    const typeStr = String(employeeId).toLowerCase();

    // Map common variations
    const mappings: Record<string, EmployeeType> = {
      amina: 'amina',
      eva: 'eva',
      stan: 'stan',
      rachel: 'rachel',
      sonny: 'sonny',
      penny: 'penny',
      linda: 'linda',
      zara: 'zara',
      omar: 'omar',
      kofi: 'kofi',
      // Alternative names
      support: 'amina',
      'customer support': 'amina',
      assistant: 'eva',
      'executive assistant': 'eva',
      sales: 'stan',
      'sales dev': 'stan',
      receptionist: 'rachel',
      social: 'sonny',
      'social media': 'sonny',
      content: 'kofi',
      seo: 'penny',
      legal: 'linda',
      scheduler: 'zara',
      voice: 'omar',
    };

    return mappings[typeStr] || (typeStr as EmployeeType);
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(
    employeeType: EmployeeType,
    context: Partial<BusinessContext> & { customerName?: string },
    persona: PersonaDefinition
  ): string {
    const basePrompt = EMPLOYEE_SYSTEM_PROMPTS[employeeType] || persona.prompt;

    return `${basePrompt}

BUSINESS CONTEXT:
Business: ${context.business_name || 'Unknown Business'}
Business ID: ${context.business_id || 'N/A'}
${context.customerName ? `Customer: ${context.customerName}` : `Customer Phone: ${context.customer_phone || 'Unknown'}`}
Channel: ${context.channel || 'text'}
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

INSTRUCTIONS:
1. Use the available tools when the customer asks about products, orders, appointments, or customer info
2. Always confirm important actions before executing
3. If you're unsure, ask for clarification or escalate to human
4. Be concise but helpful
5. Stay in character as ${persona.displayName}

Available tools: ${persona.tools.join(', ')}`;
  }

  /**
   * Get or create conversation record
   */
  private async getOrCreateConversation(
    customerPhone: string,
    businessId: number,
    employeeId: number
  ): Promise<number> {
    try {
      const convResult = await pool.query(
        `SELECT id FROM conversations 
         WHERE customer_phone = $1 AND business_id = $2 
         ORDER BY started_at DESC LIMIT 1`,
        [customerPhone, businessId]
      );

      if (convResult.rows.length === 0) {
        const newConv = await pool.query(
          `INSERT INTO conversations (business_id, customer_phone, employee_id, status, started_at) 
           VALUES ($1, $2, $3, 'open', NOW()) RETURNING id`,
          [businessId, customerPhone, employeeId]
        );
        return newConv.rows[0].id;
      }

      return convResult.rows[0].id;
    } catch (error) {
      console.error('[AIAgentService] Error getting/creating conversation:', error);
      return 0;
    }
  }

  /**
   * Save messages to database
   */
  private async saveMessages(
    conversationId: number,
    userMessage: string,
    aiReply: string,
    actions: ExecutedAction[]
  ): Promise<void> {
    try {
      // Save user message
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content, created_at) 
         VALUES ($1, 'user', $2, NOW())`,
        [conversationId, userMessage]
      );

      // Save AI response with action metadata
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content, metadata, created_at) 
         VALUES ($1, 'assistant', $2, $3, NOW())`,
        [conversationId, aiReply, JSON.stringify({ actions })]
      );

      // Update conversation
      await pool.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      );
    } catch (error) {
      console.error('[AIAgentService] Error saving messages:', error);
    }
  }

  /**
   * Get business context from database
   */
  private async getBusinessContext(businessId: number): Promise<Partial<BusinessContext>> {
    try {
      const result = await pool.query(
        'SELECT id, name, description FROM businesses WHERE id = $1',
        [businessId]
      );

      if (result.rows.length === 0) {
        return { business_id: businessId };
      }

      return {
        business_id: result.rows[0].id,
        business_name: result.rows[0].name,
      };
    } catch (error) {
      console.error('[AIAgentService] Error getting business context:', error);
      return { business_id: businessId };
    }
  }

  /**
   * Resolve employee type from ID or name
   */
  private async resolveEmployeeType(
    employeeId: string | number,
    businessId: number
  ): Promise<EmployeeType> {
    // If it's already a valid employee type string
    const normalizedType = this.normalizeEmployeeType(String(employeeId));
    if (PERSONAS[normalizedType]) {
      return normalizedType;
    }

    // Try to look up by ID
    try {
      const result = await pool.query(
        `SELECT ae.name FROM ai_employees ae
         JOIN business_employees be ON ae.id = be.employee_id
         WHERE be.id = $1 OR ae.id = $1 AND be.business_id = $2`,
        [employeeId, businessId]
      );

      if (result.rows.length > 0) {
        return this.normalizeEmployeeType(result.rows[0].name);
      }
    } catch (error) {
      console.error('[AIAgentService] Error resolving employee type:', error);
    }

    // Default to amina
    return 'amina';
  }

  /**
   * Get conversation history for context
   */
  private async getConversationHistory(
    businessId: number,
    customerPhone: string,
    limit: number = 10
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      const result = await pool.query(
        `SELECT role, content FROM messages
         WHERE conversation_id IN (
           SELECT id FROM conversations 
           WHERE business_id = $1 AND customer_phone = $2
         )
         ORDER BY created_at DESC
         LIMIT $3`,
        [businessId, customerPhone, limit]
      );

      return result.rows.reverse().map((row: any) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
      }));
    } catch (error) {
      console.error('[AIAgentService] Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Find a voice agent for the business
   */
  private async findVoiceAgent(businessId: number): Promise<EmployeeType | null> {
    try {
      const result = await pool.query(
        `SELECT ae.name FROM ai_employees ae
         JOIN business_employees be ON ae.id = be.employee_id
         WHERE be.business_id = $1 
         AND (ae.employee_role ILIKE '%Voice%' OR ae.employee_role ILIKE '%Receptionist%' OR ae.employee_role ILIKE '%Call%')
         LIMIT 1`,
        [businessId]
      );

      if (result.rows.length > 0) {
        const name = result.rows[0].name.toLowerCase();
        if (PERSONAS[name]) {
          return name as EmployeeType;
        }
      }
    } catch (error) {
      console.error('[AIAgentService] Error finding voice agent:', error);
    }

    return null;
  }

  /**
   * Optimize response for voice (shorter, clearer)
   */
  private optimizeForVoice(response: string): string {
    // Remove markdown formatting
    let optimized = response
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // If response is too long, try to extract key points
    const sentences = optimized.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) {
      // Keep first 2-3 sentences for voice
      optimized = sentences.slice(0, 3).join('. ') + '.';
    }

    return optimized.trim();
  }

  /**
   * Log interaction for analytics
   */
  private async logInteraction(
    businessId: number,
    employeeType: EmployeeType,
    channel: string,
    input: string,
    output: string
  ): Promise<void> {
    try {
      // Update employee stats
      await pool.query(
        `UPDATE business_employees 
         SET messages_processed = COALESCE(messages_processed, 0) + 1,
             last_active = NOW()
         WHERE business_id = $1 
         AND employee_id = (SELECT id FROM ai_employees WHERE name = $2)`,
        [businessId, employeeType]
      );
    } catch (error) {
      // Non-critical, just log
      console.error('[AIAgentService] Error logging interaction:', error);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Create and export singleton instance
export const aiAgentService = new AIAgentService();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export async function processMessage(
  employeeId: EmployeeType | string,
  message: string,
  context: Parameters<AIAgentService['processMessage']>[2]
): Promise<AgentResponse> {
  return aiAgentService.processMessage(employeeId, message, context);
}

export async function handleWhatsAppMessage(
  businessId: number,
  employeeId: EmployeeType | string | number,
  customerPhone: string,
  message: string,
  options?: Parameters<AIAgentService['handleWhatsAppMessage']>[4]
): Promise<AgentResponse> {
  return aiAgentService.handleWhatsAppMessage(businessId, employeeId, customerPhone, message, options);
}

export async function handleEmail(
  businessId: number,
  employeeId: EmployeeType | string | number,
  emailContent: Parameters<AIAgentService['handleEmail']>[2],
  options?: Parameters<AIAgentService['handleEmail']>[3]
): Promise<AgentResponse> {
  return aiAgentService.handleEmail(businessId, employeeId, emailContent, options);
}

export async function generateResponse(
  employeeId: EmployeeType | string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  context?: Partial<BusinessContext>
): Promise<string> {
  return aiAgentService.generateResponse(employeeId, conversationHistory, context);
}

export async function executeAction(
  actionName: string,
  params: any,
  context: BusinessContext
): Promise<ActionResult> {
  return aiAgentService.executeAction(actionName, params, context);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  aiAgentService,
  processMessage,
  handleWhatsAppMessage,
  handleEmail,
  generateResponse,
  executeAction,
  AIAgentService,
};
