-- ============================================================================
-- WhatsApp Sessions and Messages Tables
-- ============================================================================
-- This migration adds tables for persistent WhatsApp session storage
-- and message history tracking.
-- ============================================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
DROP TABLE IF EXISTS whatsapp_sessions CASCADE;

-- ============================================================================
-- WHATSAPP SESSIONS TABLE
-- ============================================================================
-- Stores WhatsApp connection credentials and session state for each business
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES ai_employees(id) ON DELETE CASCADE,
    
    -- Connection status
    status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
    -- Values: 'disconnected', 'connecting', 'awaiting_qr', 'connected', 'reconnecting'
    
    -- Phone number connected (from WhatsApp)
    phone_number VARCHAR(20),
    
    -- Session credentials (encrypted JSON)
    credentials JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique session per business-employee pair
    CONSTRAINT unique_business_employee_session UNIQUE (business_id, employee_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_business ON whatsapp_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_employee ON whatsapp_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);

-- ============================================================================
-- WHATSAPP MESSAGES TABLE
-- ============================================================================
-- Stores message history for WhatsApp conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Message participants
    sender VARCHAR(50) NOT NULL,       -- Phone number of sender
    recipient VARCHAR(50) NOT NULL,    -- Phone number of recipient
    
    -- Message content
    content TEXT NOT NULL,
    media_url TEXT,                    -- URL if media is stored separately
    message_type VARCHAR(20) DEFAULT 'text',
    -- Values: 'text', 'image', 'video', 'audio', 'document', 'location', 'unknown'
    
    -- Message direction
    direction VARCHAR(10) NOT NULL,
    -- Values: 'incoming', 'outgoing'
    
    -- Message status
    status VARCHAR(20) DEFAULT 'sent',
    -- Values: 'pending', 'sent', 'delivered', 'read', 'failed'
    
    -- External references
    whatsapp_message_id VARCHAR(100),  -- Message ID from WhatsApp
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_business ON whatsapp_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender ON whatsapp_messages(sender);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient ON whatsapp_messages(recipient);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id);

-- Composite index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_business_sender ON whatsapp_messages(business_id, sender);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_business_created ON whatsapp_messages(business_id, created_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Automatically update the updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for whatsapp_sessions
CREATE TRIGGER IF NOT EXISTS update_whatsapp_sessions_updated_at
    BEFORE UPDATE ON whatsapp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for whatsapp_messages
CREATE TRIGGER IF NOT EXISTS update_whatsapp_messages_updated_at
    BEFORE UPDATE ON whatsapp_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UPDATE EXISTING business_employees TABLE
-- ============================================================================
-- Ensure connection_status column exists with proper enum values
-- ============================================================================

-- Add connection_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'business_employees' 
                   AND column_name = 'connection_status') THEN
        ALTER TABLE business_employees 
        ADD COLUMN connection_status VARCHAR(50) DEFAULT 'disconnected';
    END IF;
END $$;

-- Add whatsapp_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'business_employees' 
                   AND column_name = 'whatsapp_number') THEN
        ALTER TABLE business_employees 
        ADD COLUMN whatsapp_number VARCHAR(20);
    END IF;
END $$;

-- Add indexes for business_employees
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_business_employees_status ON business_employees(connection_status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_business_employees_whatsapp ON business_employees(whatsapp_number);

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- View: Active WhatsApp sessions
CREATE OR REPLACE VIEW active_whatsapp_sessions AS
SELECT 
    ws.*,
    b.name as business_name,
    ae.display_name as employee_name,
    ae.employee_role
FROM whatsapp_sessions ws
JOIN businesses b ON ws.business_id = b.id
JOIN ai_employees ae ON ws.employee_id = ae.id
WHERE ws.status = 'connected';

-- View: Recent WhatsApp messages
CREATE OR REPLACE VIEW recent_whatsapp_messages AS
SELECT 
    wm.*,
    b.name as business_name
FROM whatsapp_messages wm
JOIN businesses b ON wm.business_id = b.id
WHERE wm.created_at > NOW() - INTERVAL '24 hours'
ORDER BY wm.created_at DESC;

-- View: WhatsApp message statistics per business
CREATE OR REPLACE VIEW whatsapp_message_stats AS
SELECT 
    business_id,
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE direction = 'incoming') as incoming_count,
    COUNT(*) FILTER (WHERE direction = 'outgoing') as outgoing_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    MAX(created_at) as last_message_at
FROM whatsapp_messages
GROUP BY business_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE whatsapp_sessions IS 'Stores WhatsApp Web session credentials and connection state';
COMMENT ON TABLE whatsapp_messages IS 'Stores WhatsApp message history for all businesses';
COMMENT ON COLUMN whatsapp_sessions.credentials IS 'Encrypted Baileys auth state (JSON)';
COMMENT ON COLUMN whatsapp_messages.whatsapp_message_id IS 'Original message ID from WhatsApp/Baileys';

-- ============================================================================
-- GRANTS (if needed for specific database users)
-- ============================================================================
-- Adjust according to your security requirements
-- GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_sessions TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_messages TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE whatsapp_sessions_id_seq TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE whatsapp_messages_id_seq TO app_user;
