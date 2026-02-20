-- ============================================================================
-- Sample Data for AI Agent Actions System
-- Botari AI - Test Data
-- ============================================================================
-- This seed file creates sample data for testing the agent actions system.
-- Run this after migration 002_agent_actions_system.sql
-- ============================================================================

-- Note: This assumes business_id = 1 exists
-- Adjust the business_id as needed for your environment

-- ============================================================================
-- SAMPLE PRODUCTS
-- ============================================================================

INSERT INTO products (business_id, name, description, sku, category, price, stock_quantity, low_stock_threshold, is_active) VALUES
(1, 'iPhone 15 Pro', 'Latest Apple iPhone 15 Pro with 256GB storage', 'PHONE-001', 'Electronics', 999.99, 15, 5, true),
(1, 'Samsung Galaxy S24', 'Samsung flagship smartphone 256GB', 'PHONE-002', 'Electronics', 899.99, 12, 5, true),
(1, 'AirPods Pro 2', 'Apple wireless noise-canceling earbuds', 'AUDIO-001', 'Audio', 249.99, 30, 10, true),
(1, 'MacBook Air M3', '13-inch MacBook Air with M3 chip, 512GB', 'COMP-001', 'Computers', 1299.99, 8, 3, true),
(1, 'iPad Air', '10.9-inch iPad Air 256GB WiFi', 'TAB-001', 'Tablets', 649.99, 20, 5, true),
(1, 'Apple Watch Series 9', 'Latest Apple Watch with health tracking', 'WATCH-001', 'Wearables', 399.99, 18, 5, true),
(1, 'Sony WH-1000XM5', 'Premium noise-canceling headphones', 'AUDIO-002', 'Audio', 349.99, 10, 3, true),
(1, 'Wireless Charger', '15W fast wireless charging pad', 'ACC-001', 'Accessories', 29.99, 50, 15, true),
(1, 'USB-C Cable', 'Braided USB-C to Lightning cable 2m', 'ACC-002', 'Accessories', 19.99, 100, 25, true),
(1, 'Phone Case - iPhone 15', 'Premium leather case for iPhone 15', 'ACC-003', 'Accessories', 49.99, 25, 10, true);

-- ============================================================================
-- SAMPLE CUSTOMERS
-- ============================================================================

INSERT INTO customers (business_id, phone, name, email, address, notes, tags, created_at, updated_at) VALUES
(1, '+2348012345678', 'John Okafor', 'john.okafor@email.com', '12 Lagos Street, Ikeja, Lagos', 'Regular customer, prefers iPhones', ARRAY['vip', 'repeat'], NOW() - INTERVAL '30 days', NOW()),
(1, '+2348023456789', 'Sarah Nnamdi', 'sarah.n@email.com', '45 Abuja Road, Wuse, Abuja', 'Interested in audio products', ARRAY['audiophile'], NOW() - INTERVAL '20 days', NOW()),
(1, '+2348034567890', 'Michael Adeyemi', 'm.adeyemi@email.com', '78 Ibadan Avenue, Challenge, Ibadan', 'Corporate client, bulk orders', ARRAY['corporate', 'bulk'], NOW() - INTERVAL '15 days', NOW()),
(1, '+2348045678901', 'Fatima Ibrahim', 'fatima.i@email.com', '23 Kano Crescent, Sabon Gari, Kano', 'Student discount eligible', ARRAY['student'], NOW() - INTERVAL '10 days', NOW()),
(1, '+2348056789012', 'David Obi', 'david.obi@email.com', '56 Port Harcourt Road, Trans Amadi, PH', NULL, NULL, NOW() - INTERVAL '5 days', NOW());

-- ============================================================================
-- SAMPLE APPOINTMENTS
-- ============================================================================

INSERT INTO appointments (business_id, customer_phone, employee_id, scheduled_at, duration_minutes, service_name, service_price, status, notes, created_at, updated_at) VALUES
(1, '+2348012345678', 1, NOW() + INTERVAL '1 day', 30, 'Product Demo - iPhone 15', NULL, 'confirmed', 'Customer wants to see iPhone 15 features', NOW(), NOW()),
(1, '+2348023456789', 1, NOW() + INTERVAL '2 days', 45, 'Audio Consultation', NULL, 'confirmed', 'Testing AirPods Pro and Sony headphones', NOW(), NOW()),
(1, '+2348034567890', 1, NOW() + INTERVAL '3 days', 60, 'Corporate Setup', NULL, 'pending', 'Bulk order discussion for 10 laptops', NOW(), NOW()),
(1, '+2348045678901', 1, NOW() - INTERVAL '1 day', 30, 'Student Discount Consultation', NULL, 'completed', 'Discussed student pricing options', NOW() - INTERVAL '2 days', NOW()),
(1, '+2348056789012', 1, NOW() - INTERVAL '2 days', 30, 'Product Inquiry', NULL, 'cancelled', 'Customer rescheduled', NOW() - INTERVAL '3 days', NOW());

-- ============================================================================
-- SAMPLE ORDERS
-- ============================================================================

INSERT INTO orders (business_id, customer_phone, items, total_amount, currency, status, payment_status, notes, created_at, updated_at) VALUES
(1, '+2348012345678', 
 '[{"product_id": 1, "product_name": "iPhone 15 Pro", "quantity": 1, "unit_price": 999.99, "total_price": 999.99}, 
   {"product_id": 3, "product_name": "AirPods Pro 2", "quantity": 1, "unit_price": 249.99, "total_price": 249.99}]'::jsonb,
 1249.98, 'USD', 'delivered', 'paid', 'Complete iPhone setup', NOW() - INTERVAL '15 days', NOW()),

(1, '+2348023456789', 
 '[{"product_id": 7, "product_name": "Sony WH-1000XM5", "quantity": 1, "unit_price": 349.99, "total_price": 349.99}]'::jsonb,
 349.99, 'USD', 'shipped', 'paid', 'Gift wrapping requested', NOW() - INTERVAL '7 days', NOW()),

(1, '+2348034567890', 
 '[{"product_id": 4, "product_name": "MacBook Air M3", "quantity": 3, "unit_price": 1299.99, "total_price": 3899.97}]'::jsonb,
 3899.97, 'USD', 'processing', 'paid', 'Corporate order - 3 laptops', NOW() - INTERVAL '3 days', NOW()),

(1, '+2348045678901', 
 '[{"product_id": 5, "product_name": "iPad Air", "quantity": 1, "unit_price": 649.99, "total_price": 649.99},
   {"product_id": 8, "product_name": "Wireless Charger", "quantity": 1, "unit_price": 29.99, "total_price": 29.99}]'::jsonb,
 679.98, 'USD', 'pending', 'pending', 'Student bundle', NOW() - INTERVAL '1 day', NOW()),

(1, '+2348012345678', 
 '[{"product_id": 6, "product_name": "Apple Watch Series 9", "quantity": 1, "unit_price": 399.99, "total_price": 399.99}]'::jsonb,
 399.99, 'USD', 'confirmed', 'paid', 'Second order from repeat customer', NOW(), NOW());

-- ============================================================================
-- SAMPLE FOLLOW-UPS
-- ============================================================================

INSERT INTO follow_ups (business_id, customer_phone, scheduled_at, notes, channel, status, created_by, created_at) VALUES
(1, '+2348056789012', NOW() + INTERVAL '2 hours', 'Follow up on product inquiry - interested in Samsung Galaxy', 'whatsapp', 'pending', 'Amina', NOW()),
(1, '+2348034567890', NOW() + INTERVAL '1 day', 'Check if corporate order was received and satisfaction level', 'email', 'pending', 'Amina', NOW()),
(1, '+2348045678901', NOW() + INTERVAL '3 days', 'Student discount paperwork follow-up', 'whatsapp', 'pending', 'Amina', NOW()),
(1, '+2348023456789', NOW() - INTERVAL '1 day', 'Audio product satisfaction check', 'whatsapp', 'completed', 'Amina', NOW() - INTERVAL '2 days');

-- ============================================================================
-- SAMPLE ESCALATIONS
-- ============================================================================

INSERT INTO escalations (business_id, customer_phone, reason, priority, status, created_at) VALUES
(1, '+2348034567890', 'Bulk order pricing negotiation required - beyond AI scope', 'high', 'pending', NOW()),
(1, '+2348012345678', 'Warranty claim on previous purchase', 'medium', 'in_progress', NOW() - INTERVAL '1 day');

-- ============================================================================
-- SAMPLE INVENTORY LOGS
-- ============================================================================

INSERT INTO inventory_logs (business_id, product_id, action, quantity_before, quantity_after, order_id, reason, created_by, created_at) VALUES
(1, 1, 'sale', 16, 15, 1, 'Order #1 - iPhone 15 Pro', 'system', NOW() - INTERVAL '15 days'),
(1, 3, 'sale', 31, 30, 1, 'Order #1 - AirPods Pro 2', 'system', NOW() - INTERVAL '15 days'),
(1, 7, 'sale', 11, 10, 2, 'Order #2 - Sony WH-1000XM5', 'system', NOW() - INTERVAL '7 days'),
(1, 4, 'sale', 6, 3, 3, 'Order #3 - 3x MacBook Air M3', 'system', NOW() - INTERVAL '3 days'),
(1, 1, 'restock', 15, 20, NULL, 'Weekly restock', 'manual', NOW() - INTERVAL '1 day');

-- ============================================================================
-- UPDATE CONVERSATIONS WITH METADATA
-- ============================================================================

-- Add sample metadata to existing conversations if any
UPDATE conversations 
SET metadata = '{"actions_used": ["check_inventory", "take_order"]}'
WHERE business_id = 1;

-- ============================================================================
-- SAMPLE ACTION LOGS
-- ============================================================================

INSERT INTO action_logs (business_id, action_name, params, result, success, customer_phone, executed_by, executed_at) VALUES
(1, 'check_inventory', '{"product_name": "iPhone"}'::jsonb, '{"success": true, "count": 2}'::jsonb, true, '+2348012345678', 'amina', NOW() - INTERVAL '2 days'),
(1, 'take_order', '{"customer_phone": "+2348012345678", "items": [{"product_id": 1, "quantity": 1}]}'::jsonb, '{"success": true, "order_id": 5}'::jsonb, true, '+2348012345678', 'amina', NOW()),
(1, 'book_appointment', '{"customer_phone": "+2348023456789", "date": "2024-02-20", "time": "14:00"}'::jsonb, '{"success": true}'::jsonb, true, '+2348023456789', 'amina', NOW() - INTERVAL '1 day'),
(1, 'check_price', '{"product_name": "Samsung"}'::jsonb, '{"success": true, "products": [{"name": "Samsung Galaxy S24", "price": 899.99}]}'::jsonb, true, '+2348056789012', 'amina', NOW() - INTERVAL '3 hours');

-- ============================================================================
-- SAMPLE EMAIL QUEUE
-- ============================================================================

INSERT INTO email_queue (business_id, to_email, to_name, subject, body, template, status, created_at) VALUES
(1, 'john.okafor@email.com', 'John Okafor', 'Your Order Has Been Delivered!', 
 'Dear John, Your order #1 has been delivered. Thank you for shopping with us!', 
 'order_delivered', 'sent', NOW() - INTERVAL '10 days'),

(1, 'm.adeyemi@email.com', 'Michael Adeyemi', 'Your Order is Being Processed', 
 'Dear Michael, Your corporate order #3 is being processed. We will update you soon.', 
 'order_processing', 'sent', NOW() - INTERVAL '2 days'),

(1, 'sarah.n@email.com', 'Sarah Nnamdi', 'Special Offer on Audio Products', 
 'Hi Sarah, Check out our latest audio deals just for you!', 
 'promotional', 'pending', NOW());

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
