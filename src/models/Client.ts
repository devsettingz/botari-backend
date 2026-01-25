export interface Client {
  id: string;              // Unique client ID
  name: string;            // Client name
  apiKey: string;          // API key for authentication
  whatsappSessionId?: string; // WhatsApp session ID (if using whatsapp-web.js)
  callPreferences?: {
    defaultVoice?: 'male' | 'female';
  };
}
