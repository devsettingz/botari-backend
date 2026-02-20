-- ============================================
-- FIX: Change prices from Naira to Dollars
-- ============================================

UPDATE ai_employees SET price_monthly = 49 WHERE id = 1;   -- Amina (Starter)
UPDATE ai_employees SET price_monthly = 99 WHERE id = 2;   -- Eva (Professional)
UPDATE ai_employees SET price_monthly = 99 WHERE id = 3;   -- Stan (Professional)
UPDATE ai_employees SET price_monthly = 149 WHERE id = 4;  -- Rachel (Premium)
UPDATE ai_employees SET price_monthly = 149 WHERE id = 5;  -- Sonny (Premium)
UPDATE ai_employees SET price_monthly = 99 WHERE id = 6;   -- Penny (Professional)
UPDATE ai_employees SET price_monthly = 299 WHERE id = 7;  -- Linda (Enterprise)
UPDATE ai_employees SET price_monthly = 99 WHERE id = 8;   -- Zara (Professional)
UPDATE ai_employees SET price_monthly = 149 WHERE id = 9;  -- Omar (Premium)
UPDATE ai_employees SET price_monthly = 149 WHERE id = 10; -- Kofi (Premium)

-- Verify
SELECT id, display_name, price_monthly, tier FROM ai_employees ORDER BY price_monthly;
