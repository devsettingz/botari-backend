-- ============================================================================
-- Migration 001: Initial Schema
-- Description: Creates all core tables for the Botari AI platform
-- ============================================================================

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Businesses (main tenant table)
CREATE TABLE IF NOT EXISTS businesses (
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
CREATE TABLE IF NOT EXISTS ai_employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  employee_role VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2),
  assigned_channel VARCHAR(20) CHECK (assigned_channel IN ('whatsapp', 'email', 'voice', 'social', 'web')),
  features TEXT[],
  color_theme VARCHAR(7),
  tier VARCHAR(20) CHECK (tier IN ('starter', 'professional', 'premium', 'enterprise')),
  icon_emoji VARCHAR(10),
  tools TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Business Employees (hired AI staff instances)
CREATE TABLE IF NOT EXISTS business_employees (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES ai_employees(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  connection_status VARCHAR(20) CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'error')),
  whatsapp_number VARCHAR(20),
  config JSONB DEFAULT '{}',
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
CREATE TABLE IF NOT EXISTS conversations (
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
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'video', 'document', 'location')),
  media_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  edited_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false
);

-- ============================================================================
-- CHANNEL TABLES
-- ============================================================================

-- Channels (multi-channel configuration per business)
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('whatsapp', 'email', 'voice', 'sms', 'webchat', 'facebook', 'instagram')),
  config JSONB DEFAULT '{}',
  assigned_employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- WhatsApp Sessions (WhatsApp connection state)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
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
CREATE TABLE IF NOT EXISTS products (
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
CREATE TABLE IF NOT EXISTS appointments (
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
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  customer_phone VARCHAR(20),
  customer_name VARCHAR(100),
  items JSONB NOT NULL,
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
CREATE TABLE IF NOT EXISTS payments (
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
CREATE TABLE IF NOT EXISTS subscriptions (
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
CREATE TABLE IF NOT EXISTS action_logs (
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
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Error Logs (system error tracking)
CREATE TABLE IF NOT EXISTS error_logs (
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
CREATE TABLE IF NOT EXISTS daily_stats (
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
CREATE TABLE IF NOT EXISTS customer_analytics (
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
CREATE TABLE IF NOT EXISTS knowledge_base (
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
CREATE TABLE IF NOT EXISTS custom_instructions (
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

COMMIT;
