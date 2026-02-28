"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeTools = exports.getEmployeeActions = exports.ALL_ACTIONS = exports.PERSONAS = void 0;
exports.processMessage = processMessage;
exports.routeMessage = routeMessage;
exports.executeAction = executeAction;
const openai_1 = __importDefault(require("openai"));
const db_1 = __importDefault(require("../db"));
const actions_1 = require("./actions");
Object.defineProperty(exports, "getEmployeeActions", { enumerable: true, get: function () { return actions_1.getEmployeeActions; } });
Object.defineProperty(exports, "getEmployeeTools", { enumerable: true, get: function () { return actions_1.getEmployeeTools; } });
Object.defineProperty(exports, "ALL_ACTIONS", { enumerable: true, get: function () { return actions_1.ALL_ACTIONS; } });
const personas_1 = require("./personas");
Object.defineProperty(exports, "PERSONAS", { enumerable: true, get: function () { return personas_1.PERSONAS; } });
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
// ============================================================================
// CORE MESSAGE PROCESSING
// ============================================================================
async function processMessage(text, userId, employeeType = 'amina', businessContext = {}, channel = 'whatsapp') {
    const persona = personas_1.PERSONAS[employeeType];
    if (!persona) {
        throw new Error(`Unknown employee type: ${employeeType}`);
    }
    const executedActions = [];
    try {
        // Get or create conversation
        const convResult = await db_1.default.query(`SELECT id FROM conversations WHERE customer_phone = $1 AND business_id = $2 
       ORDER BY started_at DESC LIMIT 1`, [userId, businessContext.business_id || 1]);
        let conversationId;
        if (convResult.rows.length === 0) {
            const newConv = await db_1.default.query(`INSERT INTO conversations (business_id, customer_phone, employee_id, status, started_at) 
         VALUES ($1, $2, $3, 'open', NOW()) RETURNING id`, [businessContext.business_id || 1, userId, businessContext.employee_id || 1]);
            conversationId = newConv.rows[0].id;
        }
        else {
            conversationId = convResult.rows[0].id;
        }
        // Build business context for actions
        const context = {
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
        const tools = (0, actions_1.getEmployeeTools)(String(employeeType));
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
        const completionParams = {
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
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
        ];
        // Process all tool calls
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            messages.push(choice.message);
            for (const toolCall of choice.message.tool_calls) {
                const toolCallAny = toolCall;
                const functionName = toolCallAny.function?.name || '';
                const functionArgs = JSON.parse(toolCallAny.function?.arguments || '{}');
                // Execute the action
                const action = (0, actions_1.getAction)(functionName);
                let result;
                if (action) {
                    result = await action.execute(functionArgs, context);
                }
                else {
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
    }
    catch (error) {
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
async function routeMessage(text, userId, channel, businessId) {
    try {
        // Get assigned employee for this business and channel
        const result = await db_1.default.query(`SELECT e.name as employee_name, be.employee_id 
       FROM channels c
       JOIN business_employees be ON c.assigned_employee_id = be.id
       JOIN ai_employees e ON be.employee_id = e.id
       WHERE c.business_id = $1 AND c.channel_type = $2 AND c.is_active = true`, [businessId, channel]);
        let employeeType = 'amina';
        let employeeId;
        if (result.rows.length > 0) {
            const name = result.rows[0].employee_name?.toLowerCase();
            employeeId = result.rows[0].employee_id;
            if (name && personas_1.PERSONAS[name]) {
                employeeType = name;
            }
        }
        const response = await processMessage(text, userId, employeeType, { business_id: businessId, employee_id: employeeId }, channel);
        return response.reply;
    }
    catch (error) {
        console.error('Route error:', error);
        return "Sorry, I'm having trouble right now.";
    }
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
async function saveMessages(conversationId, userMessage, aiReply, actions) {
    try {
        // Save user message
        await db_1.default.query(`INSERT INTO messages (conversation_id, role, content, created_at) 
       VALUES ($1, 'user', $2, NOW())`, [conversationId, userMessage]);
        // Save AI response with action metadata
        await db_1.default.query(`INSERT INTO messages (conversation_id, role, content, metadata, created_at) 
       VALUES ($1, 'assistant', $2, $3, NOW())`, [conversationId, aiReply, JSON.stringify({ actions })]);
        // Update conversation
        await db_1.default.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);
    }
    catch (error) {
        console.error('Error saving messages:', error);
    }
}
// ============================================================================
// DIRECT ACTION EXECUTION
// ============================================================================
async function executeAction(actionName, params, context) {
    const action = (0, actions_1.getAction)(actionName);
    if (!action) {
        return {
            success: false,
            error: `Action "${actionName}" not found`
        };
    }
    return await action.execute(params, context);
}
exports.default = {
    processMessage,
    routeMessage,
    executeAction,
    PERSONAS: personas_1.PERSONAS
};
//# sourceMappingURL=index.js.map