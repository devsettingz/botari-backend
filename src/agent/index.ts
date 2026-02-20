/**
 * AI Agent Core with Function Calling Support
 * Botari AI - Functional AI Employees
 * 
 * This module handles AI processing with the ability to:
 * 1. Parse user intent to determine which action to call
 * 2. Call the appropriate action handler
 * 3. Include action results in AI context for response generation
 * 4. Return both reply and executed actions
 */

import OpenAI from 'openai';
import pool from '../db';
import {
  getEmployeeActions,
  getEmployeeTools,
  getAction,
  ALL_ACTIONS
} from './actions';
import {
  PERSONAS,
  PersonaDefinition
} from './personas';
import {
  BusinessContext,
  AgentResponse,
  ExecutedAction,
  ActionResult
} from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type EmployeeType = keyof typeof PERSONAS;

// ============================================================================
// CORE MESSAGE PROCESSING
// ============================================================================

export async function processMessage(
  text: string,
  userId: string,
  employeeType: EmployeeType = 'amina',
  businessContext: any = {},
  channel: string = 'whatsapp'
): Promise<AgentResponse> {
  
  const persona = PERSONAS[employeeType];
  if (!persona) {
    throw new Error(`Unknown employee type: ${employeeType}`);
  }

  const executedActions: ExecutedAction[] = [];

  try {
    // Get or create conversation
    const convResult = await pool.query(
      `SELECT id FROM conversations WHERE customer_phone = $1 AND business_id = $2 
       ORDER BY started_at DESC LIMIT 1`,
      [userId, businessContext.business_id || 1]
    );

    let conversationId: number;

    if (convResult.rows.length === 0) {
      const newConv = await pool.query(
        `INSERT INTO conversations (business_id, customer_phone, employee_id, status, started_at) 
         VALUES ($1, $2, $3, 'open', NOW()) RETURNING id`,
        [businessContext.business_id || 1, userId, businessContext.employee_id || 1]
      );
      conversationId = newConv.rows[0].id;
    } else {
      conversationId = convResult.rows[0].id;
    }

    // Build business context for actions
    const context: BusinessContext = {
      business_id: businessContext.business_id || 1,
      business_name: businessContext.business_name,
      conversation_id: conversationId,
      customer_phone: userId,
      employee_id: businessContext.employee_id,
      employee_name: persona.displayName,
      employee_type: String(employeeType),
      channel
    };

    // Get available tools for this employee
    const tools = getEmployeeTools(String(employeeType));

    // Prepare system prompt with context
    const systemPrompt = `${persona.prompt}

BUSINESS CONTEXT:
Business: ${businessContext.business_name || 'Unknown Business'}
Customer Phone: ${userId}
Channel: ${channel}
Date: ${new Date().toLocaleDateString()}

INSTRUCTIONS:
1. Use the available tools when the customer asks about products, orders, appointments, or customer info
2. Always confirm important actions before executing
3. If you're unsure, ask for clarification or escalate to human
4. Be concise but helpful`;

    // First OpenAI call - potentially with function calling
    const completionParams: any = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 500
    };
    
    if (tools.length > 0) {
      completionParams.tools = tools;
      completionParams.tool_choice = 'auto';
    }
    
    const completion = await openai.chat.completions.create(completionParams);

    // Check response validity
    if (!completion.choices || completion.choices.length === 0) {
      return { 
        reply: "I'm thinking about that... let me get back to you.", 
        actions: [] 
      };
    }

    const choice = completion.choices[0];
    
    if (!choice || !choice.message) {
      return { 
        reply: "I'm having trouble thinking right now.", 
        actions: [] 
      };
    }

    // Handle function calls
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ];

    // Process all tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const toolCallAny = toolCall as any;
        const functionName = toolCallAny.function?.name || '';
        const functionArgs = JSON.parse(toolCallAny.function?.arguments || '{}');

        // Execute the action
        const action = getAction(functionName);
        let result: ActionResult;

        if (action) {
          result = await action.execute(functionArgs, context);
        } else {
          result = { success: false, error: `Unknown action: ${functionName}` };
        }

        // Record the executed action
        executedActions.push({
          name: functionName,
          params: functionArgs,
          result,
          timestamp: new Date()
        });

        // Add tool response to messages
        messages.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        });
      }

      // Get final response from OpenAI with action results
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      if (finalCompletion.choices && finalCompletion.choices[0]?.message?.content) {
        const reply = finalCompletion.choices[0].message.content;

        // Save to database
        await saveMessages(conversationId, text, reply, executedActions);

        return {
          reply,
          actions: executedActions
        };
      }
    }

    // No function calls - direct response
    const reply = choice.message.content || "I received your message!";

    // Save to database
    await saveMessages(conversationId, text, reply, executedActions);

    return {
      reply,
      actions: executedActions
    };

  } catch (error) {
    console.error(`[${employeeType}] Error:`, error);
    return { 
      reply: "Sorry, I'm having trouble connecting. Please try again.", 
      actions: [] 
    };
  }
}

// ============================================================================
// MESSAGE ROUTING
// ============================================================================

export async function routeMessage(
  text: string,
  userId: string,
  channel: string,
  businessId: number
): Promise<string> {
  
  try {
    // Get assigned employee for this business and channel
    const result = await pool.query(
      `SELECT e.name as employee_name, be.employee_id 
       FROM channels c
       JOIN business_employees be ON c.assigned_employee_id = be.id
       JOIN ai_employees e ON be.employee_id = e.id
       WHERE c.business_id = $1 AND c.channel_type = $2 AND c.is_active = true`,
      [businessId, channel]
    );

    let employeeType: EmployeeType = 'amina';
    let employeeId: number | undefined;

    if (result.rows.length > 0) {
      const name = result.rows[0].employee_name?.toLowerCase();
      employeeId = result.rows[0].employee_id;
      if (name && PERSONAS[name]) {
        employeeType = name as EmployeeType;
      }
    }

    const response = await processMessage(
      text, 
      userId, 
      employeeType, 
      { business_id: businessId, employee_id: employeeId }, 
      channel
    );
    
    return response.reply;
    
  } catch (error) {
    console.error('Route error:', error);
    return "Sorry, I'm having trouble right now.";
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function saveMessages(
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
    console.error('Error saving messages:', error);
  }
}

// ============================================================================
// DIRECT ACTION EXECUTION
// ============================================================================

export async function executeAction(
  actionName: string,
  params: any,
  context: BusinessContext
): Promise<ActionResult> {
  const action = getAction(actionName);
  
  if (!action) {
    return {
      success: false,
      error: `Action "${actionName}" not found`
    };
  }

  return await action.execute(params, context);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PERSONAS, ALL_ACTIONS, getEmployeeActions, getEmployeeTools };
export type { EmployeeType, BusinessContext, AgentResponse, ExecutedAction };

export default { 
  processMessage, 
  routeMessage, 
  executeAction,
  PERSONAS 
};
