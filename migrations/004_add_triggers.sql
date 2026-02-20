-- ============================================================================
-- Migration 004: Add Triggers and Functions
-- Description: Creates database triggers for automatic updates
-- ============================================================================

BEGIN;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Update customer analytics on new conversation
CREATE OR REPLACE FUNCTION update_customer_analytics_on_conversation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customer_analytics (business_id, customer_phone, first_contact_at, last_contact_at, total_conversations)
  VALUES (NEW.business_id, NEW.customer_phone, NEW.started_at, NEW.started_at, 1)
  ON CONFLICT (business_id, customer_phone) 
  DO UPDATE SET 
    last_contact_at = NEW.started_at,
    total_conversations = customer_analytics.total_conversations + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update customer analytics on new order
CREATE OR REPLACE FUNCTION update_customer_analytics_on_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customer_analytics (business_id, customer_phone, total_orders, total_spent)
  VALUES (NEW.business_id, NEW.customer_phone, 1, NEW.total_amount)
  ON CONFLICT (business_id, customer_phone) 
  DO UPDATE SET 
    total_orders = customer_analytics.total_orders + 1,
    total_spent = customer_analytics.total_spent + NEW.total_amount,
    last_contact_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update customer analytics on new message
CREATE OR REPLACE FUNCTION update_customer_analytics_on_message()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id INTEGER;
  v_customer_phone VARCHAR(20);
BEGIN
  -- Get conversation details
  SELECT business_id, customer_phone INTO v_business_id, v_customer_phone
  FROM conversations WHERE id = NEW.conversation_id;
  
  -- Only count user messages
  IF NEW.role = 'user' THEN
    INSERT INTO customer_analytics (business_id, customer_phone, total_messages)
    VALUES (v_business_id, v_customer_phone, 1)
    ON CONFLICT (business_id, customer_phone) 
    DO UPDATE SET 
      total_messages = customer_analytics.total_messages + 1,
      last_contact_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update daily stats on new conversation
CREATE OR REPLACE FUNCTION update_daily_stats_on_conversation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_stats (business_id, date, total_conversations)
  VALUES (NEW.business_id, CURRENT_DATE, 1)
  ON CONFLICT (business_id, date) 
  DO UPDATE SET total_conversations = daily_stats.total_conversations + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update daily stats on new order
CREATE OR REPLACE FUNCTION update_daily_stats_on_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_stats (business_id, date, total_orders, total_revenue)
  VALUES (NEW.business_id, CURRENT_DATE, 1, NEW.total_amount)
  ON CONFLICT (business_id, date) 
  DO UPDATE SET 
    total_orders = daily_stats.total_orders + 1,
    total_revenue = daily_stats.total_revenue + NEW.total_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update message count on business_employees
CREATE OR REPLACE FUNCTION increment_employee_message_count()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id INTEGER;
  v_business_id INTEGER;
BEGIN
  -- Get conversation details
  SELECT employee_id, business_id INTO v_employee_id, v_business_id
  FROM conversations WHERE id = NEW.conversation_id;
  
  -- Update business_employees if employee_id is set
  IF v_employee_id IS NOT NULL THEN
    UPDATE business_employees 
    SET messages_processed = messages_processed + 1,
        last_active = NOW()
    WHERE business_id = v_business_id AND employee_id = v_employee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- APPLY TRIGGERS
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER update_businesses_updated_at 
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_employees_updated_at 
  BEFORE UPDATE ON business_employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at 
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at 
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at 
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_instructions_updated_at 
  BEFORE UPDATE ON custom_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_sessions_updated_at 
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update triggers
CREATE TRIGGER update_conversation_last_message_trigger 
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

CREATE TRIGGER update_customer_analytics_conversation_trigger 
  AFTER INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_customer_analytics_on_conversation();

CREATE TRIGGER update_customer_analytics_order_trigger 
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_customer_analytics_on_order();

CREATE TRIGGER update_customer_analytics_message_trigger 
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_customer_analytics_on_message();

CREATE TRIGGER update_daily_stats_conversation_trigger 
  AFTER INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_daily_stats_on_conversation();

CREATE TRIGGER update_daily_stats_order_trigger 
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_daily_stats_on_order();

CREATE TRIGGER increment_employee_message_count_trigger 
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION increment_employee_message_count();

COMMIT;
