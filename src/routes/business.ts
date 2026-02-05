import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken';
import pool from '../db';

const router = Router();

// ============================================
// BUSINESS CONTEXT & ONBOARDING ROUTES
// ============================================

// POST /api/business/context - Save onboarding data
router.post('/context', verifyToken, async (req: any, res: any) => {
    try {
        const businessId = req.user.business_id || req.userId;
        const {
            useCase,
            industry,
            websiteUrl,
            businessSize,
            emailVolume,
            socialFrequency,
            contentFrequency,
            painPoints,
            goals,
            brandVoice
        } = req.body;

        if (!businessId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await pool.query(
            `INSERT INTO business_context 
             (business_id, use_case, industry, website_url, business_size, 
              email_volume, social_posting_frequency, content_posting_frequency,
              pain_points, goals, brand_voice, analyzed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
             ON CONFLICT (business_id) 
             DO UPDATE SET
               use_case = EXCLUDED.use_case,
               industry = EXCLUDED.industry,
               website_url = EXCLUDED.website_url,
               business_size = EXCLUDED.business_size,
               email_volume = EXCLUDED.email_volume,
               social_posting_frequency = EXCLUDED.social_posting_frequency,
               content_posting_frequency = EXCLUDED.content_posting_frequency,
               pain_points = EXCLUDED.pain_points,
               goals = EXCLUDED.goals,
               brand_voice = EXCLUDED.brand_voice,
               analyzed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP`,
            [
                businessId, 
                useCase, 
                industry, 
                websiteUrl === 'none' ? null : websiteUrl, 
                businessSize,
                emailVolume, 
                socialFrequency, 
                contentFrequency,
                painPoints || [], 
                goals || [], 
                brandVoice || 'professional'
            ]
        );

        res.json({ 
            success: true, 
            message: 'Business context saved',
            next_step: 'analysis'
        });
    } catch (err: any) {
        console.error('Context save error:', err);
        res.status(500).json({ error: 'Failed to save business context', details: err.message });
    }
});

// POST /api/business/analyze - Analyze and configure agents
router.post('/analyze', verifyToken, async (req: any, res: any) => {
    try {
        const businessId = req.user.business_id || req.userId;
        
        if (!businessId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get context
        const contextRes = await pool.query(
            'SELECT * FROM business_context WHERE business_id = $1',
            [businessId]
        );
        const context = contextRes.rows[0];

        if (!context) {
            return res.status(400).json({ error: 'No business context found. Complete onboarding first.' });
        }

        // Get already hired employees
        const hiredRes = await pool.query(
            `SELECT be.employee_id, ae.name, ae.employee_role, ae.tier 
             FROM business_employees be
             JOIN ai_employees ae ON be.employee_id = ae.id
             WHERE be.business_id = $1 AND be.is_active = true`,
            [businessId]
        );

        // Generate smart recommendations
        const recommendations = generateRecommendations(context);
        
        // Configure each hired agent based on context
        for (const emp of hiredRes.rows) {
            await configureAgentForBusiness(businessId, emp.employee_id, emp.name, context);
        }

        // Calculate optimization score
        const optimizationScore = calculateOptimizationScore(context, hiredRes.rows.length);

        res.json({ 
            success: true, 
            recommendations,
            configured_agents: hiredRes.rows.length,
            optimization_score: optimizationScore,
            message: 'AI team configured based on your business profile',
            estimated_hours_saved: calculateHoursSaved(context)
        });
        
    } catch (err: any) {
        console.error('Analysis error:', err);
        res.status(500).json({ error: 'Analysis failed', details: err.message });
    }
});

// GET /api/business/context - Get current business context
router.get('/context', verifyToken, async (req: any, res: any) => {
    try {
        const businessId = req.user.business_id || req.userId;
        
        const result = await pool.query(
            'SELECT * FROM business_context WHERE business_id = $1',
            [businessId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No context found' });
        }
        
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch context' });
    }
});

// GET /api/business/agent-config/:employeeId - Get specific agent configuration
router.get('/agent-config/:employeeId', verifyToken, async (req: any, res: any) => {
    try {
        const businessId = req.user.business_id || req.userId;
        const { employeeId } = req.params;
        
        const configRes = await pool.query(
            `SELECT ac.*, ae.name, ae.employee_role, ae.color_theme, ae.icon_emoji 
             FROM agent_configurations ac
             JOIN ai_employees ae ON ac.employee_id = ae.id
             WHERE ac.business_id = $1 AND ac.employee_id = $2`,
            [businessId, employeeId]
        );
        
        if (configRes.rows.length === 0) {
            // Return default config if none exists
            const empRes = await pool.query(
                'SELECT * FROM ai_employees WHERE id = $1',
                [employeeId]
            );
            
            if (empRes.rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            
            return res.json({ 
                configuration: getDefaultConfig(empRes.rows[0].name),
                is_configured: false,
                employee: empRes.rows[0]
            });
        }
        
        res.json(configRes.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch agent config', details: err.message });
    }
});

// PUT /api/business/agent-config/:employeeId - Update agent configuration
router.put('/agent-config/:employeeId', verifyToken, async (req: any, res: any) => {
    try {
        const businessId = req.user.business_id || req.userId;
        const { employeeId } = req.params;
        const { configuration, system_prompt } = req.body;
        
        await pool.query(
            `INSERT INTO agent_configurations 
             (business_id, employee_id, configuration, system_prompt, is_configured, updated_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
             ON CONFLICT (business_id, employee_id)
             DO UPDATE SET 
               configuration = EXCLUDED.configuration,
               system_prompt = EXCLUDED.system_prompt,
               is_configured = true,
               updated_at = CURRENT_TIMESTAMP`,
            [businessId, employeeId, JSON.stringify(configuration), system_prompt]
        );
        
        res.json({ success: true, message: 'Configuration updated' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update config', details: err.message });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRecommendations(context: any) {
    const recs = [];
    
    // Priority 1: Email overload -> Eva
    if (context.email_volume === '50-200' || context.email_volume === '200+') {
        recs.push({
            employee_type: 'eva',
            name: 'Botari Eva',
            icon: '✉️',
            color: '#8B5CF6',
            priority: 1,
            reason: `Handle ${context.email_volume} daily emails with smart prioritization`,
            estimated_savings: '15 hours/week'
        });
    }
    
    // Priority 2: No social presence -> Sonny
    if (context.social_posting_frequency === 'Never') {
        recs.push({
            employee_type: 'sonny',
            name: 'Botari Sonny',
            icon: '📱',
            color: '#EC4899',
            priority: 2,
            reason: 'Build consistent social presence from scratch with AI',
            estimated_savings: '10 hours/week'
        });
    }
    
    // Priority 3: Missing leads -> Amina
    if (context.pain_points?.includes('Missing leads while sleeping')) {
        recs.push({
            employee_type: 'amina',
            name: 'Botari Amina',
            icon: '💬',
            color: '#3B82F6',
            priority: 1,
            reason: '24/7 WhatsApp response to capture every lead instantly',
            estimated_savings: 'Never miss a lead again'
        });
    }
    
    // Priority 4: Content creation -> Penny
    if (context.pain_points?.includes('No time for content creation') || context.content_posting_frequency === 'Never') {
        recs.push({
            employee_type: 'penny',
            name: 'Botari Penny',
            icon: '📝',
            color: '#06B6D4',
            priority: 3,
            reason: `Automated ${context.industry} content optimized for SEO`,
            estimated_savings: '8 hours/week'
        });
    }
    
    // Priority 5: Sales automation -> Stan
    if (context.use_case === 'agency' || context.pain_points?.includes('Too many repetitive inquiries')) {
        recs.push({
            employee_type: 'stan',
            name: 'Botari Stan',
            icon: '📈',
            color: '#10B981',
            priority: 3,
            reason: 'Automated lead gen and follow-up sequences',
            estimated_savings: '12 hours/week'
        });
    }
    
    return recs.sort((a, b) => a.priority - b.priority);
}

async function configureAgentForBusiness(businessId: number, employeeId: number, employeeName: string, context: any) {
    const name_lower = employeeName.toLowerCase();
    let config: any = {};
    let systemPrompt = '';
    
    // BOTARI AMINA - Customer Support
    if (name_lower.includes('amina')) {
        const responseStyle = context.brand_voice === 'casual' ? 'friendly and warm' : 
                             context.brand_voice === 'luxury' ? 'elegant and refined' : 'professional and efficient';
        
        config = {
            response_style: responseStyle,
            languages: context.industry === 'Local Business' ? ['English', 'Hausa', 'Yoruba', 'Igbo'] : ['English'],
            auto_reply_hours: context.pain_points?.includes('Missing leads while sleeping') ? '24/7' : 'business_hours',
            response_time_target: 'under_2_minutes',
            escalation_rules: {
                refund_above: 50000, // Naira
                sensitive_topics: ['legal', 'complaint', 'refund'],
                human_handoff_triggers: ['speak to human', 'manager', 'angry', 'lawsuit']
            },
            greeting_template: context.brand_voice === 'casual' ? 
                "Hey there! 👋 I'm Amina from {{business_name}}. How can I help you today?" :
                "Hello! Welcome to {{business_name}}. I'm Amina, your virtual assistant. How may I assist you?"
        };
        
        systemPrompt = `You are Amina, a customer support AI for ${context.industry} business. 
Tone: ${responseStyle}. Always be helpful. If customer mentions refund/complaint, apologize sincerely and offer human handoff.`;
    }
    
    // BOTARI EVA - Executive Assistant
    else if (name_lower.includes('eva')) {
        const autoReply = context.email_volume === '200+' ? 'urgent_only' : 
                         context.email_volume === '50-200' ? 'filtered' : 'draft_only';
        
        config = {
            email_priority_rules: {
                urgent: ['partnership', 'urgent', 'asap', 'meeting', 'invoice'],
                sales: ['interested', 'pricing', 'quote', 'demo'],
                support: ['help', 'issue', 'problem', 'broken'],
                ignore: ['newsletter', 'promotional', 'unsubscribe']
            },
            auto_reply_mode: autoReply,
            response_time_target: context.email_volume === '200+' ? '30_minutes' : '2_hours',
            calendar_buffer: 15, // minutes between meetings
            draft_style: context.brand_voice,
            meeting_prep: true,
            daily_digest_time: '08:00',
            whatsapp_integration: true
        };
        
        systemPrompt = `You are Eva, an executive assistant for ${context.industry}. 
Handle emails with ${context.brand_voice} tone. Prioritize: partnerships > sales > support. Draft concise replies.`;
    }
    
    // BOTARI STAN - Sales/Lead Gen
    else if (name_lower.includes('stan')) {
        config = {
            lead_sources: context.industry === 'SaaS' ? ['LinkedIn', 'Twitter'] : ['Instagram', 'Facebook'],
            outreach_tone: context.brand_voice === 'casual' ? 'friendly_persuasive' : 'professional_value',
            follow_up_sequence: [
                { day: 0, type: 'initial' },
                { day: 3, type: 'value_add' },
                { day: 7, type: 'social_proof' },
                { day: 14, type: 'breakup' }
            ],
            crm_sync: true,
            daily_lead_target: context.business_size === 'solo' ? 10 : 25,
            auto_qualify: true
        };
        
        systemPrompt = `You are Stan, a sales development rep for ${context.industry}. 
Find leads on ${config.lead_sources.join(', ')}. Be persistent but polite. Focus on value, not features.`;
    }
    
    // BOTARI SONNY - Social Media
    else if (name_lower.includes('sonny')) {
        const schedule = generateOptimalSchedule(context);
        config = {
            platforms: context.industry === 'B2B' ? ['LinkedIn', 'Twitter'] : ['Instagram', 'Facebook', 'TikTok'],
            posting_schedule: schedule,
            content_mix: {
                promotional: 20,
                educational: 40,
                engagement: 25,
                behind_scenes: 15
            },
            hashtag_strategy: context.industry === 'E-commerce' ? 'product_focused_high_volume' : 'community_engagement',
            engagement_rules: {
                reply_to_comments: true,
                reply_to_dms: true,
                like_mentions: true
            },
            brand_colors: [], // Could extract from website
            voice: context.brand_voice
        };
        
        systemPrompt = `You are Sonny, a social media manager for ${context.industry}. 
Create engaging content for ${config.platforms.join(', ')}. Mix: 40% educational, 20% promotional. Use emojis appropriately.`;
    }
    
    // BOTARI PENNY - Content/SEO
    else if (name_lower.includes('penny')) {
        config = {
            content_pillars: generateContentPillars(context.industry),
            seo_focus: context.industry === 'SaaS' ? 'long_tail_tech_keywords' : 'local_service_keywords',
            posting_frequency: context.content_posting_frequency === 'Never' ? '2_per_month' : 
                              context.content_posting_frequency === 'Weekly' ? '1_per_week' : '2_per_week',
            word_count_target: 1500,
            internal_linking: true,
            image_generation: true,
            newsletter_integration: true
        };
        
        systemPrompt = `You are Penny, an SEO content writer for ${context.industry}. 
Write ${config.word_count_target}-word articles targeting ${context.industry} keywords. Optimize for readability and search.`;
    }
    
    // BOTARI RACHEL - Voice/Receptionist
    else if (name_lower.includes('rachel')) {
        config = {
            voice_style: context.industry === 'Healthcare' ? 'warm_caring' : 
                        context.industry === 'Legal' ? 'authoritative_professional' : 'friendly_efficient',
            call_hours: '24/7',
            appointment_buffer: 15,
            call_transfer_rules: {
                emergency: 'immediate',
                sales_inquiry: 'business_hours_only',
                support: 'queue'
            },
            languages: ['English'],
            voicemail_transcription: true
        };
        
        systemPrompt = `You are Rachel, a voice AI receptionist for ${context.industry}. 
Answer calls with ${config.voice_style} demeanor. Handle appointments and basic inquiries. Transfer complex issues.`;
    }
    
    // BOTARI LINDA - Legal
    else if (name_lower.includes('linda')) {
        config = {
            document_types: ['NDA', 'Service Agreement', 'Employment Contract', 'Privacy Policy'],
            risk_threshold: 'medium', // flag clauses above this risk level
            jurisdiction: 'Nigeria', // Default, could be expanded
            review_turnaround: '24_hours',
            template_library: true,
            compliance_checking: ['GDPR', 'NDPR', 'Consumer Protection']
        };
        
        systemPrompt = `You are Linda, a legal assistant AI. Review contracts carefully. 
Flag risky clauses. Never provide legal advice, only document preparation and review assistance.`;
    }
    
    // Save configuration
    await pool.query(
        `INSERT INTO agent_configurations 
         (business_id, employee_id, configuration, system_prompt, is_configured, onboarding_completed, updated_at)
         VALUES ($1, $2, $3, $4, true, true, CURRENT_TIMESTAMP)
         ON CONFLICT (business_id, employee_id)
         DO UPDATE SET 
           configuration = EXCLUDED.configuration,
           system_prompt = EXCLUDED.system_prompt,
           is_configured = true,
           onboarding_completed = true,
           updated_at = CURRENT_TIMESTAMP`,
        [businessId, employeeId, JSON.stringify(config), systemPrompt]
    );
}

function generateOptimalSchedule(context: any) {
    const schedules: any = {
        'Restaurant': ['12:00', '18:00'],
        'SaaS': ['09:00', '14:00'],
        'E-commerce': ['19:00', '21:00'],
        'Agency': ['10:00', '15:00'],
        'Healthcare': ['08:00', '12:00'],
        'default': ['10:00', '15:00']
    };
    return schedules[context.industry] || schedules.default;
}

function generateContentPillars(industry: string) {
    const pillars: any = {
        'SaaS': ['Product Tutorials', 'Industry Trends', 'Developer Resources', 'Customer Success Stories'],
        'E-commerce': ['Product Guides', 'Styling Tips', 'Customer Reviews', 'Behind the Scenes'],
        'Agency': ['Case Studies', 'Marketing Tips', 'Industry News', 'Client Wins'],
        'Healthcare': ['Wellness Tips', 'Patient Education', 'Medical News', 'Healthy Living'],
        'Real Estate': ['Market Updates', 'Home Tips', 'Neighborhood Guides', 'Investment Advice'],
        'default': ['Industry Insights', 'How-To Guides', 'Company News', 'Thought Leadership']
    };
    return pillars[industry] || pillars.default;
}

function calculateOptimizationScore(context: any, agentCount: number) {
    let score = 0;
    if (context.email_volume === '200+') score += 20;
    if (context.pain_points?.length > 0) score += 20;
    if (agentCount > 0) score += 40;
    if (context.website_url && context.website_url !== 'none') score += 20;
    return Math.min(score, 100);
}

function calculateHoursSaved(context: any) {
    let hours = 0;
    if (context.email_volume === '200+') hours += 15;
    else if (context.email_volume === '50-200') hours += 8;
    
    if (context.social_posting_frequency === 'Never') hours += 10;
    if (context.pain_points?.includes('Missing leads while sleeping')) hours += 12;
    
    return hours;
}

function getDefaultConfig(employeeName: string) {
    return {
        mode: 'standard',
        auto_reply: false,
        response_time: 'manual'
    };
}

export default router;