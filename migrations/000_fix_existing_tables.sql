-- ============================================================================
-- Migration 001: Fix businesses table columns
-- ============================================================================
-- This migration ensures the businesses table has the correct column names
-- ============================================================================

-- First, check if businesses table exists with wrong column names
DO $$
BEGIN
    -- Check if business_name column exists (wrong name)
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'businesses' 
               AND column_name = 'business_name') THEN
        
        -- Rename business_name to name
        ALTER TABLE businesses RENAME COLUMN business_name TO name;
        RAISE NOTICE 'Renamed business_name to name';
        
    -- Check if name column doesn't exist (table exists but without name column)
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'businesses' 
                      AND column_name = 'name') THEN
        
        -- Add name column
        ALTER TABLE businesses ADD COLUMN name VARCHAR(255);
        
        -- Copy data from business_name if it exists under different name
        -- Update name from other columns or set default
        UPDATE businesses SET name = COALESCE(
            (SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'businesses' AND column_name LIKE '%name%'),
            'Unknown Business'
        );
        
        -- Make name NOT NULL
        ALTER TABLE businesses ALTER COLUMN name SET NOT NULL;
        RAISE NOTICE 'Added name column to businesses table';
    END IF;
    
    -- Ensure country column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'businesses' 
                   AND column_name = 'country') THEN
        ALTER TABLE businesses ADD COLUMN country VARCHAR(50);
        RAISE NOTICE 'Added country column to businesses table';
    END IF;
END $$;

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create migrations table if not exists (for tracking)
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);
