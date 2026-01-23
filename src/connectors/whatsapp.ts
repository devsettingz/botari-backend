import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  AnyMessageContent
} from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import { processMessage } from '../agent';   // ✅ fixed import

export async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed, reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connection established');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid!;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      '';

    if (text.trim()) {
      console.log(`📩 WhatsApp message from ${sender}: ${text}`);

      const reply = await processMessage(text);

      await sock.sendMessage(sender, { text: reply });
      console.log(`🤖 Reply sent to ${sender}: ${reply}`);
    }
  });
}
