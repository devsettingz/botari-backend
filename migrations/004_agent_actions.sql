-- ============================================================================
-- AI Agent Actions System - Database Schema
-- Botari AI - Functional AI Employees
-- ============================================================================
-- This migration creates all tables needed for the AI agent action system:
-- - Products/Inventory management
-- - Appointments scheduling
-- - Orders processing
-- - Customers management
-- - Communication logs
-- ============================================================================

-- ============================================================================
-- PRODUCTS / INVENTORY TABLE
-- ============================================================================
DROP TABLE IF EXISTS inventory_logs CASCADE;
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Product details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100), -- Stock Keeping Unit
    category VARCHAR(100),
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cost_price DECIMAL(10, 2) DEFAULT 0.00, -- For profit tracking
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Inventory
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10, -- Alert when stock below this
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_price CHECK (price >= 0),
    CONSTRAINT positive_stock CHECK (stock_quantity >= 0)
);

-- Indexes for products
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(business_id, is_active);
CREATE INDEX idx_products_low_stock ON products(business_id, stock_quantity, low_stock_threshold) 
    WHERE stock_quantity <= low_stock_threshold;

-- Full-text search on product name and description
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================================
-- INVENTORY LOGS TABLE (Track all inventory changes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Change details
    action VARCHAR(50) NOT NULL, -- 'restock', 'sale', 'adjustment', 'return'
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    quantity_change INTEGER GENERATED ALWAYS AS (quantity_after - quantity_before) STORED,
    
    -- Context
    order_id INTEGER, -- If related to an order
    reason TEXT,
    created_by VARCHAR(100), -- 'system', 'agent', 'manual', employee name
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_logs_business ON inventory_logs(business_id);
CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_created ON inventory_logs(created_at);

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Contact info
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    address TEXT,
    
    -- Profile
    notes TEXT,
    tags TEXT[], -- Array of tags like ['vip', 'frequent', 'new']
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_customer_phone_per_business UNIQUE (business_id, phone)
);

CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_tags ON customers USING gin(tags);
CREATE INDEX idx_customers_name ON customers(name) WHERE name IS NOT NULL;

-- ============================================================================
-- APPOINTMENTS TABLE
-- ============================================================================
DROP TABLE IF EXISTS appointments CASCADE;

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    employee_id INTEGER REFERENCES ai_employees(id) ON DELETE SET NULL,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    
    -- Service details
    service_name VARCHAR(255),
    service_price DECIMAL(10, 2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
    
    -- Notes
    notes TEXT,
    cancellation_reason TEXT,
    
    -- Reminders
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_appointments_customer ON appointments(business_id, customer_phone);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date_range ON appointments(business_id, scheduled_at) 
    WHERE status IN ('pending', 'confirmed');

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
DROP TABLE IF EXISTS orders CASCADE;

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- Order details
    items JSONB NOT NULL, -- Array of {product_id, product_name, quantity, unit_price, total_price}
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Status workflow: pending -> confirmed -> processing -> shipped -> delivered
    --                    -> cancelled
    status VARCHAR(20) DEFAULT 'pending', 
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    payment_method VARCHAR(50),
    
    -- Shipping
    shipping_address TEXT,
    tracking_number VARCHAR(100),
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_customer ON orders(business_id, customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_recent ON orders(business_id, created_at DESC);

-- ============================================================================
-- ACTION LOGS TABLE (Track all agent actions)
-- ============================================================================
DROP TABLE IF EXISTS action_logs CASCADE;

CREATE TABLE IF NOT EXISTS action_logs (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Action details
    action_name VARCHAR(100) NOT NULL,
    params JSONB,
    result JSONB,
    success BOOLEAN DEFAULT true,
    
    -- Context
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    customer_phone VARCHAR(20),
    
    -- Who executed
    executed_by VARCHAR(100), -- Employee ID, 'system', or 'user'
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_action_logs_business ON action_logs(business_id);
CREATE INDEX idx_action_logs_action ON action_logs(action_name);
CREATE INDEX idx_action_logs_executed ON action_logs(executed_at);
CREATE INDEX idx_action_logs_conversation ON action_logs(conversation_id);

-- ============================================================================
-- EMAIL QUEUE TABLE
-- ============================================================================
DROP TABLE IF EXISTS email_queue CASCADE;

CREATE TABLE IF NOT EXISTS email_queue (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Email details
    to_email VARCHAR(255) NOT NULL,
    to_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    template VARCHAR(100),
    template_data JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'retrying'
    
    -- Tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_queue_business ON email_queue(business_id);
CREATE INDEX idx_email_queue_status ON email_queue(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_email_queue_created ON email_queue(created_at);

-- ============================================================================
-- FOLLOW-UPS TABLE
-- ============================================================================
DROP TABLE IF EXISTS follow_ups CASCADE;

CREATE TABLE IF NOT EXISTS follow_ups (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- Follow-up details
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT NOT NULL,
    channel VARCHAR(20) DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email', 'call'
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'cancelled', 'overdue'
    
    -- Completion tracking
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by VARCHAR(100),
    completion_notes TEXT,
    
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_business ON follow_ups(business_id);
CREATE INDEX idx_follow_ups_customer ON follow_ups(business_id, customer_phone);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_follow_ups_status ON follow_ups(status);

-- ============================================================================
-- ESCALATIONS TABLE
-- ============================================================================
DROP TABLE IF EXISTS escalations CASCADE;

CREATE TABLE IF NOT EXISTS escalations (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    customer_phone VARCHAR(20),
    
    -- Escalation details
    reason TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'closed'
    
    -- Assignment
    assigned_to INTEGER, -- User/employee ID
    assigned_at TIMESTAMP WITH TIME ZONE,
    
    -- Resolution
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_escalations_business ON escalations(business_id);
CREATE INDEX idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX idx_escalations_status ON escalations(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_escalations_priority ON escalations(priority);
CREATE INDEX idx_escalations_created ON escalations(created_at);

-- ============================================================================
-- UPDATE CONVERSATIONS TABLE (Add escalation fields)
-- ============================================================================
DO $$
BEGIN
    -- Add escalation fields if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'conversations' AND column_name = 'escalation_reason') THEN
        ALTER TABLE conversations ADD COLUMN escalation_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'conversations' AND column_name = 'escalation_priority') THEN
        ALTER TABLE conversations ADD COLUMN escalation_priority VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'conversations' AND column_name = 'metadata') THEN
        ALTER TABLE conversations ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- ============================================================================
-- UPDATE MESSAGES TABLE (Add metadata for action tracking)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'metadata') THEN
        ALTER TABLE messages ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Products trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Customers trigger
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Appointments trigger
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Orders trigger
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email queue trigger
DROP TRIGGER IF EXISTS update_email_queue_updated_at ON email_queue;
CREATE TRIGGER update_email_queue_updated_at
    BEFORE UPDATE ON email_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Follow-ups trigger
DROP TRIGGER IF EXISTS update_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER update_follow_ups_updated_at
    BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Escalations trigger
DROP TRIGGER IF EXISTS update_escalations_updated_at ON escalations;
CREATE TRIGGER update_escalations_updated_at
    BEFORE UPDATE ON escalations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- View: Low stock products
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    p.*,
    b.name as business_name
FROM products p
JOIN businesses b ON p.business_id = b.id
WHERE p.stock_quantity <= p.low_stock_threshold
AND p.is_active = true;

-- View: Today's appointments
CREATE OR REPLACE VIEW todays_appointments AS
SELECT 
    a.*,
    c.name as customer_name,
    b.name as business_name
FROM appointments a
LEFT JOIN customers c ON a.business_id = c.business_id AND a.customer_phone = c.phone
JOIN businesses b ON a.business_id = b.id
WHERE DATE(a.scheduled_at) = CURRENT_DATE
AND a.status IN ('pending', 'confirmed')
ORDER BY a.scheduled_at;

-- View: Recent orders with customer info
CREATE OR REPLACE VIEW recent_orders AS
SELECT 
    o.*,
    c.name as customer_name,
    b.name as business_name
FROM orders o
LEFT JOIN customers c ON o.business_id = c.business_id AND o.customer_phone = c.phone
JOIN businesses b ON o.business_id = b.id
WHERE o.created_at > NOW() - INTERVAL '30 days'
ORDER BY o.created_at DESC;

-- View: Pending follow-ups
CREATE OR REPLACE VIEW pending_follow_ups AS
SELECT 
    f.*,
    c.name as customer_name,
    b.name as business_name,
    CASE 
        WHEN f.scheduled_at < NOW() THEN 'overdue'
        WHEN f.scheduled_at < NOW() + INTERVAL '1 hour' THEN 'due_soon'
        ELSE 'pending'
    END as urgency
FROM follow_ups f
LEFT JOIN customers c ON f.business_id = c.business_id AND f.customer_phone = c.phone
JOIN businesses b ON f.business_id = b.id
WHERE f.status = 'pending'
ORDER BY f.scheduled_at;

-- View: Agent action statistics
CREATE OR REPLACE VIEW agent_action_stats AS
SELECT 
    business_id,
    action_name,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE success = true) as successful_executions,
    COUNT(*) FILTER (WHERE success = false) as failed_executions,
    MAX(executed_at) as last_executed
FROM action_logs
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY business_id, action_name;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE products IS 'Product catalog with inventory tracking for each business';
COMMENT ON TABLE inventory_logs IS 'Audit trail of all inventory changes';
COMMENT ON TABLE customers IS 'Customer database with contact info and tags';
COMMENT ON TABLE appointments IS 'Appointment scheduling with customer and service details';
COMMENT ON TABLE orders IS 'Order records with items stored as JSONB for flexibility';
COMMENT ON TABLE action_logs IS 'Audit trail of all AI agent actions';
COMMENT ON TABLE email_queue IS 'Outgoing email queue for async processing';
COMMENT ON TABLE follow_ups IS 'Scheduled follow-up reminders for customers';
COMMENT ON TABLE escalations IS 'Human escalation queue for complex issues';

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Adjust according to your security requirements
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
