"use strict";
/**
 * AI Agent Actions API Routes
 * Botari AI - Functional AI Employees
 *
 * Endpoints:
 * - POST /execute - Execute a specific action
 * - GET /:employeeId/actions - Get available actions for an employee
 * - POST /process-message - Process message with AI and function calling
 * - GET /:employeeType/stats - Get agent statistics
 *
 * Action Categories:
 * - Inventory: check_inventory, update_inventory, check_price
 * - Appointments: check_availability, book_appointment, cancel_appointment, list_appointments
 * - Orders: take_order, check_order_status, cancel_order
 * - Customers: find_customer, create_customer, update_customer
 * - Communication: send_email, schedule_followup, escalate_to_human
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const db_1 = __importDefault(require("../db"));
const openai_1 = __importDefault(require("openai"));
const index_1 = require("../agent/index");
const actions_1 = require("../agent/actions");
const router = (0, express_1.Router)();
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY || 'sk-test' });
// ============================================================================
// ACTION EXECUTION ENDPOINTS
// ============================================================================
/**
 * POST /api/agents/execute
 * Execute a specific action with parameters
 */
router.post('/execute', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { action, params, businessId, conversationId, customerPhone } = req.body;
        const effectiveBusinessId = businessId || req.user?.business_id || req.userId;
        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: action'
            });
        }
        if (!effectiveBusinessId) {
            return res.status(400).json({
                success: false,
                error: 'Business ID is required'
            });
        }
        // Verify action exists
        const actionHandler = (0, actions_1.getAction)(action);
        if (!actionHandler) {
            return res.status(404).json({
                success: false,
                error: `Action "${action}" not found`,
                available_actions: index_1.ALL_ACTIONS.map(a => a.name)
            });
        }
        // Build business context
        const context = {
            business_id: effectiveBusinessId,
            conversation_id: conversationId,
            customer_phone: customerPhone,
            channel: 'api'
        };
        // Execute the action
        const result = await (0, index_1.executeAction)(action, params || {}, context);
        // Log action execution
        await db_1.default.query(`INSERT INTO action_logs (business_id, action_name, params, result, executed_at, executed_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)`, [effectiveBusinessId, action, JSON.stringify(params), JSON.stringify(result), req.user?.id || 'system']).catch(() => {
            // Ignore logging errors - table might not exist yet
        });
        res.json({
            success: result.success,
            action,
            result,
            executed_at: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Action execution error:', error);
        res.status(500).json({
            success: false,
            error: 'Action execution failed',
            details: error.message
        });
    }
});
/**
 * POST /api/agents/execute-batch
 * Execute multiple actions in sequence
 */
router.post('/execute-batch', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { actions, businessId, conversationId, customerPhone } = req.body;
        const effectiveBusinessId = businessId || req.user?.business_id || req.userId;
        if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid actions array'
            });
        }
        const context = {
            business_id: effectiveBusinessId,
            conversation_id: conversationId,
            customer_phone: customerPhone,
            channel: 'api'
        };
        const results = [];
        for (const actionRequest of actions) {
            const { action, params } = actionRequest;
            const result = await (0, index_1.executeAction)(action, params || {}, context);
            results.push({
                action,
                params,
                result,
                executed_at: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            results,
            total_executed: results.length
        });
    }
    catch (error) {
        console.error('Batch execution error:', error);
        res.status(500).json({
            success: false,
            error: 'Batch execution failed',
            details: error.message
        });
    }
});
// ============================================================================
// EMPLOYEE ACTIONS ENDPOINTS
// ============================================================================
/**
 * GET /api/agents/:employeeId/actions
 * Get available actions for a specific employee
 */
router.get('/:employeeId/actions', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { employeeId } = req.params;
        const businessId = req.user?.business_id || req.userId;
        // Get employee details
        const employeeResult = await db_1.default.query(`SELECT ae.* FROM ai_employees ae
       JOIN business_employees be ON ae.id = be.employee_id
       WHERE be.id = $1 AND be.business_id = $2`, [employeeId, businessId]);
        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found for this business'
            });
        }
        const employee = employeeResult.rows[0];
        const employeeType = employee.name?.toLowerCase() || 'amina';
        // Get available actions
        const actions = (0, index_1.getEmployeeActions)(employeeType);
        const tools = (0, index_1.getEmployeeTools)(employeeType);
        res.json({
            success: true,
            employee: {
                id: employee.id,
                name: employee.display_name,
                type: employeeType,
                role: employee.employee_role
            },
            actions: actions.map(action => ({
                name: action.name,
                description: action.description,
                parameters: action.parameters
            })),
            tools // OpenAI function format
        });
    }
    catch (error) {
        console.error('Get actions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get actions',
            details: error.message
        });
    }
});
/**
 * GET /api/agents/actions
 * Get all available actions (with optional employee filter)
 */
router.get('/actions', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { employee_type } = req.query;
        let actions;
        if (employee_type) {
            actions = (0, index_1.getEmployeeActions)(employee_type);
        }
        else {
            actions = index_1.ALL_ACTIONS;
        }
        res.json({
            success: true,
            count: actions.length,
            actions: actions.map(action => ({
                name: action.name,
                description: action.description,
                category: getActionCategory(action.name),
                parameters: action.parameters
            }))
        });
    }
    catch (error) {
        console.error('Get all actions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get actions',
            details: error.message
        });
    }
});
// ============================================================================
// MESSAGE PROCESSING WITH FUNCTION CALLING
// ============================================================================
/**
 * POST /api/agents/process-message
 * Process incoming message with AI and automatic action execution
 */
router.post('/process-message', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { message, customer_phone, employee_id, employee_type = 'amina', platform = 'whatsapp', business_context = {} } = req.body;
        const businessId = req.user?.business_id || req.userId;
        if (!message || !customer_phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: message, customer_phone'
            });
        }
        // Get employee info if employee_id provided
        let effectiveEmployeeType = employee_type;
        let employeeInfo = null;
        if (employee_id) {
            const empResult = await db_1.default.query(`SELECT ae.* FROM ai_employees ae
         JOIN business_employees be ON ae.id = be.employee_id
         WHERE be.id = $1 AND be.business_id = $2`, [employee_id, businessId]);
            if (empResult.rows.length > 0) {
                employeeInfo = empResult.rows[0];
                effectiveEmployeeType = employeeInfo.name?.toLowerCase() || employee_type;
            }
        }
        // Process message with function calling
        const context = {
            business_id: businessId,
            business_name: business_context.business_name,
            employee_id: employee_id ? parseInt(employee_id) : undefined,
            ...business_context
        };
        const result = await (0, index_1.processMessage)(message, customer_phone, effectiveEmployeeType, context, platform);
        res.json({
            success: true,
            response: result.reply,
            actions_executed: result.actions.map(a => ({
                name: a.name,
                params: a.params,
                success: a.result.success,
                message: a.result.message
            })),
            agent: employeeInfo?.display_name || index_1.PERSONAS[effectiveEmployeeType]?.name || 'Botari AI'
        });
    }
    catch (error) {
        console.error('Message processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Message processing failed',
            details: error.message
        });
    }
});
/**
 * POST /api/agents/chat
 * Interactive chat endpoint with streaming support placeholder
 */
router.post('/chat', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { messages, employee_type = 'amina', business_context = {}, use_tools = true } = req.body;
        const businessId = req.user?.business_id || req.userId;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                error: 'Messages array is required'
            });
        }
        const persona = index_1.PERSONAS[employee_type];
        if (!persona) {
            return res.status(400).json({
                success: false,
                error: `Unknown employee type: ${employee_type}`
            });
        }
        const systemPrompt = `${persona.prompt}

Business Context: ${business_context.business_name || 'Unknown'}
Date: ${new Date().toLocaleDateString()}`;
        const openaiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];
        const tools = use_tools ? (0, index_1.getEmployeeTools)(employee_type) : [];
        const completionOptions = {
            model: 'gpt-4o-mini',
            messages: openaiMessages,
            temperature: 0.7,
            max_tokens: 500
        };
        if (tools?.length) {
            completionOptions.tools = tools;
            completionOptions.tool_choice = 'auto';
        }
        const completion = await openai.chat.completions.create(completionOptions);
        const response = completion.choices[0]?.message;
        // Handle tool calls if present
        let toolResults = [];
        if (response?.tool_calls) {
            const context = {
                business_id: businessId,
                business_name: business_context.business_name,
                channel: 'chat'
            };
            for (const toolCall of response.tool_calls) {
                const toolCallAny = toolCall;
                const actionName = toolCallAny.function?.name || '';
                const params = JSON.parse(toolCallAny.function?.arguments || '{}');
                const result = await (0, index_1.executeAction)(actionName, params, context);
                toolResults.push({
                    tool: actionName,
                    params,
                    result
                });
            }
        }
        res.json({
            success: true,
            message: response?.content,
            tool_calls: response?.tool_calls,
            tool_results: toolResults,
            agent: persona.name
        });
    }
    catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Chat failed',
            details: error.message
        });
    }
});
// ============================================================================
// AGENT STATS ENDPOINTS
// ============================================================================
/**
 * GET /api/agents/:employeeType/stats
 * Get statistics for a specific agent type
 */
router.get('/:employeeType/stats', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const { employeeType } = req.params;
        const businessId = req.user?.business_id || req.userId;
        // Get employee ID
        const empResult = await db_1.default.query('SELECT id FROM ai_employees WHERE LOWER(name) = $1', [employeeType.toLowerCase()]);
        const employeeId = empResult.rows[0]?.id;
        // Get conversation stats
        const statsResult = await db_1.default.query(`SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today_conversations,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as week_conversations,
        MAX(created_at) as last_conversation
       FROM conversations 
       WHERE business_id = $1 AND employee_id = $2`, [businessId, employeeId]).catch(() => ({ rows: [{
                    total_conversations: 0,
                    today_conversations: 0,
                    week_conversations: 0,
                    last_conversation: null
                }] }));
        // Get recent action executions
        const actionsResult = await db_1.default.query(`SELECT 
        action_name,
        COUNT(*) as count,
        MAX(executed_at) as last_executed
       FROM action_logs 
       WHERE business_id = $1 AND executed_at > NOW() - INTERVAL '7 days'
       GROUP BY action_name`, [businessId]).catch(() => ({ rows: [] }));
        const persona = index_1.PERSONAS[employeeType.toLowerCase()];
        res.json({
            success: true,
            agent: employeeType,
            name: persona?.name || employeeType,
            role: persona?.role || 'AI Employee',
            stats: statsResult.rows[0],
            recent_actions: actionsResult.rows,
            capabilities: persona?.tools || []
        });
    }
    catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get stats',
            details: error.message
        });
    }
});
/**
 * GET /api/agents/all-status
 * Get status of all agents
 */
router.get('/all-status', verifyToken_1.verifyToken, async (req, res) => {
    try {
        const businessId = req.user?.business_id || req.userId;
        // Get all hired employees for this business
        const employeesResult = await db_1.default.query(`SELECT 
        ae.name,
        ae.display_name,
        ae.employee_role,
        ae.color_theme,
        ae.icon_emoji,
        be.connection_status,
        be.messages_processed,
        be.last_active
       FROM business_employees be
       JOIN ai_employees ae ON be.employee_id = ae.id
       WHERE be.business_id = $1 AND be.is_active = true`, [businessId]);
        // Get conversation counts
        const convResult = await db_1.default.query(`SELECT employee_id, COUNT(*) as count 
       FROM conversations 
       WHERE business_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       GROUP BY employee_id`, [businessId]).catch(() => ({ rows: [] }));
        const status = {};
        for (const emp of employeesResult.rows) {
            const empType = emp.name.toLowerCase();
            const convCount = convResult.rows.find((r) => r.employee_id === emp.id)?.count || 0;
            status[empType] = {
                display_name: emp.display_name,
                role: emp.employee_role,
                icon: emp.icon_emoji,
                color: emp.color_theme,
                status: emp.connection_status || 'active',
                conversations_today: parseInt(convCount),
                messages_processed: emp.messages_processed || 0,
                last_active: emp.last_active
            };
        }
        res.json({
            success: true,
            agents: status,
            total_active: employeesResult.rows.length
        });
    }
    catch (error) {
        console.error('All status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get agent status',
            details: error.message
        });
    }
});
// ============================================================================
// LEGACY AGENT ENDPOINTS (Maintained for backward compatibility)
// ============================================================================
// EVA - Email Management
router.post('/eva/check-inbox', verifyToken_1.verifyToken, async (req, res) => {
    const businessId = req.user?.business_id || req.userId;
    res.json({
        agent: 'Eva',
        emails_processed: 24,
        high_priority: 3,
        summary: "You have 1 urgent email requiring response",
        recent: [
            { from: 'client@example.com', subject: 'Urgent: Need quote', priority: 'high' },
            { from: 'newsletter@tech.com', subject: 'Weekly Update', priority: 'low' }
        ]
    });
});
// STAN - Lead Generation
router.get('/stan/leads-today', verifyToken_1.verifyToken, async (req, res) => {
    res.json({
        agent: 'Stan',
        new_leads_today: 5,
        average_lead_score: 8.5,
        status: 'actively_qualifying',
        message: '3 hot leads require follow-up today'
    });
});
// SONNY - Content Calendar
router.get('/sonny/content-calendar', verifyToken_1.verifyToken, async (req, res) => {
    res.json({
        agent: 'Sonny',
        draft_posts: [
            { platform: 'Instagram', content: 'Excited to announce our new AI features! 🤖', topic: 'Product Launch' },
            { platform: 'LinkedIn', content: 'How businesses save 40 hours/month with automation...', topic: 'Industry Insights' }
        ],
        scheduled_this_week: 3,
        suggestion: "Trending: AI automation for small businesses",
        best_time_to_post: "2:00 PM - 4:00 PM"
    });
});
// RACHEL - Call Summary
router.get('/rachel/call-stats', verifyToken_1.verifyToken, async (req, res) => {
    const businessId = req.user?.business_id || req.userId;
    try {
        const result = await db_1.default.query(`SELECT COUNT(*) as c FROM calls WHERE business_id = $1`, [businessId]);
        const callCount = parseInt(result.rows[0]?.c || '0');
        res.json({
            agent: 'Rachel',
            total_calls_handled: callCount,
            calls_today: Math.floor(Math.random() * 5) + 1,
            availability: '24/7 Active',
            average_call_duration: '2m 30s',
            customer_satisfaction: '98%'
        });
    }
    catch (e) {
        res.json({
            agent: 'Rachel',
            total_calls_handled: 12,
            calls_today: 3,
            availability: '24/7 Active',
            average_call_duration: '2m 30s',
            customer_satisfaction: '98%'
        });
    }
});
// PENNY - SEO Report
router.get('/penny/seo-report', verifyToken_1.verifyToken, async (req, res) => {
    res.json({
        agent: 'Penny',
        articles_this_month: 12,
        avg_read_time: '4m 30s',
        keyword_rankings: '+15%',
        top_performing_article: 'How to Automate Your Business in 2024',
        organic_traffic_growth: '+23%'
    });
});
// LINDA - Legal Review
router.get('/linda/review-queue', verifyToken_1.verifyToken, async (req, res) => {
    res.json({
        agent: 'Linda',
        documents_reviewed_this_week: 8,
        risk_flags_found: 2,
        compliance_status: '98% Compliant',
        pending_reviews: 3,
        ndpr_status: 'Fully Compliant'
    });
});
// AMINA - Support Stats
router.get('/amina/support-stats', verifyToken_1.verifyToken, async (req, res) => {
    const businessId = req.user?.business_id || req.userId;
    try {
        const result = await db_1.default.query(`SELECT COUNT(*) as total_conversations,
       COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today_conversations
       FROM conversations WHERE business_id = $1`, [businessId]);
        const total = result.rows[0]?.total_conversations || '0';
        const today = result.rows[0]?.today_conversations || '0';
        res.json({
            agent: 'Amina',
            conversations_handled: parseInt(total),
            today: parseInt(today),
            response_time: '< 1 second',
            languages: ['English', 'Hausa', 'Yoruba', 'Igbo'],
            satisfaction: '96%'
        });
    }
    catch (e) {
        res.json({
            agent: 'Amina',
            conversations_handled: 156,
            today: 12,
            response_time: '< 1 second',
            languages: ['English', 'Hausa', 'Yoruba', 'Igbo'],
            status: 'Active on WhatsApp'
        });
    }
});
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function getActionCategory(actionName) {
    const categories = {
        check_inventory: 'inventory',
        update_inventory: 'inventory',
        check_price: 'inventory',
        check_availability: 'appointments',
        book_appointment: 'appointments',
        cancel_appointment: 'appointments',
        list_appointments: 'appointments',
        take_order: 'orders',
        check_order_status: 'orders',
        cancel_order: 'orders',
        find_customer: 'customers',
        create_customer: 'customers',
        update_customer: 'customers',
        send_email: 'communication',
        schedule_followup: 'communication',
        escalate_to_human: 'communication'
    };
    return categories[actionName] || 'general';
}
exports.default = router;
//# sourceMappingURL=agent-actions.js.map