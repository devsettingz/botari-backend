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
    b.name as business_name,
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
    b.name as business_name,
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
