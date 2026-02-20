-- ============================================
-- BOTARI AI - FRESH DATABASE SETUP
-- WARNING: This deletes ALL existing data!
-- ============================================

-- ============================================
-- 1. DROP ALL EXISTING TABLES (CASCADE)
-- ============================================
DROP TABLE IF EXISTS action_logs CASCADE;
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
DROP TABLE IF EXISTS whatsapp_signal_keys CASCADE;
DROP TABLE IF EXISTS whatsapp_sessions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS social_content CASCADE;
DROP TABLE IF EXISTS agent_configurations CASCADE;
DROP TABLE IF EXISTS business_context CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS business_employees CASCADE;
DROP TABLE IF EXISTS ai_employees CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- ============================================
-- 2. CREATE BUSINESSES TABLE
-- ============================================
CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  industry VARCHAR(50),
  size VARCHAR(20),
  subscription_tier VARCHAR(20),
  subscription_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. CREATE AI_EMPLOYEES TABLE
-- ============================================
CREATE TABLE ai_employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  employee_role VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 4900,
  assigned_channel VARCHAR(50) DEFAULT 'WhatsApp',
  features JSONB DEFAULT '[]'::jsonb,
  color_theme VARCHAR(50) DEFAULT '#E2725B',
  tier VARCHAR(50) DEFAULT 'starter',
  icon_emoji VARCHAR(10) DEFAULT '🤖',
  avatar_url TEXT,
  tools TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. CREATE BUSINESS_EMPLOYEES TABLE
-- ============================================
CREATE TABLE business_employees (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  connection_status VARCHAR(50) DEFAULT 'disconnected',
  whatsapp_number VARCHAR(50),
  config JSONB DEFAULT '{}',
  hired_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  messages_processed INTEGER DEFAULT 0,
  last_active TIMESTAMP,
  UNIQUE(business_id, employee_id)
);

-- ============================================
-- 5. CREATE CONVERSATIONS TABLE
-- ============================================
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id),
  customer_phone VARCHAR(50),
  customer_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'open',
  channel VARCHAR(20) DEFAULT 'whatsapp',
  started_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- 6. CREATE MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- 7. CREATE WHATSAPP_SESSIONS TABLE
-- ============================================
CREATE TABLE whatsapp_sessions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'disconnected',
  phone_number VARCHAR(20),
  credentials JSONB,
  qr_code TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. CREATE WHATSAPP_MESSAGES TABLE
-- ============================================
CREATE TABLE whatsapp_messages (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sender VARCHAR(50) NOT NULL,
  recipient VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  direction VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  whatsapp_message_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 9. CREATE WHATSAPP_SIGNAL_KEYS TABLE
-- ============================================
CREATE TABLE whatsapp_signal_keys (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  key_type VARCHAR(50) NOT NULL,
  key_id VARCHAR(255) NOT NULL,
  key_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. CREATE PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  sku VARCHAR(50),
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 11. CREATE APPOINTMENTS TABLE
-- ============================================
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20),
  customer_name VARCHAR(100),
  employee_id INTEGER REFERENCES ai_employees(id),
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status VARCHAR(20) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 12. CREATE ORDERS TABLE
-- ============================================
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 13. CREATE CALLS TABLE
-- ============================================
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id),
  customer_phone VARCHAR(20),
  direction VARCHAR(10),
  status VARCHAR(20) DEFAULT 'ringing',
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  recording_url VARCHAR(500),
  transcript TEXT,
  ai_summary TEXT,
  cost DECIMAL(10,4),
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- 14. CREATE ACTION_LOGS TABLE
-- ============================================
CREATE TABLE action_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id),
  action_name VARCHAR(50) NOT NULL,
  parameters JSONB,
  result JSONB,
  success BOOLEAN,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 15. CREATE PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  status VARCHAR(20),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 16. CREATE LEADS TABLE
-- ============================================
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  lead_data JSONB,
  source VARCHAR(100),
  lead_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 17. CREATE SOCIAL_CONTENT TABLE
-- ============================================
CREATE TABLE social_content (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  platform VARCHAR(50),
  content TEXT,
  topic VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 18. CREATE BUSINESS_CONTEXT TABLE
-- ============================================
CREATE TABLE business_context (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  use_case VARCHAR(50),
  industry VARCHAR(100),
  website_url VARCHAR(255),
  business_size VARCHAR(50),
  email_volume VARCHAR(50),
  social_posting_frequency VARCHAR(50),
  content_posting_frequency VARCHAR(50),
  pain_points TEXT[],
  goals TEXT[],
  brand_voice VARCHAR(50) DEFAULT 'professional',
  target_audience TEXT,
  analyzed_at TIMESTAMP,
  optimization_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_business_context UNIQUE (business_id)
);

-- ============================================
-- 19. CREATE AGENT_CONFIGURATIONS TABLE
-- ============================================
CREATE TABLE agent_configurations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  is_configured BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  configuration JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  system_prompt TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_agent_business_config UNIQUE (business_id, employee_id)
);

-- ============================================
-- 20. INSERT 10 AI EMPLOYEES
-- ============================================

-- 1. AMINA (Customer Support) - ₦2,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(1, 'Botari Amina', 'Botari Amina', 'Customer Support Specialist', 'AI-powered customer support for your business. Handles inquiries, complaints, and FAQs 24/7.', 2900, 'WhatsApp', true, 'starter', '#3B82F6', '💬', '["Responds to customer inquiries 24/7", "Handles complaints & refunds automatically", "Answers FAQs in English, Hausa, Yoruba, Igbo", "WhatsApp Business API integration", "Auto-escalation to human when needed"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Amina');

-- 2. EVA (Executive Assistant) - ₦5,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(2, 'Botari Eva', 'Botari Eva', 'Executive Assistant', 'Manages your inbox, sorts emails by priority, drafts replies in your voice, schedules meetings.', 5900, 'Email', true, 'professional', '#8B5CF6', '✉️', '["Email inbox management & sorting", "Priority detection (Urgent/Spam/Newsletters)", "Drafts replies in your brand voice/tone", "Calendar scheduling & meeting reminders", "Meeting notes summarization", "WhatsApp + Email unified inbox", "Daily email digest at 8am"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Eva');

-- 3. STAN (Sales Development) - ₦3,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(3, 'Botari Stan', 'Botari Stan', 'Sales Development Representative', 'Finds leads, sends cold emails, follows up automatically, books calls into your calendar.', 3900, 'Email/WhatsApp', true, 'starter', '#10B981', '📈', '["Lead generation from Instagram/Facebook", "Cold email outreach with follow-ups", "Automated lead qualification", "Call booking & calendar scheduling", "CRM integration & sync", "Daily lead reports & analytics", "Personalized outreach sequences"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Stan');

-- 4. RACHEL (Voice Receptionist) - ₦8,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(4, 'Botari Rachel', 'Botari Rachel', 'AI Receptionist', 'Answers phone calls 24/7 with natural voice, knows your business, books appointments.', 8900, 'Voice/WhatsApp', true, 'premium', '#F59E0B', '🎧', '["Answers phone calls 24/7", "Natural voice conversations", "Appointment booking & rescheduling", "Customer service handling", "Call transcription & summaries", "Multi-language support (English + Local)", "Voice + WhatsApp + Email integration", "Call recording & analytics"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Rachel');

-- 5. SONNY (Social Media) - ₦7,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(5, 'Botari Sonny', 'Botari Sonny', 'Social Media Manager', 'Creates and schedules posts for Instagram, Facebook, LinkedIn, X; generates carousels and hashtags.', 7900, 'Social', true, 'premium', '#EC4899', '📱', '["Creates Instagram/Facebook posts", "LinkedIn & X (Twitter) management", "Carousel & Reel scripts generation", "Hashtag research & optimization", "Content calendar auto-scheduling", "Engagement analytics & reporting", "Brand voice matching", "AI-generated images & captions"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Sonny');

-- 6. PENNY (Content/SEO) - ₦4,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(6, 'Botari Penny', 'Botari Penny', 'Content Writer & SEO Specialist', 'Writes blog posts optimized for Google rankings; creates newsletter content.', 4900, 'Content', true, 'professional', '#06B6D4', '📝', '["SEO-optimized blog posts", "Newsletter content writing", "Keyword research & clustering", "Google ranking optimization", "Content strategy planning", "Plagiarism-free guarantee", "Auto-publish to website", "Monthly SEO reports"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Penny');

-- 7. LINDA (Legal) - ₦12,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(7, 'Botari Linda', 'Botari Linda', 'Legal Assistant', 'Reviews contracts, flags risky clauses (like Clause 4B issues), NDPR compliance.', 12900, 'Legal', true, 'enterprise', '#DC2626', '⚖️', '["Contract review & risk analysis", "Risk clause identification & flagging", "Legal document drafting", "Compliance checking (GDPR/NDPR)", "NDA & agreement templates", "Legal research assistance", "Priority legal support", "Document version tracking"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Linda');

-- 8. ZARA (Appointment Scheduler) - ₦5,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(8, 'Botari Zara', 'Botari Zara', 'Appointment Scheduler', 'Calendar management specialist. Books appointments, sends reminders, reduces no-shows.', 5900, 'WhatsApp/Email', true, 'professional', '#8B5CF6', '📅', '["Calendar management", "Appointment booking", "Reminder notifications", "Availability checking", "Rescheduling assistance"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Zara');

-- 9. OMAR (Voice/Call Agent) - ₦8,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(9, 'Botari Omar', 'Botari Omar', 'Voice Call Agent', 'Handles phone calls via AI voice. Natural conversations, appointment booking, customer service.', 8900, 'Voice/WhatsApp', true, 'premium', '#F59E0B', '📞', '["Voice call handling", "Natural conversations", "Appointment booking", "Call transcription", "Multi-language support"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Omar');

-- 10. KOBI (Content Writer) - ₦7,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features, avatar_url) VALUES
(10, 'Botari Kofi', 'Botari Kofi', 'Content Writer', 'Writes blog posts, product descriptions, website copy. SEO-optimized content.', 7900, 'Content', true, 'premium', '#059669', '✍️', '["Blog post writing", "Product descriptions", "Website copy", "SEO optimization", "Content strategy"]', 'https://api.dicebear.com/7.x/bottts/svg?seed=Kofi');

-- ============================================
-- 21. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_whatsapp_sessions_business ON whatsapp_sessions(business_id);
CREATE INDEX idx_whatsapp_messages_business ON whatsapp_messages(business_id);
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_calls_business ON calls(business_id);
CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_conversations_business ON conversations(business_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_phone);
CREATE INDEX idx_business_employees_business ON business_employees(business_id);

-- ============================================
-- VERIFY SETUP
-- ============================================
SELECT '=== DATABASE SETUP COMPLETE ===' as status;
SELECT COUNT(*) as total_employees FROM ai_employees;
SELECT id, display_name, price_monthly, tier FROM ai_employees ORDER BY id;
