-- ============================================================================
-- Botari AI - Complete Database Schema
-- PostgreSQL Schema for AI Employee Management Platform
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Businesses (main tenant table)
CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  industry VARCHAR(50),
  size VARCHAR(20) CHECK (size IN ('small', 'medium', 'large', 'enterprise')),
  subscription_tier VARCHAR(20) CHECK (subscription_tier IN ('starter', 'professional', 'premium', 'enterprise')),
  subscription_status VARCHAR(20) CHECK (subscription_status IN ('active', 'trial', 'expired', 'cancelled')),
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Employees (available personas/templates)
CREATE TABLE ai_employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL, -- internal name (amina, stan, etc)
  display_name VARCHAR(100) NOT NULL, -- "Botari Amina"
  employee_role VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2),
  assigned_channel VARCHAR(20) CHECK (assigned_channel IN ('whatsapp', 'email', 'voice', 'social', 'web')),
  features TEXT[], -- array of capability strings
  color_theme VARCHAR(7), -- hex color
  tier VARCHAR(20) CHECK (tier IN ('starter', 'professional', 'premium', 'enterprise')),
  icon_emoji VARCHAR(10),
  tools TEXT[], -- array of tool names
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Business Employees (hired AI staff instances)
CREATE TABLE business_employees (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  connection_status VARCHAR(20) CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'error')),
  whatsapp_number VARCHAR(20),
  config JSONB DEFAULT '{}', -- business-specific configuration
  hired_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  messages_processed INTEGER DEFAULT 0,
  last_active TIMESTAMP,
  UNIQUE(business_id, employee_id)
);

-- ============================================================================
-- MESSAGING TABLES
-- ============================================================================

-- Conversations (chat threads)
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending', 'archived')),
  channel VARCHAR(20) DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'web', 'email', 'sms', 'voice')),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  tags TEXT[],
  started_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  assigned_to INTEGER REFERENCES business_employees(id) ON DELETE SET NULL
);

-- Messages (individual messages in conversations)
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'video', 'document', 'location')),
  media_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}', -- for action data, tool calls, etc
  edited_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false
);

-- ============================================================================
-- CHANNEL TABLES
-- ============================================================================

-- Channels (multi-channel configuration per business)
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('whatsapp', 'email', 'voice', 'sms', 'webchat', 'facebook', 'instagram')),
  config JSONB DEFAULT '{}', -- channel-specific config
  assigned_employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- WhatsApp Sessions (WhatsApp connection state)
CREATE TABLE whatsapp_sessions (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  session_data JSONB DEFAULT '{}',
  connection_status VARCHAR(20) CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'qr_ready', 'error')),
  phone_number VARCHAR(20),
  qr_code TEXT,
  qr_generated_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- COMMERCE TABLES
-- ============================================================================

-- Products (inventory management)
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  cost DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  sku VARCHAR(50),
  category VARCHAR(100),
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointments (booking/scheduling)
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20),
  customer_name VARCHAR(100),
  customer_email VARCHAR(255),
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  service_name VARCHAR(100),
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders (sales transactions)
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  customer_phone VARCHAR(20),
  customer_name VARCHAR(100),
  items JSONB NOT NULL, -- array of {product_id, quantity, price, name}
  total_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  shipping_address JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT TABLES
-- ============================================================================

-- Payments (payment transactions)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  gateway_response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions (subscription billing)
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('starter', 'professional', 'premium', 'enterprise')),
  billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- AUDIT & LOGGING TABLES
-- ============================================================================

-- Action Logs (AI action auditing)
CREATE TABLE action_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  action_name VARCHAR(50) NOT NULL,
  action_type VARCHAR(30) CHECK (action_type IN ('tool_call', 'function_call', 'api_call', 'database_operation', 'external_integration')),
  parameters JSONB,
  result JSONB,
  success BOOLEAN,
  execution_time_ms INTEGER,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs (general activity tracking)
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50), -- 'conversation', 'order', 'appointment', etc.
  entity_id INTEGER,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Error Logs (system error tracking)
CREATE TABLE error_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  error_code VARCHAR(50),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  severity VARCHAR(10) DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS TABLES
-- ============================================================================

-- Daily Stats (aggregated daily metrics)
CREATE TABLE daily_stats (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER,
  UNIQUE(business_id, date)
);

-- Customer Analytics (per customer metrics)
CREATE TABLE customer_analytics (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20) NOT NULL,
  first_contact_at TIMESTAMP,
  last_contact_at TIMESTAMP,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  tags TEXT[],
  notes TEXT,
  UNIQUE(business_id, customer_phone)
);

-- ============================================================================
-- KNOWLEDGE BASE TABLES
-- ============================================================================

-- Knowledge Base (FAQ and documentation)
CREATE TABLE knowledge_base (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Custom Instructions (AI behavior customization)
CREATE TABLE custom_instructions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  instruction_type VARCHAR(50) CHECK (instruction_type IN ('greeting', 'tone', 'response_style', 'specialization', 'restrictions')),
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Business indexes
CREATE INDEX idx_businesses_email ON businesses(email);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_status);

-- Conversation indexes
CREATE INDEX idx_conversations_business ON conversations(business_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_phone);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_channel ON conversations(channel);

-- Message indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_role ON messages(role);

-- Business employees indexes
CREATE INDEX idx_business_employees_business ON business_employees(business_id);
CREATE INDEX idx_business_employees_employee ON business_employees(employee_id);
CREATE INDEX idx_business_employees_status ON business_employees(connection_status);

-- Payment indexes
CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);

-- Product indexes
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);

-- Order indexes
CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_customer ON orders(customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Appointment indexes
CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_appointments_customer ON appointments(customer_phone);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Log indexes
CREATE INDEX idx_action_logs_business ON action_logs(business_id);
CREATE INDEX idx_action_logs_conversation ON action_logs(conversation_id);
CREATE INDEX idx_action_logs_executed ON action_logs(executed_at DESC);
CREATE INDEX idx_activity_logs_business ON activity_logs(business_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_error_logs_business ON error_logs(business_id);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);

-- Analytics indexes
CREATE INDEX idx_daily_stats_business ON daily_stats(business_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
CREATE INDEX idx_customer_analytics_business ON customer_analytics(business_id);
CREATE INDEX idx_customer_analytics_phone ON customer_analytics(customer_phone);

-- Channel indexes
CREATE INDEX idx_channels_business ON channels(business_id);
CREATE INDEX idx_channels_type ON channels(channel_type);

-- Full text search indexes
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_conversations_customer_trgm ON conversations USING gin (customer_name gin_trgm_ops);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_employees_updated_at BEFORE UPDATE ON business_employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_instructions_updated_at BEFORE UPDATE ON custom_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update last_message_at on conversations
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_at = NEW.created_at 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_message_trigger 
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active conversations view
CREATE VIEW active_conversations AS
SELECT 
  c.*,
  b.name as business_name,
  ae.display_name as employee_name,
  (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
FROM conversations c
JOIN businesses b ON c.business_id = b.id
LEFT JOIN ai_employees ae ON c.employee_id = ae.id
WHERE c.status IN ('open', 'pending');

-- Business overview view
CREATE VIEW business_overview AS
SELECT 
  b.*,
  (SELECT COUNT(*) FROM business_employees be WHERE be.business_id = b.id AND be.is_active = true) as active_employees,
  (SELECT COUNT(*) FROM conversations c WHERE c.business_id = b.id AND c.status = 'open') as open_conversations,
  (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id AND o.status = 'pending') as pending_orders,
  (SELECT COUNT(*) FROM appointments a WHERE a.business_id = b.id AND a.status = 'scheduled' AND a.scheduled_at > NOW()) as upcoming_appointments
FROM businesses b;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE businesses IS 'Main tenant table for businesses using the platform';
COMMENT ON TABLE ai_employees IS 'Template definitions for AI employee personas';
COMMENT ON TABLE business_employees IS 'Instances of AI employees hired by businesses';
COMMENT ON TABLE conversations IS 'Chat conversations between customers and AI employees';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE products IS 'Product catalog for e-commerce functionality';
COMMENT ON TABLE orders IS 'Customer orders and transactions';
COMMENT ON TABLE appointments IS 'Scheduled appointments and bookings';
COMMENT ON TABLE payments IS 'Payment transaction records';
COMMENT ON TABLE action_logs IS 'Audit log for AI actions and tool calls';
