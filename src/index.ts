import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

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

// ✅ Now importing from your new local agent folder
import { processMessage } from './agent';

// Load environment variables (works locally, Render injects automatically)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Botari API is running!' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Conversations routes
app.use('/api/conversations', conversationRoutes);

// Conversations list routes
app.use('/api/conversations/list', conversationListRoutes);

// Messages routes
app.use('/api/messages', messageRoutes);

// Messages history routes
app.use('/api/messages/history', messageHistoryRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// WhatsApp webhook routes
app.use('/whatsapp', whatsappRoutes);

// Telegram webhook routes
app.use('/telegram', telegramRoutes);

// Subscription routes
app.use('/api/subscriptions', subscriptionRoutes);

// Payment routes
app.use('/api/payments', paymentRoutes);

// Payment webhook routes
app.use('/api/payments/webhook', paymentsWebhookRoutes);

// Direct agent reply (self-contained now)
app.post('/api/messages-direct', async (req, res) => {
  const { text } = req.body;
  const reply = await processMessage(text);
  res.json({ reply });
});

// ✅ Use Render’s injected PORT
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Botari API running on port ${PORT}`);
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
});
