-- ============================================
-- SAFE MIGRATION: Add Missing Tables/Columns
-- For Existing Botari Database
-- ============================================
-- This migration adds what's needed for the NEW features
-- WITHOUT deleting your existing 7 AI employees
-- ============================================

-- ============================================
-- 1. UPDATE EXISTING AI_EMPLOYEES (add missing columns)
-- ============================================
ALTER TABLE ai_employees 
ADD COLUMN IF NOT EXISTS tools TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- ============================================
-- 2. UPDATE BUSINESS_EMPLOYEES (add missing columns)
-- ============================================
ALTER TABLE business_employees
ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES ai_employees(id);

-- ============================================
-- 3. CREATE MESSAGES TABLE (if not exists - for conversation history)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- 4. CREATE WHATSAPP_SESSIONS TABLE (for Baileys)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
  phone_number VARCHAR(20),
  credentials JSONB,
  qr_code TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_business ON whatsapp_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(status);

-- ============================================
-- 5. CREATE WHATSAPP_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
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
-- 6. CREATE WHATSAPP_SIGNAL_KEYS TABLE (for E2E encryption)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_signal_keys (
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
-- 7. CREATE PRODUCTS TABLE (for inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
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
-- 8. CREATE APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
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
-- 9. CREATE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. CREATE ACTION_LOGS TABLE (for AI actions)
-- ============================================
CREATE TABLE IF NOT EXISTS action_logs (
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
-- 11. CREATE PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
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
-- 12. ADD 3 NEW AI EMPLOYEES (Zara, Omar, Leila, Kofi, Priya, Marcus, Tunde)
-- Only if they don't exist (keeps your existing 7)
-- ============================================

-- Zara (Appointment Scheduler) - ₦5,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features)
VALUES (
  8,
  'Botari Zara',
  'Botari Zara',
  'Appointment Scheduler',
  'Calendar management specialist. Books appointments, sends reminders, reduces no-shows.',
  5900,
  'WhatsApp/Email',
  true,
  'professional',
  '#8B5CF6',
  '📅',
  '["Calendar management", "Appointment booking", "Reminder notifications", "Availability checking", "Rescheduling assistance"]'
)
ON CONFLICT (id) DO NOTHING;

-- Omar (Voice/Call Agent) - ₦8,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features)
VALUES (
  9,
  'Botari Omar',
  'Botari Omar',
  'Voice Call Agent',
  'Handles phone calls via AI voice. Natural conversations, appointment booking, customer service.',
  8900,
  'Voice/WhatsApp',
  true,
  'premium',
  '#F59E0B',
  '📞',
  '["Voice call handling", "Natural conversations", "Appointment booking", "Call transcription", "Multi-language support"]'
)
ON CONFLICT (id) DO NOTHING;

-- Kofi (Content Writer) - ₦7,900/month
INSERT INTO ai_employees (id, name, display_name, employee_role, description, price_monthly, assigned_channel, is_active, tier, color_theme, icon_emoji, features)
VALUES (
  10,
  'Botari Kofi',
  'Botari Kofi',
  'Content Writer',
  'Writes blog posts, product descriptions, website copy. SEO-optimized content.',
  7900,
  'Content',
  true,
  'premium',
  '#059669',
  '✍️',
  '["Blog post writing", "Product descriptions", "Website copy", "SEO optimization", "Content strategy"]'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 13. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);

-- ============================================
-- VERIFY MIGRATION
-- ============================================
SELECT '=== TABLES CREATED/UPDATED ===' as info;
SELECT table_name, 
       CASE WHEN table_name IN ('conversations', 'calls', 'leads', 'social_content', 'business_context', 'agent_configurations') 
            THEN 'EXISTING' 
            ELSE 'NEW' 
       END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT '=== AI EMPLOYEES ===' as info;
SELECT id, display_name, price_monthly, tier FROM ai_employees ORDER BY id;
