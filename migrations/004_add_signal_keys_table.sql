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
