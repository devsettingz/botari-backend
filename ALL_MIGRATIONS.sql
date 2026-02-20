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
CREATE TABLE business_employees (
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
  metadata JSONB DEFAULT '{}',
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
  config JSONB DEFAULT '{}',
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
  entity_type VARCHAR(50),
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

COMMIT;
-- ============================================================================
-- Migration 002: Add Performance Indexes
-- Description: Creates indexes for improved query performance
-- ============================================================================

BEGIN;

-- ============================================================================
-- BUSINESS INDEXES
-- ============================================================================

CREATE INDEX idx_businesses_email ON businesses(email);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_status);
CREATE INDEX idx_businesses_created_at ON businesses(created_at DESC);

-- ============================================================================
-- AI EMPLOYEES INDEXES
-- ============================================================================

CREATE INDEX idx_ai_employees_tier ON ai_employees(tier);
CREATE INDEX idx_ai_employees_channel ON ai_employees(assigned_channel);
CREATE INDEX idx_ai_employees_active ON ai_employees(is_active);

-- ============================================================================
-- BUSINESS EMPLOYEES INDEXES
-- ============================================================================

CREATE INDEX idx_business_employees_business ON business_employees(business_id);
CREATE INDEX idx_business_employees_employee ON business_employees(employee_id);
CREATE INDEX idx_business_employees_status ON business_employees(connection_status);
CREATE INDEX idx_business_employees_active ON business_employees(business_id, is_active);

-- ============================================================================
-- CONVERSATION INDEXES
-- ============================================================================

CREATE INDEX idx_conversations_business ON conversations(business_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_phone);
CREATE INDEX idx_conversations_employee ON conversations(employee_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_priority ON conversations(priority);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_business_status ON conversations(business_id, status);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);

-- ============================================================================
-- MESSAGE INDEXES
-- ============================================================================

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- ============================================================================
-- CHANNEL INDEXES
-- ============================================================================

CREATE INDEX idx_channels_business ON channels(business_id);
CREATE INDEX idx_channels_type ON channels(channel_type);
CREATE INDEX idx_channels_active ON channels(is_active);

-- ============================================================================
-- PRODUCT INDEXES
-- ============================================================================

CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(business_id, is_active);
CREATE INDEX idx_products_price ON products(price);

-- ============================================================================
-- ORDER INDEXES
-- ============================================================================

CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_customer ON orders(customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_business_status ON orders(business_id, status);
CREATE INDEX idx_orders_conversation ON orders(conversation_id);

-- ============================================================================
-- APPOINTMENT INDEXES
-- ============================================================================

CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_appointments_customer ON appointments(customer_phone);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_employee ON appointments(employee_id);
CREATE INDEX idx_appointments_business_scheduled ON appointments(business_id, scheduled_at);

-- ============================================================================
-- PAYMENT INDEXES
-- ============================================================================

CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_payments_employee ON payments(employee_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);

-- ============================================================================
-- SUBSCRIPTION INDEXES
-- ============================================================================

CREATE INDEX idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================================================
-- LOG INDEXES
-- ============================================================================

CREATE INDEX idx_action_logs_business ON action_logs(business_id);
CREATE INDEX idx_action_logs_conversation ON action_logs(conversation_id);
CREATE INDEX idx_action_logs_employee ON action_logs(employee_id);
CREATE INDEX idx_action_logs_executed ON action_logs(executed_at DESC);
CREATE INDEX idx_action_logs_action ON action_logs(action_name);
CREATE INDEX idx_action_logs_success ON action_logs(success);

CREATE INDEX idx_activity_logs_business ON activity_logs(business_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

CREATE INDEX idx_error_logs_business ON error_logs(business_id);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_code ON error_logs(error_code);

-- ============================================================================
-- ANALYTICS INDEXES
-- ============================================================================

CREATE INDEX idx_daily_stats_business ON daily_stats(business_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
CREATE INDEX idx_daily_stats_business_date ON daily_stats(business_id, date);

CREATE INDEX idx_customer_analytics_business ON customer_analytics(business_id);
CREATE INDEX idx_customer_analytics_phone ON customer_analytics(customer_phone);
CREATE INDEX idx_customer_analytics_last_contact ON customer_analytics(last_contact_at DESC);

-- ============================================================================
-- KNOWLEDGE BASE INDEXES
-- ============================================================================

CREATE INDEX idx_knowledge_base_business ON knowledge_base(business_id);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_active ON knowledge_base(business_id, is_active);
CREATE INDEX idx_knowledge_base_employee ON knowledge_base(employee_id);

CREATE INDEX idx_custom_instructions_business ON custom_instructions(business_id);
CREATE INDEX idx_custom_instructions_employee ON custom_instructions(employee_id);
CREATE INDEX idx_custom_instructions_type ON custom_instructions(instruction_type);

-- ============================================================================
-- WHATSAPP SESSIONS INDEXES
-- ============================================================================

CREATE INDEX idx_whatsapp_sessions_status ON whatsapp_sessions(connection_status);
CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);

COMMIT;
-- ============================================================================
-- Migration 003: Seed Data
-- Description: Inserts initial data for AI employees and demo business
-- ============================================================================

BEGIN;

-- ============================================================================
-- AI EMPLOYEES - Core Team
-- ============================================================================

INSERT INTO ai_employees (name, display_name, employee_role, description, price_monthly, assigned_channel, features, color_theme, tier, icon_emoji, tools, is_active) VALUES
-- Amina - The versatile receptionist
(
  'amina',
  'Botari Amina',
  'AI Receptionist & Customer Support',
  'Warm, welcoming, and always ready to help. Amina handles customer inquiries, appointment scheduling, and general support with a friendly touch.',
  49.00,
  'whatsapp',
  ARRAY['customer_support', 'appointment_scheduling', 'faq_handling', 'multilingual', 'lead_capture'],
  '#10B981',
  'starter',
  '👋',
  ARRAY['calendar', 'contacts', 'knowledge_base', 'appointments'],
  true
),
-- Stan - The sales expert
(
  'stan',
  'Botari Stan',
  'AI Sales Assistant',
  'Persuasive and product-savvy, Stan helps convert conversations into sales. He knows your inventory inside out and never misses a cross-sell opportunity.',
  79.00,
  'whatsapp',
  ARRAY['sales', 'product_recommendations', 'order_processing', 'upselling', 'inventory_management'],
  '#3B82F6',
  'professional',
  '🛍️',
  ARRAY['products', 'orders', 'payments', 'inventory', 'recommendations'],
  true
),
-- Lira - The appointment specialist
(
  'lira',
  'Botari Lira',
  'AI Appointment Manager',
  'Organized and efficient, Lira specializes in booking management. She handles complex scheduling, reminders, and rescheduling with ease.',
  59.00,
  'whatsapp',
  ARRAY['appointment_scheduling', 'reminders', 'calendar_management', 'availability_checking', 'waitlist_management'],
  '#8B5CF6',
  'professional',
  '📅',
  ARRAY['calendar', 'appointments', 'reminders', 'availability'],
  true
),
-- Echo - The voice specialist
(
  'echo',
  'Botari Echo',
  'AI Voice Assistant',
  'Natural and conversational, Echo handles voice calls with human-like warmth. Perfect for businesses that want to offer phone support without the wait.',
  99.00,
  'voice',
  ARRAY['voice_calls', 'natural_conversation', 'call_routing', 'voicemail', 'call_transcription'],
  '#F59E0B',
  'premium',
  '📞',
  ARRAY['voice', 'transcription', 'call_history', 'routing'],
  true
),
-- Nova - The social media expert
(
  'nova',
  'Botari Nova',
  'AI Social Media Manager',
  'Trendy and engaging, Nova manages your social media presence across platforms. She responds to comments, DMs, and keeps your brand voice consistent.',
  89.00,
  'social',
  ARRAY['social_media', 'dm_management', 'comment_response', 'content_suggestions', 'brand_voice'],
  '#EC4899',
  'premium',
  '📱',
  ARRAY['social_media', 'content', 'analytics', 'engagement'],
  true
),
-- Atlas - The enterprise specialist
(
  'atlas',
  'Botari Atlas',
  'AI Enterprise Assistant',
  'Powerful and customizable, Atlas is built for scale. Advanced integrations, custom workflows, and enterprise-grade security for demanding businesses.',
  299.00,
  'whatsapp',
  ARRAY['enterprise_integration', 'custom_workflows', 'advanced_analytics', 'api_access', 'priority_support', 'sso', 'audit_logs'],
  '#6366F1',
  'enterprise',
  '🏢',
  ARRAY['enterprise_api', 'workflows', 'analytics', 'integrations', 'security'],
  true
),
-- Iris - The email specialist
(
  'iris',
  'Botari Iris',
  'AI Email Manager',
  'Professional and articulate, Iris handles email correspondence with perfect tone. From support tickets to sales inquiries, she crafts the perfect response.',
  69.00,
  'email',
  ARRAY['email_management', 'ticket_handling', 'professional_writing', 'template_management', 'follow_ups'],
  '#14B8A6',
  'professional',
  '✉️',
  ARRAY['email', 'templates', 'tickets', 'followups'],
  true
);

-- ============================================================================
-- DEMO BUSINESS (for development/testing)
-- ============================================================================

-- Insert demo business with password: 'demo123' (hashed with bcrypt)
INSERT INTO businesses (name, email, password_hash, phone, address, industry, size, subscription_tier, subscription_status, trial_ends_at) VALUES
(
  'Demo Coffee Shop',
  'demo@botari.ai',
  '$2b$10$rK7t.NeGyXNqQFNP6GQd5eR8K1X8P9mQXKQFhXrYFqPaKOM0f2mYy', -- demo123
  '+1234567890',
  '123 Demo Street, Demo City',
  'food_beverage',
  'small',
  'professional',
  'trial',
  NOW() + INTERVAL '14 days'
);

-- ============================================================================
-- DEMO BUSINESS EMPLOYEES
-- ============================================================================

INSERT INTO business_employees (business_id, employee_id, is_active, connection_status, whatsapp_number, config) VALUES
(1, 1, true, 'connected', '+1234567890', '{"greeting": "Welcome to Demo Coffee Shop! ☕", "auto_reply": true}'),
(1, 2, true, 'connected', '+1234567891', '{"sales_mode": "active", "discount_codes": ["DEMO10", "WELCOME20"]}'),
(1, 3, true, 'disconnected', NULL, '{}');

-- ============================================================================
-- DEMO PRODUCTS (for Demo Coffee Shop)
-- ============================================================================

INSERT INTO products (business_id, name, description, price, cost, stock_quantity, sku, category, tags, is_active) VALUES
(1, 'Signature Espresso', 'Rich, bold espresso with caramel notes', 3.50, 1.20, 100, 'ESP-001', 'Beverages', ARRAY['hot', 'coffee', 'signature'], true),
(1, 'Vanilla Latte', 'Smooth espresso with vanilla syrup and steamed milk', 4.50, 1.80, 80, 'LAT-001', 'Beverages', ARRAY['hot', 'coffee', 'popular'], true),
(1, 'Iced Cold Brew', 'Slow-steeped cold brew coffee, smooth and refreshing', 4.00, 1.00, 60, 'CBR-001', 'Beverages', ARRAY['cold', 'coffee', 'summer'], true),
(1, 'Croissant', 'Buttery, flaky French pastry', 2.50, 0.80, 40, 'PAS-001', 'Pastries', ARRAY['bakery', 'breakfast'], true),
(1, 'Blueberry Muffin', 'Fresh-baked muffin with real blueberries', 3.00, 1.00, 35, 'PAS-002', 'Pastries', ARRAY['bakery', 'breakfast', 'vegetarian'], true),
(1, 'Avocado Toast', 'Sourdough toast with smashed avocado and chili flakes', 8.00, 3.00, 20, 'FOOD-001', 'Food', ARRAY['breakfast', 'lunch', 'vegetarian', 'healthy'], true);

-- ============================================================================
-- KNOWLEDGE BASE - Sample Entries
-- ============================================================================

INSERT INTO knowledge_base (business_id, employee_id, title, content, category, tags, is_active) VALUES
(1, 1, 'Store Hours', 'We are open Monday-Friday 7am-7pm, Saturday-Sunday 8am-6pm. Holiday hours may vary.', 'General', ARRAY['hours', 'location'], true),
(1, 1, 'WiFi Password', 'Our guest WiFi password is: CoffeeTime2024', 'General', ARRAY['wifi', 'amenities'], true),
(1, 1, 'Dietary Options', 'We offer dairy-free milk alternatives (oat, almond, soy), gluten-free pastries, and vegan options. Please ask our staff for details!', 'Menu', ARRAY['dietary', 'allergies', 'vegan', 'gluten-free'], true),
(1, 2, 'Loyalty Program', 'Earn 1 point for every $1 spent. 50 points = $5 reward. Ask to join our loyalty program!', 'Promotions', ARRAY['loyalty', 'rewards', 'savings'], true),
(1, 2, 'Catering Services', 'We offer catering for events of 10-100 people. Includes coffee, pastries, and sandwich platters. 48-hour advance notice required.', 'Services', ARRAY['catering', 'events', 'bulk'], true);

-- ============================================================================
-- CUSTOM INSTRUCTIONS
-- ============================================================================

INSERT INTO custom_instructions (business_id, employee_id, instruction_type, content, priority, is_active) VALUES
(1, 1, 'greeting', 'Always greet customers warmly and mention our daily specials if available.', 1, true),
(1, 1, 'tone', 'Be friendly, casual, and use coffee-related emojis when appropriate.', 2, true),
(1, 2, 'response_style', 'When discussing products, emphasize quality and craftsmanship. Mention our single-origin beans.', 1, true),
(1, 2, 'specialization', 'You are an expert in coffee and can answer questions about brewing methods, bean origins, and flavor profiles.', 3, true);

-- ============================================================================
-- DEMO CONVERSATIONS & MESSAGES
-- ============================================================================

-- Sample conversation
INSERT INTO conversations (business_id, employee_id, customer_phone, customer_name, status, channel, priority, started_at, last_message_at) VALUES
(1, 1, '+15551234567', 'John Smith', 'open', 'whatsapp', 'normal', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '15 minutes');

-- Sample messages
INSERT INTO messages (conversation_id, role, content, content_type, created_at) VALUES
(1, 'user', 'Hi! What are your hours today?', 'text', NOW() - INTERVAL '2 hours'),
(1, 'assistant', 'Hello John! 👋 We''re open today from 7am to 7pm. Perfect timing for your afternoon coffee! ☕ Would you like to know about our daily special?', 'text', NOW() - INTERVAL '1 hour 55 minutes'),
(1, 'user', 'Great! Do you have oat milk?', 'text', NOW() - INTERVAL '1 hour'),
(1, 'assistant', 'Yes, we do! We offer oat, almond, and soy milk alternatives at no extra charge. 🥛 Our oat milk pairs especially well with our Vanilla Latte. Would you like to place an order for pickup?', 'text', NOW() - INTERVAL '15 minutes');

-- ============================================================================
-- DEMO APPOINTMENT
-- ============================================================================

INSERT INTO appointments (business_id, customer_phone, customer_name, customer_email, employee_id, scheduled_at, duration_minutes, status, service_name, notes) VALUES
(1, '+15559876543', 'Sarah Johnson', 'sarah@email.com', 3, NOW() + INTERVAL '2 days', 30, 'confirmed', 'Private Event Booking', 'Birthday celebration for 8 people');

-- ============================================================================
-- DEMO ORDER
-- ============================================================================

INSERT INTO orders (business_id, conversation_id, customer_phone, customer_name, items, total_amount, tax_amount, currency, status, payment_status, notes) VALUES
(1, 1, '+15551234567', 'John Smith', 
 '[{"product_id": 2, "name": "Vanilla Latte", "quantity": 1, "price": 4.50}, {"product_id": 4, "name": "Croissant", "quantity": 2, "price": 2.50}]'::jsonb,
 9.50, 0.79, 'USD', 'confirmed', 'paid', 'Customer will pick up at 3pm');

-- ============================================================================
-- UPDATE ANALYTICS
-- ============================================================================

INSERT INTO daily_stats (business_id, date, total_conversations, total_messages, total_orders, total_revenue, new_customers) VALUES
(1, CURRENT_DATE, 5, 20, 3, 45.50, 2);

INSERT INTO customer_analytics (business_id, customer_phone, first_contact_at, last_contact_at, total_conversations, total_messages, total_orders, total_spent) VALUES
(1, '+15551234567', NOW() - INTERVAL '7 days', NOW() - INTERVAL '15 minutes', 3, 12, 2, 28.50),
(1, '+15559876543', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 1, 3, 0, 0);

COMMIT;
-- ============================================================================
-- WhatsApp Signal Keys Table
-- ============================================================================
-- This migration adds a table for storing Baileys signal protocol keys.
-- These keys are used for end-to-end encryption in WhatsApp.
-- ============================================================================

-- Drop if exists (for clean migration)
DROP TABLE IF EXISTS whatsapp_signal_keys CASCADE;

-- ============================================================================
-- SIGNAL KEYS TABLE
-- ============================================================================
-- Stores encryption keys for WhatsApp E2E encryption
-- ============================================================================
CREATE TABLE whatsapp_signal_keys (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES ai_employees(id) ON DELETE CASCADE,
    
    -- Key type (app-state-sync-key, app-state-sync-version, sender-key, etc.)
    key_type VARCHAR(50) NOT NULL,
    
    -- Key identifier
    key_id VARCHAR(255) NOT NULL,
    
    -- Key data (encrypted JSON)
    key_data JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique key per business-employee-type-id combination
    CONSTRAINT unique_signal_key UNIQUE (business_id, employee_id, key_type, key_id)
);

-- Indexes for faster lookups
CREATE INDEX idx_signal_keys_business ON whatsapp_signal_keys(business_id);
CREATE INDEX idx_signal_keys_employee ON whatsapp_signal_keys(employee_id);
CREATE INDEX idx_signal_keys_type ON whatsapp_signal_keys(key_type);
CREATE INDEX idx_signal_keys_lookup ON whatsapp_signal_keys(business_id, employee_id, key_type);

-- Trigger for updated_at
CREATE TRIGGER update_signal_keys_updated_at
    BEFORE UPDATE ON whatsapp_signal_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE whatsapp_signal_keys IS 'Stores Baileys signal protocol encryption keys for WhatsApp E2E encryption';
COMMENT ON COLUMN whatsapp_signal_keys.key_type IS 'Type of signal key (e.g., app-state-sync-key, sender-key)';
COMMENT ON COLUMN whatsapp_signal_keys.key_data IS 'Encrypted key data in JSON format';

-- ============================================================================
-- GRANTS (if needed)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_signal_keys TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE whatsapp_signal_keys_id_seq TO app_user;
-- ============================================================================
-- Analytics Views Migration
-- Botari AI - Analytics System
-- ============================================================================
-- This migration creates database views for efficient analytics queries.
-- Run this after the analytics service is deployed.
-- ============================================================================

-- ============================================================================
-- DROP EXISTING VIEWS (for clean migration)
-- ============================================================================

DROP VIEW IF EXISTS business_daily_stats CASCADE;
DROP VIEW IF EXISTS employee_performance CASCADE;
DROP VIEW IF EXISTS revenue_metrics CASCADE;
DROP VIEW IF EXISTS conversation_hourly_stats CASCADE;
DROP VIEW IF EXISTS product_inquiry_stats CASCADE;
DROP VIEW IF EXISTS customer_activity_stats CASCADE;

-- ============================================================================
-- VIEW: Business Daily Stats
-- ============================================================================
-- Aggregates daily conversation and message statistics per business
-- ============================================================================

CREATE OR REPLACE VIEW business_daily_stats AS
SELECT 
    c.business_id,
    b.business_name,
    DATE(c.started_at) as date,
    COUNT(*) as conversation_count,
    SUM(c.message_count) as total_messages,
    AVG(c.message_count) as avg_messages_per_conversation,
    COUNT(*) FILTER (WHERE c.status = 'closed') as closed_conversations,
    COUNT(*) FILTER (WHERE c.escalation_reason IS NOT NULL) as escalated_conversations,
    AVG(EXTRACT(EPOCH FROM (c.closed_at - c.started_at))) FILTER (WHERE c.status = 'closed') as avg_conversation_duration
FROM conversations c
JOIN businesses b ON c.business_id = b.id
GROUP BY c.business_id, b.business_name, DATE(c.started_at);

-- ============================================================================
-- VIEW: Employee Performance
-- ============================================================================
-- Aggregates employee performance metrics including conversations, messages,
-- actions, and customer satisfaction
-- ============================================================================

CREATE OR REPLACE VIEW employee_performance AS
SELECT 
    be.employee_id,
    ae.display_name,
    ae.employee_role,
    ae.name as employee_name,
    be.business_id,
    b.business_name,
    COUNT(DISTINCT c.id) as conversations_handled,
    COUNT(m.id) as messages_sent,
    COUNT(al.id) as actions_executed,
    COUNT(al.id) FILTER (WHERE al.success = true) as successful_actions,
    AVG(EXTRACT(EPOCH FROM (c.closed_at - c.started_at))) FILTER (WHERE c.status = 'closed') as avg_handling_time,
    COUNT(c.id) FILTER (WHERE c.escalation_reason IS NOT NULL)::float / 
        NULLIF(COUNT(c.id), 0) * 100 as escalation_rate,
    MAX(c.last_message_at) as last_active,
    COALESCE(AVG(f.rating), 4.5) as avg_satisfaction
FROM business_employees be
JOIN ai_employees ae ON be.employee_id = ae.id
JOIN businesses b ON be.business_id = b.id
LEFT JOIN conversations c ON c.employee_id = ae.id AND c.business_id = be.business_id
LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'assistant'
LEFT JOIN action_logs al ON al.business_id = be.business_id 
    AND al.executed_by = LOWER(ae.name)
LEFT JOIN feedback f ON f.conversation_id = c.id
WHERE be.is_active = true AND ae.is_active = true
GROUP BY be.employee_id, ae.display_name, ae.employee_role, ae.name, be.business_id, b.business_name;

-- ============================================================================
-- VIEW: Revenue Metrics
-- ============================================================================
-- Aggregates revenue data by month and plan
-- ============================================================================

CREATE OR REPLACE VIEW revenue_metrics AS
SELECT 
    DATE_TRUNC('month', p.created_at) as month,
    COUNT(*) as total_payments,
    SUM(p.amount) as total_revenue,
    COUNT(DISTINCT p.business_id) as paying_businesses,
    AVG(p.amount) as avg_payment_amount,
    COUNT(*) FILTER (WHERE p.status = 'completed') as successful_payments,
    COUNT(*) FILTER (WHERE p.status = 'failed') as failed_payments,
    s.plan as subscription_plan
FROM payments p
LEFT JOIN subscriptions s ON p.business_id = s.business_id 
    AND s.status = 'active'
WHERE p.status = 'completed'
GROUP BY DATE_TRUNC('month', p.created_at), s.plan;

-- ============================================================================
-- VIEW: Conversation Hourly Stats
-- ============================================================================
-- Analyzes conversation patterns by hour of day
-- ============================================================================

CREATE OR REPLACE VIEW conversation_hourly_stats AS
SELECT 
    business_id,
    EXTRACT(HOUR FROM started_at) as hour_of_day,
    EXTRACT(DOW FROM started_at) as day_of_week,
    COUNT(*) as conversation_count,
    AVG(message_count) as avg_messages,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
    COUNT(*) FILTER (WHERE escalation_reason IS NOT NULL) as escalated_count
FROM conversations
WHERE started_at >= NOW() - INTERVAL '90 days'
GROUP BY business_id, EXTRACT(HOUR FROM started_at), EXTRACT(DOW FROM started_at);

-- ============================================================================
-- VIEW: Product Inquiry Stats
-- ============================================================================
-- Tracks product inquiries and conversion to orders
-- ============================================================================

CREATE OR REPLACE VIEW product_inquiry_stats AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.business_id,
    b.business_name,
    COUNT(al.id) as total_inquiries,
    COUNT(al.id) FILTER (WHERE al.executed_at >= NOW() - INTERVAL '7 days') as inquiries_last_7_days,
    COUNT(al.id) FILTER (WHERE al.executed_at >= NOW() - INTERVAL '30 days') as inquiries_last_30_days,
    COUNT(DISTINCT o.id) as orders_count,
    COALESCE(SUM(o.total_amount), 0) as revenue_generated
FROM products p
JOIN businesses b ON p.business_id = b.id
LEFT JOIN action_logs al ON al.params->>'product_id' = p.id::text 
    AND al.action_name = 'check_inventory'
LEFT JOIN orders o ON o.items @> jsonb_build_array(jsonb_build_object('product_id', p.id))
    AND o.status NOT IN ('cancelled', 'refunded')
WHERE p.is_active = true
GROUP BY p.id, p.name, p.business_id, b.business_name;

-- ============================================================================
-- VIEW: Customer Activity Stats
-- ============================================================================
-- Tracks customer engagement and activity metrics
-- ============================================================================

CREATE OR REPLACE VIEW customer_activity_stats AS
SELECT 
    c.business_id,
    b.business_name,
    c.phone as customer_phone,
    c.name as customer_name,
    COUNT(DISTINCT conv.id) as total_conversations,
    COUNT(m.id) as total_messages,
    MAX(conv.started_at) as last_conversation_date,
    MIN(conv.started_at) as first_conversation_date,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    MAX(o.created_at) as last_order_date,
    c.tags as customer_tags
FROM customers c
JOIN businesses b ON c.business_id = b.id
LEFT JOIN conversations conv ON conv.customer_phone = c.phone AND conv.business_id = c.business_id
LEFT JOIN messages m ON m.conversation_id = conv.id
LEFT JOIN orders o ON o.customer_phone = c.phone AND o.business_id = c.business_id
GROUP BY c.business_id, b.business_name, c.phone, c.name, c.tags;

-- ============================================================================
-- VIEW: Platform Overview
-- ============================================================================
-- High-level platform metrics for admin dashboard
-- ============================================================================

CREATE OR REPLACE VIEW platform_overview AS
SELECT 
    (SELECT COUNT(*) FROM businesses) as total_businesses,
    (SELECT COUNT(*) FROM businesses WHERE is_active = true) as active_businesses,
    (SELECT COUNT(*) FROM ai_employees WHERE is_active = true) as total_employees,
    (SELECT COUNT(DISTINCT employee_id) FROM business_employees WHERE is_active = true) as hired_employees,
    (SELECT COUNT(*) FROM conversations WHERE started_at >= NOW() - INTERVAL '30 days') as conversations_last_30_days,
    (SELECT COUNT(*) FROM messages WHERE created_at >= NOW() - INTERVAL '30 days') as messages_last_30_days,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' AND created_at >= DATE_TRUNC('month', NOW())) as mrr,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= NOW() - INTERVAL '30 days') as revenue_last_30_days,
    (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
    (SELECT COUNT(*) FROM escalations WHERE status IN ('pending', 'in_progress')) as open_escalations;

-- ============================================================================
-- INDEXES FOR ANALYTICS QUERIES
-- ============================================================================

-- Index for date-based conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_business_date ON conversations(business_id, started_at DESC);

-- Index for message analytics
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role ON messages(conversation_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Index for action log analytics
CREATE INDEX IF NOT EXISTS idx_action_logs_business_executed ON action_logs(business_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action_executed ON action_logs(action_name, executed_at DESC);

-- Index for payment analytics
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_business_created ON payments(business_id, created_at DESC);

-- Index for order analytics
CREATE INDEX IF NOT EXISTS idx_orders_business_created ON orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW business_daily_stats IS 'Daily aggregated statistics per business for trend analysis';
COMMENT ON VIEW employee_performance IS 'Employee performance metrics across all businesses';
COMMENT ON VIEW revenue_metrics IS 'Monthly revenue breakdown by plan';
COMMENT ON VIEW conversation_hourly_stats IS 'Conversation patterns by hour and day of week';
COMMENT ON VIEW product_inquiry_stats IS 'Product inquiry tracking and conversion metrics';
COMMENT ON VIEW customer_activity_stats IS 'Customer engagement and purchase history';
COMMENT ON VIEW platform_overview IS 'High-level platform health metrics';

-- ============================================================================
-- GRANTS (adjust according to your security requirements)
-- ============================================================================
-- GRANT SELECT ON business_daily_stats TO app_user;
-- GRANT SELECT ON employee_performance TO app_user;
-- GRANT SELECT ON revenue_metrics TO app_user;
-- GRANT SELECT ON conversation_hourly_stats TO app_user;
-- GRANT SELECT ON product_inquiry_stats TO app_user;
-- GRANT SELECT ON customer_activity_stats TO app_user;
-- GRANT SELECT ON platform_overview TO app_user;
-- ============================================================================
-- Voice Calls System - Database Schema
-- Botari AI - Vonage Voice Integration
-- ============================================================================
-- This migration creates the calls table for voice call tracking
-- ============================================================================

-- ============================================================================
-- CALLS TABLE
-- ============================================================================
-- Stores all voice call records for businesses
-- ============================================================================
DROP TABLE IF EXISTS calls CASCADE;

CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
    
    -- Call participants
    customer_phone VARCHAR(20) NOT NULL,
    direction VARCHAR(10), -- 'inbound', 'outbound'
    
    -- Call status
    status VARCHAR(20), -- 'ringing', 'in_progress', 'completed', 'failed', 'cancelled'
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Call content
    recording_url VARCHAR(500),
    transcript TEXT,
    ai_summary TEXT,
    
    -- Cost tracking
    cost DECIMAL(10,4),
    
    -- Vonage specific
    vonage_call_uuid VARCHAR(100),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_calls_business ON calls(business_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_direction ON calls(direction);
CREATE INDEX idx_calls_started_at ON calls(started_at);
CREATE INDEX idx_calls_customer_phone ON calls(customer_phone);
CREATE INDEX idx_calls_employee ON calls(employee_id);
CREATE INDEX idx_calls_vonage_uuid ON calls(vonage_call_uuid);

-- Composite indexes for common queries
CREATE INDEX idx_calls_business_status ON calls(business_id, status);
CREATE INDEX idx_calls_business_started ON calls(business_id, started_at DESC);
CREATE INDEX idx_calls_business_direction ON calls(business_id, direction);

-- Index for JSONB metadata queries
CREATE INDEX idx_calls_metadata ON calls USING gin(metadata);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================
DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;

CREATE TRIGGER update_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- View: Active calls (ringing or in_progress)
CREATE OR REPLACE VIEW active_calls AS
SELECT 
    c.*,
    b.business_name,
    ae.display_name as employee_name
FROM calls c
JOIN businesses b ON c.business_id = b.id
LEFT JOIN ai_employees ae ON c.employee_id = ae.id
WHERE c.status IN ('ringing', 'in_progress')
ORDER BY c.started_at DESC;

-- View: Recent calls (last 24 hours)
CREATE OR REPLACE VIEW recent_calls AS
SELECT 
    c.*,
    b.business_name,
    ae.display_name as employee_name
FROM calls c
JOIN businesses b ON c.business_id = b.id
LEFT JOIN ai_employees ae ON c.employee_id = ae.id
WHERE c.started_at > NOW() - INTERVAL '24 hours'
ORDER BY c.started_at DESC;

-- View: Call statistics by business
CREATE OR REPLACE VIEW call_statistics AS
SELECT 
    business_id,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
    COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
    AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration_seconds,
    SUM(cost) as total_cost,
    COUNT(*) FILTER (WHERE recording_url IS NOT NULL) as recorded_calls,
    MAX(started_at) as last_call_at
FROM calls
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY business_id;

-- View: Daily call stats
CREATE OR REPLACE VIEW daily_call_stats AS
SELECT 
    business_id,
    DATE(started_at) as call_date,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
    COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
    AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration_seconds,
    SUM(cost) as total_cost
FROM calls
GROUP BY business_id, DATE(started_at)
ORDER BY call_date DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE calls IS 'Voice call records for all businesses using Vonage';
COMMENT ON COLUMN calls.vonage_call_uuid IS 'Unique call identifier from Vonage';
COMMENT ON COLUMN calls.transcript IS 'Full conversation transcript';
COMMENT ON COLUMN calls.ai_summary IS 'AI-generated summary of the call';
COMMENT ON COLUMN calls.metadata IS 'Additional call data (JSONB)';

-- ============================================================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================================================
-- Uncomment below to add sample call data
/*
INSERT INTO calls (business_id, employee_id, customer_phone, direction, status, duration_seconds, transcript, ai_summary, cost)
SELECT 
    b.id,
    (SELECT id FROM ai_employees LIMIT 1),
    '+1234567890',
    'inbound',
    'completed',
    180,
    '[2024-01-01T10:00:00Z] Customer: Hello, I need help with my order\n[2024-01-01T10:00:30Z] AI: Hi, I''d be happy to help. What''s your order number?',
    'Customer called about order inquiry. AI assistant helped them check order status.',
    0.0500
FROM businesses b
LIMIT 1;
*/

-- ============================================================================
-- GRANTS (if needed for specific database users)
-- ============================================================================
-- Adjust according to your security requirements
-- GRANT SELECT, INSERT, UPDATE, DELETE ON calls TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE calls_id_seq TO app_user;
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
