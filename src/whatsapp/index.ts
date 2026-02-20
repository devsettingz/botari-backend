/**
 * WhatsApp Module for Botari AI
 * 
 * This module provides WhatsApp integration using the Baileys library.
 * 
 * @example
 * ```typescript
 * import { baileysManager } from './whatsapp';
 * 
 * // Connect a business
 * const { qrCode } = await baileysManager.connect(businessId, employeeId);
 * 
 * // Send a message
 * await baileysManager.sendMessage(businessId, '+1234567890', 'Hello!');
 * ```
 */

// Main BaileysManager class and singleton
export { BaileysManager, baileysManager } from './BaileysManager';
export type { 
  ConnectionStatus, 
  WhatsAppSession, 
  ConnectionQR, 
  SessionInfo 
} from './BaileysManager';

// Session store utilities
export {
  usePostgreSQLAuthState,
  getSessionFromDB,
  saveSessionToDB,
  getSignalDataFromDB,
  setSignalDataInDB,
  removeSignalDataFromDB,
  clearSessionFromDB,
  updateSessionStatus,
  updateEmployeeStatus,
  getAllActiveSessions,
  saveMessage
} from './sessionStore';
