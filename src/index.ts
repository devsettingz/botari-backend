import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';
import conversationRoutes from './routes/conversations';
import messageHistoryRoutes from './routes/messages-history';
import conversationListRoutes from './routes/conversations-list';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import whatsappRoutes from './routes/whatsapp';
import telegramRoutes from './routes/telegram';
import subscriptionRoutes from './routes/subscriptions';
import paymentRoutes from './routes/payments';
import paymentsWebhookRoutes from './routes/payments-webhook';
import callsRoutes from './routes/calls';
import employeeRoutes from './routes/employees';
import businessRoutes from './routes/business';
import agentActionsRoutes from './routes/agent-actions'; // NEW: Functional AI agents
import whatsappWebhookRoutes from './routes/whatsapp-webhook'; // NEW: WhatsApp webhook handler
import voiceWebhookRoutes from './routes/voice-webhook'; // NEW: Voice webhook handler
import analyticsRoutes from './routes/analytics'; // NEW: Analytics routes
import { baileysManager } from './whatsapp'; // NEW: WhatsApp Baileys Manager
import { initializeVonage } from './voice/VonageService'; // NEW: Vonage Voice Service

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// CORS - Cleaned URLs (removed spaces)
const corsOptions = {
  origin: [
    'https://botari-frontend.vercel.app',
    'https://botari-ai.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

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
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations/list', conversationListRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/messages/history', messageHistoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/agents', agentActionsRoutes); // All employee actions
app.use('/api/webhook/whatsapp', whatsappWebhookRoutes); // WhatsApp incoming messages
app.use('/api/whatsapp', whatsappRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/webhook', paymentsWebhookRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/voice/webhook', voiceWebhookRoutes); // Vonage voice webhooks
app.use('/api/analytics', analyticsRoutes); // Analytics API

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export { app };

// Initialize Services on startup
async function initializeServices(): Promise<void> {
  try {
    // Initialize Vonage Voice Service
    initializeVonage();
    console.log('🔊 Vonage Voice Service: Initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Vonage Voice Service:', error);
    // Continue running - calls will fail gracefully
  }

  try {
    // Initialize Baileys Manager (restores persisted sessions from PostgreSQL)
    await baileysManager.initialize();
    console.log('📱 WhatsApp Manager: Initialized');
  } catch (error) {
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
    console.log(`🔊 Voice Webhook: /api/voice/webhook`);
    console.log(`📊 Analytics API: /api/analytics`);
    
    // Initialize async services
    await initializeServices();
  });
}