-- ============================================================================
-- AI Employee Personas Seed Data
-- Botari AI - Comprehensive AI Employee Roster
-- ============================================================================
-- This migration seeds all 10 AI employee personas into the ai_employees table
-- Run this to populate the employee marketplace
-- ============================================================================

-- ============================================================================
-- STARTER TIER ($49/month)
-- ============================================================================

INSERT INTO ai_employees (
    name, 
    display_name, 
    employee_role, 
    description, 
    price_monthly, 
    assigned_channel, 
    is_active,
    tier,
    color_theme,
    icon_emoji,
    features,
    created_at,
    updated_at
) VALUES (
    'amina',
    'Botari Amina',
    'WhatsApp Sales Specialist',
    'Your friendly WhatsApp sales assistant. Helps customers with product inquiries, orders, and appointments in English, Swahili, and Pidgin.',
    49,
    'whatsapp',
    true,
    'starter',
    '#10B981',
    '👩🏽‍💼',
    ARRAY[
        'WhatsApp Business integration',
        'Multi-language support (EN/SW/Pidgin)',
        'Product catalog management',
        'Order taking & tracking',
        'Appointment booking',
        'Customer management',
        'Basic sales reporting'
    ],
    NOW(),
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    employee_role = EXCLUDED.employee_role,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    is_active = EXCLUDED.is_active,
    tier = EXCLUDED.tier,
    color_theme = EXCLUDED.color_theme,
    icon_emoji = EXCLUDED.icon_emoji,
    features = EXCLUDED.features,
    updated_at = NOW();

-- ============================================================================
-- PROFESSIONAL TIER ($99/month)
-- ============================================================================

INSERT INTO ai_employees (
    name, 
    display_name, 
    employee_role, 
    description, 
    price_monthly, 
    assigned_channel, 
    is_active,
    tier,
    color_theme,
    icon_emoji,
    features,
    created_at,
    updated_at
) VALUES 
(
    'stan',
    'Botari Stan',
    'B2B Sales Development Rep',
    'Your professional B2B sales hunter. Generates leads, qualifies prospects, and schedules sales meetings to grow your business.',
    99,
    'email',
    true,
    'professional',
    '#3B82F6',
    '👔',
    ARRAY[
        'Lead qualification',
        'Prospect research',
        'Email outreach automation',
        'Meeting scheduling',
        'CRM integration',
        'Sales pipeline tracking',
        'Follow-up reminders',
        'Lead scoring'
    ],
    NOW(),
    NOW()
),
(
    'eva',
    'Botari Eva',
    'Customer Support Agent',
    'Your empathetic customer support specialist. Handles complaints, returns, FAQs, and ensures customer satisfaction.',
    99,
    'omnichannel',
    true,
    'professional',
    '#EC4899',
    '🎧',
    ARRAY[
        'Ticket management',
        'Order status tracking',
        'Refund processing',
        'Complaint resolution',
        'FAQ automation',
        'Customer satisfaction surveys',
        'Multi-channel support',
        'Knowledge base integration'
    ],
    NOW(),
    NOW()
),
(
    'zara',
    'Botari Zara',
    'Appointment Scheduler',
    'Your calendar management expert. Schedules appointments, sends reminders, and optimizes your daily schedule.',
    99,
    'calendar',
    true,
    'professional',
    '#8B5CF6',
    '📅',
    ARRAY[
        'Calendar integration',
        'Automated scheduling',
        'Reminder notifications',
        'Rescheduling management',
        'Buffer time optimization',
        'Multi-timezone support',
        'Group scheduling',
        'Waitlist management'
    ],
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    employee_role = EXCLUDED.employee_role,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    is_active = EXCLUDED.is_active,
    tier = EXCLUDED.tier,
    color_theme = EXCLUDED.color_theme,
    icon_emoji = EXCLUDED.icon_emoji,
    features = EXCLUDED.features,
    updated_at = NOW();

-- ============================================================================
-- PREMIUM TIER ($149/month)
-- ============================================================================

INSERT INTO ai_employees (
    name, 
    display_name, 
    employee_role, 
    description, 
    price_monthly, 
    assigned_channel, 
    is_active,
    tier,
    color_theme,
    icon_emoji,
    features,
    created_at,
    updated_at
) VALUES 
(
    'omar',
    'Botari Omar',
    'Voice/Call Agent',
    'Your professional voice agent. Handles phone calls via Vonage, manages voicemails, and schedules callbacks.',
    149,
    'voice',
    true,
    'premium',
    '#F59E0B',
    '📞',
    ARRAY[
        'Vonage voice integration',
        'Call handling & routing',
        'Voicemail transcription',
        'Callback scheduling',
        'Call recording & analytics',
        'IVR menu support',
        'Multi-language voice (EN/AR/FR)',
        'Call quality monitoring'
    ],
    NOW(),
    NOW()
),
(
    'leila',
    'Botari Leila',
    'Social Media Manager',
    'Your social media strategist. Manages Instagram, Facebook, Twitter, responds to comments, and analyzes engagement.',
    149,
    'social',
    true,
    'premium',
    '#E11D48',
    '📱',
    ARRAY[
        'Instagram management',
        'Facebook page management',
        'Twitter/X engagement',
        'Content calendar planning',
        'Comment response automation',
        'DM management',
        'Hashtag research',
        'Engagement analytics',
        'Influencer outreach'
    ],
    NOW(),
    NOW()
),
(
    'kofi',
    'Botari Kofi',
    'Content Writer',
    'Your content creation expert. Writes blog posts, product descriptions, and SEO-optimized website copy.',
    149,
    'content',
    true,
    'premium',
    '#059669',
    '✍️',
    ARRAY[
        'Blog post writing',
        'Product description creation',
        'SEO optimization',
        'Website copywriting',
        'Email newsletter writing',
        'Press release drafting',
        'Content calendar management',
        'Keyword research',
        'Competitor content analysis'
    ],
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    employee_role = EXCLUDED.employee_role,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    is_active = EXCLUDED.is_active,
    tier = EXCLUDED.tier,
    color_theme = EXCLUDED.color_theme,
    icon_emoji = EXCLUDED.icon_emoji,
    features = EXCLUDED.features,
    updated_at = NOW();

-- ============================================================================
-- ENTERPRISE TIER ($299/month)
-- ============================================================================

INSERT INTO ai_employees (
    name, 
    display_name, 
    employee_role, 
    description, 
    price_monthly, 
    assigned_channel, 
    is_active,
    tier,
    color_theme,
    icon_emoji,
    features,
    created_at,
    updated_at
) VALUES 
(
    'priya',
    'Botari Priya',
    'Legal Assistant',
    'Your legal support specialist. Drafts contracts, reviews documents, and ensures regulatory compliance.',
    299,
    'legal',
    true,
    'enterprise',
    '#4F46E5',
    '⚖️',
    ARRAY[
        'Contract drafting assistance',
        'Document review & analysis',
        'Compliance checking',
        'Legal template management',
        'NDA generation',
        'Terms of service review',
        'Privacy policy updates',
        'Regulatory monitoring',
        'Risk assessment support'
    ],
    NOW(),
    NOW()
),
(
    'marcus',
    'Botari Marcus',
    'Financial Analyst',
    'Your financial expert. Tracks expenses, generates reports, and provides revenue forecasting.',
    299,
    'finance',
    true,
    'enterprise',
    '#0F766E',
    '📊',
    ARRAY[
        'Expense tracking & categorization',
        'Financial reporting',
        'Revenue forecasting',
        'Budget variance analysis',
        'Cash flow monitoring',
        'Invoice management',
        'Financial dashboard creation',
        'KPI tracking',
        'Investor report generation'
    ],
    NOW(),
    NOW()
),
(
    'tunde',
    'Botari Tunde',
    'Operations Manager',
    'Your operations command center. Manages inventory, tracks shipments, and optimizes supply chain operations.',
    299,
    'operations',
    true,
    'enterprise',
    '#7C2D12',
    '📦',
    ARRAY[
        'Inventory management',
        'Shipment tracking',
        'Stock level optimization',
        'Reorder automation',
        'Supplier coordination',
        'Warehouse management',
        'Logistics optimization',
        'Demand forecasting',
        'Supply chain analytics'
    ],
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    employee_role = EXCLUDED.employee_role,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    is_active = EXCLUDED.is_active,
    tier = EXCLUDED.tier,
    color_theme = EXCLUDED.color_theme,
    icon_emoji = EXCLUDED.icon_emoji,
    features = EXCLUDED.features,
    updated_at = NOW();

-- ============================================================================
-- CREATE INDEX FOR EFFICIENT QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_employees_tier ON ai_employees(tier);
CREATE INDEX IF NOT EXISTS idx_ai_employees_price ON ai_employees(price_monthly);
CREATE INDEX IF NOT EXISTS idx_ai_employees_active ON ai_employees(is_active) WHERE is_active = true;

-- ============================================================================
-- CREATE VIEW FOR EMPLOYEE MARKETPLACE
-- ============================================================================

CREATE OR REPLACE VIEW employee_marketplace AS
SELECT 
    id,
    name,
    display_name,
    employee_role,
    description,
    price_monthly,
    assigned_channel,
    tier,
    color_theme,
    icon_emoji,
    features,
    is_active,
    CASE 
        WHEN tier = 'starter' THEN 1
        WHEN tier = 'professional' THEN 2
        WHEN tier = 'premium' THEN 3
        WHEN tier = 'enterprise' THEN 4
        ELSE 5
    END as tier_order
FROM ai_employees
WHERE is_active = true
ORDER BY tier_order ASC, price_monthly ASC;

-- ============================================================================
-- SUMMARY COMMENT
-- ============================================================================

COMMENT ON TABLE ai_employees IS 'AI Employee personas available for hire by businesses';

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
