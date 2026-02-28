"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const messages_1 = __importDefault(require("./routes/messages"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const messages_history_1 = __importDefault(require("./routes/messages-history"));
const conversations_list_1 = __importDefault(require("./routes/conversations-list"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const admin_1 = __importDefault(require("./routes/admin"));
const admin_auth_1 = __importDefault(require("./routes/admin-auth"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const payments_1 = __importDefault(require("./routes/payments"));
const payments_webhook_1 = __importDefault(require("./routes/payments-webhook"));
const calls_1 = __importDefault(require("./routes/calls"));
const employees_1 = __importDefault(require("./routes/employees"));
const business_1 = __importDefault(require("./routes/business"));
const agent_actions_1 = __importDefault(require("./routes/agent-actions")); // NEW: Functional AI agents
const whatsapp_webhook_1 = __importDefault(require("./routes/whatsapp-webhook")); // NEW: WhatsApp webhook handler
const voice_webhook_1 = __importDefault(require("./routes/voice-webhook")); // NEW: Voice webhook handler
const analytics_1 = __importDefault(require("./routes/analytics")); // NEW: Analytics routes
const seed_1 = __importDefault(require("./routes/seed")); // NEW: Seed data routes
const simple_admin_1 = __importDefault(require("./routes/simple-admin")); // SIMPLE: Working admin auth
const simple_employees_1 = __importDefault(require("./routes/simple-employees")); // SIMPLE: Working employees
const simple_payments_1 = __importDefault(require("./routes/simple-payments")); // SIMPLE: Payment approvals
const whatsapp_2 = require("./whatsapp"); // NEW: WhatsApp Baileys Manager
const VonageService_1 = require("./voice/VonageService"); // NEW: Vonage Voice Service
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const app = (0, express_1.default)();
exports.app = app;
// CORS - Cleaned URLs (removed spaces)
const corsOptions = {
    origin: [
        'https://botari-frontend.vercel.app',
        'https://botari-ai.vercel.app',
        'https://botari-admin.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'Botari API is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        features: ['AI Agents', 'WhatsApp Integration', 'Voice Calls', 'Payments', 'Analytics']
    });
});
// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/conversations', conversations_1.default);
app.use('/api/conversations/list', conversations_list_1.default);
app.use('/api/messages', messages_1.default);
app.use('/api/messages/history', messages_history_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/admin/auth', admin_auth_1.default);
app.use('/api/seed', seed_1.default); // Seed data endpoints
app.use('/api/simple/admin', simple_admin_1.default); // SIMPLE: Working admin auth
app.use('/api/simple/employees', simple_employees_1.default); // SIMPLE: Working employees
app.use('/api/simple/payments', simple_payments_1.default); // SIMPLE: Payment approvals
app.use('/api/employees', employees_1.default);
app.use('/api/business', business_1.default);
app.use('/api/agents', agent_actions_1.default); // All employee actions
app.use('/api/webhook/whatsapp', whatsapp_webhook_1.default); // WhatsApp incoming messages
app.use('/api/whatsapp', whatsapp_1.default);
app.use('/telegram', telegram_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/payments/webhook', payments_webhook_1.default);
app.use('/api/calls', calls_1.default);
app.use('/api/voice/webhook', voice_webhook_1.default); // Vonage voice webhooks
app.use('/api/analytics', analytics_1.default); // Analytics API
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});
// Import migrations runner
const migrations_1 = require("./database/migrations");
// Initialize Services on startup
async function initializeServices() {
    try {
        // Run database migrations first
        await (0, migrations_1.runMigrations)();
        console.log('✅ Database migrations: Complete');
    }
    catch (error) {
        console.error('❌ Failed to run migrations:', error);
        // Continue - might be a connection issue
    }
    try {
        // Initialize Vonage Voice Service
        (0, VonageService_1.initializeVonage)();
        console.log('✅ Vonage Voice Service: Initialized');
    }
    catch (error) {
        console.error('❌ Failed to initialize Vonage Voice Service:', error);
        // Continue running - calls will fail gracefully
    }
    try {
        // Initialize Baileys Manager (restores persisted sessions from PostgreSQL)
        await whatsapp_2.baileysManager.initialize();
        console.log('✅ WhatsApp Manager: Initialized');
    }
    catch (error) {
        console.error('❌ Failed to initialize WhatsApp Manager:', error);
        // Continue running - WhatsApp can be connected later via API
    }
}
if (require.main === module) {
    const PORT = process.env.PORT || 4000;
    // Start server and initialize services
    app.listen(PORT, async () => {
        console.log(`🚀 Botari API running on port ${PORT}`);
        console.log(`🤖 AI Agents: Active`);
        console.log(`📱 WhatsApp Webhook: /api/webhook/whatsapp`);
        console.log(`📞 Voice Webhook: /api/voice/webhook`);
        console.log(`📊 Analytics API: /api/analytics`);
        // Initialize async services
        await initializeServices();
    });
}
//# sourceMappingURL=index.js.map