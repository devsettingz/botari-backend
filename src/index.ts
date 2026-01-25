import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Existing routes
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

// New calls route
import callsRoutes from './routes/calls';

import { processMessage } from './agent';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Botari API is running!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations/list', conversationListRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/messages/history', messageHistoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/webhook', paymentsWebhookRoutes);

// ✅ New voice calls route
app.use('/api/calls', callsRoutes);

// Direct agent reply
app.post('/api/messages-direct', async (req, res) => {
  const { text } = req.body;
  const reply = await processMessage(text);
  res.json({ reply });
});

// ✅ Export app for testing
export { app };

// ✅ Only start server if run directly (not during tests)
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Botari API running on port ${PORT}`);
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
  });
}
