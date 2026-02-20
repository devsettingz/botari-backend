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
