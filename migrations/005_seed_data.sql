-- ============================================================================
-- Migration 003: Seed Data
-- Description: Inserts initial data for AI employees and demo business
-- ============================================================================

BEGIN;

-- ============================================================================
-- AI EMPLOYEES - Core Team
-- ============================================================================

INSERT INTO ai_employees (name, display_name, employee_role, description, price_monthly, assigned_channel, features, color_theme, tier, icon_emoji, tools, is_active) VALUES
-- Amina - The versatile receptionist
(
  'amina',
  'Botari Amina',
  'AI Receptionist & Customer Support',
  'Warm, welcoming, and always ready to help. Amina handles customer inquiries, appointment scheduling, and general support with a friendly touch.',
  49.00,
  'whatsapp',
  ARRAY['customer_support', 'appointment_scheduling', 'faq_handling', 'multilingual', 'lead_capture'],
  '#10B981',
  'starter',
  '👋',
  ARRAY['calendar', 'contacts', 'knowledge_base', 'appointments'],
  true
),
-- Stan - The sales expert
(
  'stan',
  'Botari Stan',
  'AI Sales Assistant',
  'Persuasive and product-savvy, Stan helps convert conversations into sales. He knows your inventory inside out and never misses a cross-sell opportunity.',
  79.00,
  'whatsapp',
  ARRAY['sales', 'product_recommendations', 'order_processing', 'upselling', 'inventory_management'],
  '#3B82F6',
  'professional',
  '🛍️',
  ARRAY['products', 'orders', 'payments', 'inventory', 'recommendations'],
  true
),
-- Lira - The appointment specialist
(
  'lira',
  'Botari Lira',
  'AI Appointment Manager',
  'Organized and efficient, Lira specializes in booking management. She handles complex scheduling, reminders, and rescheduling with ease.',
  59.00,
  'whatsapp',
  ARRAY['appointment_scheduling', 'reminders', 'calendar_management', 'availability_checking', 'waitlist_management'],
  '#8B5CF6',
  'professional',
  '📅',
  ARRAY['calendar', 'appointments', 'reminders', 'availability'],
  true
),
-- Echo - The voice specialist
(
  'echo',
  'Botari Echo',
  'AI Voice Assistant',
  'Natural and conversational, Echo handles voice calls with human-like warmth. Perfect for businesses that want to offer phone support without the wait.',
  99.00,
  'voice',
  ARRAY['voice_calls', 'natural_conversation', 'call_routing', 'voicemail', 'call_transcription'],
  '#F59E0B',
  'premium',
  '📞',
  ARRAY['voice', 'transcription', 'call_history', 'routing'],
  true
),
-- Nova - The social media expert
(
  'nova',
  'Botari Nova',
  'AI Social Media Manager',
  'Trendy and engaging, Nova manages your social media presence across platforms. She responds to comments, DMs, and keeps your brand voice consistent.',
  89.00,
  'social',
  ARRAY['social_media', 'dm_management', 'comment_response', 'content_suggestions', 'brand_voice'],
  '#EC4899',
  'premium',
  '📱',
  ARRAY['social_media', 'content', 'analytics', 'engagement'],
  true
),
-- Atlas - The enterprise specialist
(
  'atlas',
  'Botari Atlas',
  'AI Enterprise Assistant',
  'Powerful and customizable, Atlas is built for scale. Advanced integrations, custom workflows, and enterprise-grade security for demanding businesses.',
  299.00,
  'whatsapp',
  ARRAY['enterprise_integration', 'custom_workflows', 'advanced_analytics', 'api_access', 'priority_support', 'sso', 'audit_logs'],
  '#6366F1',
  'enterprise',
  '🏢',
  ARRAY['enterprise_api', 'workflows', 'analytics', 'integrations', 'security'],
  true
),
-- Iris - The email specialist
(
  'iris',
  'Botari Iris',
  'AI Email Manager',
  'Professional and articulate, Iris handles email correspondence with perfect tone. From support tickets to sales inquiries, she crafts the perfect response.',
  69.00,
  'email',
  ARRAY['email_management', 'ticket_handling', 'professional_writing', 'template_management', 'follow_ups'],
  '#14B8A6',
  'professional',
  '✉️',
  ARRAY['email', 'templates', 'tickets', 'followups'],
  true
);

-- ============================================================================
-- DEMO BUSINESS (for development/testing)
-- ============================================================================

-- Insert demo business with password: 'demo123' (hashed with bcrypt)
INSERT INTO businesses (name, email, password_hash, phone, address, industry, size, subscription_tier, subscription_status, trial_ends_at) VALUES
(
  'Demo Coffee Shop',
  'demo@botari.ai',
  '$2b$10$rK7t.NeGyXNqQFNP6GQd5eR8K1X8P9mQXKQFhXrYFqPaKOM0f2mYy', -- demo123
  '+1234567890',
  '123 Demo Street, Demo City',
  'food_beverage',
  'small',
  'professional',
  'trial',
  NOW() + INTERVAL '14 days'
);

-- ============================================================================
-- DEMO BUSINESS EMPLOYEES
-- ============================================================================

INSERT INTO business_employees (business_id, employee_id, is_active, connection_status, whatsapp_number, config) VALUES
(1, 1, true, 'connected', '+1234567890', '{"greeting": "Welcome to Demo Coffee Shop! ☕", "auto_reply": true}'),
(1, 2, true, 'connected', '+1234567891', '{"sales_mode": "active", "discount_codes": ["DEMO10", "WELCOME20"]}'),
(1, 3, true, 'disconnected', NULL, '{}');

-- ============================================================================
-- DEMO PRODUCTS (for Demo Coffee Shop)
-- ============================================================================

INSERT INTO products (business_id, name, description, price, cost, stock_quantity, sku, category, tags, is_active) VALUES
(1, 'Signature Espresso', 'Rich, bold espresso with caramel notes', 3.50, 1.20, 100, 'ESP-001', 'Beverages', ARRAY['hot', 'coffee', 'signature'], true),
(1, 'Vanilla Latte', 'Smooth espresso with vanilla syrup and steamed milk', 4.50, 1.80, 80, 'LAT-001', 'Beverages', ARRAY['hot', 'coffee', 'popular'], true),
(1, 'Iced Cold Brew', 'Slow-steeped cold brew coffee, smooth and refreshing', 4.00, 1.00, 60, 'CBR-001', 'Beverages', ARRAY['cold', 'coffee', 'summer'], true),
(1, 'Croissant', 'Buttery, flaky French pastry', 2.50, 0.80, 40, 'PAS-001', 'Pastries', ARRAY['bakery', 'breakfast'], true),
(1, 'Blueberry Muffin', 'Fresh-baked muffin with real blueberries', 3.00, 1.00, 35, 'PAS-002', 'Pastries', ARRAY['bakery', 'breakfast', 'vegetarian'], true),
(1, 'Avocado Toast', 'Sourdough toast with smashed avocado and chili flakes', 8.00, 3.00, 20, 'FOOD-001', 'Food', ARRAY['breakfast', 'lunch', 'vegetarian', 'healthy'], true);

-- ============================================================================
-- KNOWLEDGE BASE - Sample Entries
-- ============================================================================

INSERT INTO knowledge_base (business_id, employee_id, title, content, category, tags, is_active) VALUES
(1, 1, 'Store Hours', 'We are open Monday-Friday 7am-7pm, Saturday-Sunday 8am-6pm. Holiday hours may vary.', 'General', ARRAY['hours', 'location'], true),
(1, 1, 'WiFi Password', 'Our guest WiFi password is: CoffeeTime2024', 'General', ARRAY['wifi', 'amenities'], true),
(1, 1, 'Dietary Options', 'We offer dairy-free milk alternatives (oat, almond, soy), gluten-free pastries, and vegan options. Please ask our staff for details!', 'Menu', ARRAY['dietary', 'allergies', 'vegan', 'gluten-free'], true),
(1, 2, 'Loyalty Program', 'Earn 1 point for every $1 spent. 50 points = $5 reward. Ask to join our loyalty program!', 'Promotions', ARRAY['loyalty', 'rewards', 'savings'], true),
(1, 2, 'Catering Services', 'We offer catering for events of 10-100 people. Includes coffee, pastries, and sandwich platters. 48-hour advance notice required.', 'Services', ARRAY['catering', 'events', 'bulk'], true);

-- ============================================================================
-- CUSTOM INSTRUCTIONS
-- ============================================================================

INSERT INTO custom_instructions (business_id, employee_id, instruction_type, content, priority, is_active) VALUES
(1, 1, 'greeting', 'Always greet customers warmly and mention our daily specials if available.', 1, true),
(1, 1, 'tone', 'Be friendly, casual, and use coffee-related emojis when appropriate.', 2, true),
(1, 2, 'response_style', 'When discussing products, emphasize quality and craftsmanship. Mention our single-origin beans.', 1, true),
(1, 2, 'specialization', 'You are an expert in coffee and can answer questions about brewing methods, bean origins, and flavor profiles.', 3, true);

-- ============================================================================
-- DEMO CONVERSATIONS & MESSAGES
-- ============================================================================

-- Sample conversation
INSERT INTO conversations (business_id, employee_id, customer_phone, customer_name, status, channel, priority, started_at, last_message_at) VALUES
(1, 1, '+15551234567', 'John Smith', 'open', 'whatsapp', 'normal', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '15 minutes');

-- Sample messages
INSERT INTO messages (conversation_id, role, content, content_type, created_at) VALUES
(1, 'user', 'Hi! What are your hours today?', 'text', NOW() - INTERVAL '2 hours'),
(1, 'assistant', 'Hello John! 👋 We''re open today from 7am to 7pm. Perfect timing for your afternoon coffee! ☕ Would you like to know about our daily special?', 'text', NOW() - INTERVAL '1 hour 55 minutes'),
(1, 'user', 'Great! Do you have oat milk?', 'text', NOW() - INTERVAL '1 hour'),
(1, 'assistant', 'Yes, we do! We offer oat, almond, and soy milk alternatives at no extra charge. 🥛 Our oat milk pairs especially well with our Vanilla Latte. Would you like to place an order for pickup?', 'text', NOW() - INTERVAL '15 minutes');

-- ============================================================================
-- DEMO APPOINTMENT
-- ============================================================================

INSERT INTO appointments (business_id, customer_phone, customer_name, customer_email, employee_id, scheduled_at, duration_minutes, status, service_name, notes) VALUES
(1, '+15559876543', 'Sarah Johnson', 'sarah@email.com', 3, NOW() + INTERVAL '2 days', 30, 'confirmed', 'Private Event Booking', 'Birthday celebration for 8 people');

-- ============================================================================
-- DEMO ORDER
-- ============================================================================

INSERT INTO orders (business_id, conversation_id, customer_phone, customer_name, items, total_amount, tax_amount, currency, status, payment_status, notes) VALUES
(1, 1, '+15551234567', 'John Smith', 
 '[{"product_id": 2, "name": "Vanilla Latte", "quantity": 1, "price": 4.50}, {"product_id": 4, "name": "Croissant", "quantity": 2, "price": 2.50}]'::jsonb,
 9.50, 0.79, 'USD', 'confirmed', 'paid', 'Customer will pick up at 3pm');

-- ============================================================================
-- UPDATE ANALYTICS
-- ============================================================================

INSERT INTO daily_stats (business_id, date, total_conversations, total_messages, total_orders, total_revenue, new_customers) VALUES
(1, CURRENT_DATE, 5, 20, 3, 45.50, 2);

INSERT INTO customer_analytics (business_id, customer_phone, first_contact_at, last_contact_at, total_conversations, total_messages, total_orders, total_spent) VALUES
(1, '+15551234567', NOW() - INTERVAL '7 days', NOW() - INTERVAL '15 minutes', 3, 12, 2, 28.50),
(1, '+15559876543', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 1, 3, 0, 0);

COMMIT;
