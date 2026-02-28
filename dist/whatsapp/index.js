"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMessage = exports.getAllActiveSessions = exports.updateEmployeeStatus = exports.updateSessionStatus = exports.clearSessionFromDB = exports.removeSignalDataFromDB = exports.setSignalDataInDB = exports.getSignalDataFromDB = exports.saveSessionToDB = exports.getSessionFromDB = exports.usePostgreSQLAuthState = exports.baileysManager = exports.BaileysManager = void 0;
// Main BaileysManager class and singleton
var BaileysManager_1 = require("./BaileysManager");
Object.defineProperty(exports, "BaileysManager", { enumerable: true, get: function () { return BaileysManager_1.BaileysManager; } });
Object.defineProperty(exports, "baileysManager", { enumerable: true, get: function () { return BaileysManager_1.baileysManager; } });
// Session store utilities
var sessionStore_1 = require("./sessionStore");
Object.defineProperty(exports, "usePostgreSQLAuthState", { enumerable: true, get: function () { return sessionStore_1.usePostgreSQLAuthState; } });
Object.defineProperty(exports, "getSessionFromDB", { enumerable: true, get: function () { return sessionStore_1.getSessionFromDB; } });
Object.defineProperty(exports, "saveSessionToDB", { enumerable: true, get: function () { return sessionStore_1.saveSessionToDB; } });
Object.defineProperty(exports, "getSignalDataFromDB", { enumerable: true, get: function () { return sessionStore_1.getSignalDataFromDB; } });
Object.defineProperty(exports, "setSignalDataInDB", { enumerable: true, get: function () { return sessionStore_1.setSignalDataInDB; } });
Object.defineProperty(exports, "removeSignalDataFromDB", { enumerable: true, get: function () { return sessionStore_1.removeSignalDataFromDB; } });
Object.defineProperty(exports, "clearSessionFromDB", { enumerable: true, get: function () { return sessionStore_1.clearSessionFromDB; } });
Object.defineProperty(exports, "updateSessionStatus", { enumerable: true, get: function () { return sessionStore_1.updateSessionStatus; } });
Object.defineProperty(exports, "updateEmployeeStatus", { enumerable: true, get: function () { return sessionStore_1.updateEmployeeStatus; } });
Object.defineProperty(exports, "getAllActiveSessions", { enumerable: true, get: function () { return sessionStore_1.getAllActiveSessions; } });
Object.defineProperty(exports, "saveMessage", { enumerable: true, get: function () { return sessionStore_1.saveMessage; } });
//# sourceMappingURL=index.js.map