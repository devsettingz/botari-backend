import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import { Pool } from 'pg';
import { routeMessage } from '../agent';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PHONE_TO_BUSINESS = new Map<string, number>();

export async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startWhatsApp();
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid!;
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message?.imageMessage?.caption || '';

    if (!text.trim()) return;

    console.log(`📩 WhatsApp from ${sender}: ${text}`);

    try {
      const businessId = PHONE_TO_BUSINESS.get(sender) || 1;
      const reply = await routeMessage(text, sender, 'whatsapp', businessId);
      await sock.sendMessage(sender, { text: reply });
      console.log(`✅ Replied: ${reply.substring(0, 50)}`);
    } catch (error) {
      console.error('❌ WhatsApp error:', error);
      await sock.sendMessage(sender, { 
        text: "Sorry, I'm having technical difficulties. Please try again shortly." 
      });
    }
  });
}

export function linkPhoneToBusiness(phone: string, businessId: number) {
  PHONE_TO_BUSINESS.set(phone, businessId);
}