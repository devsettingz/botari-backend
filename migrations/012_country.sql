-- Add country column to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country VARCHAR(50);
