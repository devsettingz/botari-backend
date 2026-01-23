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
import { processMessage } from '../../botari-agent/src/index';

// Load env explicitly
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Botari API is running!' });
});

// Auth routes (register + login)
app.use('/api/auth', authRoutes);

// Conversations routes (create new chat)
app.use('/api/conversations', conversationRoutes);

// Conversations list routes (all chats for a business)
app.use('/api/conversations/list', conversationListRoutes);

// Messages routes (save + reply)
app.use('/api/messages', messageRoutes);

// Messages history routes (fetch chat logs)
app.use('/api/messages/history', messageHistoryRoutes);

// Dashboard routes (summary stats + trends, protected by JWT)
app.use('/api/dashboard', dashboardRoutes);

// Admin routes (owner-only, protected by JWT + role)
app.use('/api/admin', adminRoutes);

// WhatsApp webhook routes
app.use('/whatsapp', whatsappRoutes);

// Telegram webhook routes
app.use('/telegram', telegramRoutes);

// Subscription routes (plan management)
app.use('/api/subscriptions', subscriptionRoutes);

// Payment routes (billing + transactions)
app.use('/api/payments', paymentRoutes);

// Payment webhook routes (Stripe, Paystack, Flutterwave, etc.)
app.use('/api/payments/webhook', paymentsWebhookRoutes);

// Direct agent reply (legacy route)
app.post('/api/messages-direct', async (req, res) => {
  const { text } = req.body;
  const reply = await processMessage(text);
  res.json({ reply });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Botari API running on port ${PORT}`);
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
});
