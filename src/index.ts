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

// Import agent
import { processMessage } from './agent';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// CORS - CRITICAL FIX: Allow your Vercel frontend
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
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint for CORS
app.get('/api/test', (req, res) => {
  res.json({ message: 'CORS is working!' });
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
app.use('/whatsapp', whatsappRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/webhook', paymentsWebhookRoutes);
app.use('/api/calls', callsRoutes);

// Direct agent test endpoint - FIXED: Correct argument count and return type
app.post('/api/messages-direct', async (req, res) => {
  const { text, employee } = req.body;
  try {
    // FIXED: processMessage likely takes (message, userId, employeeId) or similar
    // Check your agent.ts to confirm, but assuming it returns string directly
    const reply = await processMessage(text, employee || 'amina');
    
    // FIXED: reply is likely a string, not an object with .reply property
    res.json({ reply: reply });
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'Agent error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export { app };

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Botari API running on port ${PORT}`);
    console.log(`📍 CORS enabled for: ${corsOptions.origin.join(', ')}`);
  });
}