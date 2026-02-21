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
