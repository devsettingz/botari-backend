"use strict";
/**
 * PostgreSQL Session Store for WhatsApp Baileys
 *
 * This module provides auth state storage in PostgreSQL for Baileys sessions.
 * It implements the auth state interface required by Baileys using database
 * persistence instead of file system storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionFromDB = getSessionFromDB;
exports.saveSessionToDB = saveSessionToDB;
exports.getSignalDataFromDB = getSignalDataFromDB;
exports.setSignalDataInDB = setSignalDataInDB;
exports.removeSignalDataFromDB = removeSignalDataFromDB;
exports.clearSessionFromDB = clearSessionFromDB;
exports.usePostgreSQLAuthState = usePostgreSQLAuthState;
exports.updateSessionStatus = updateSessionStatus;
exports.updateEmployeeStatus = updateEmployeeStatus;
exports.getAllActiveSessions = getAllActiveSessions;
exports.saveMessage = saveMessage;
const db_1 = __importDefault(require("../db"));
// ============================================================================
// DATABASE OPERATIONS
// ============================================================================
/**
 * Get session credentials from database
 */
async function getSessionFromDB(businessId, employeeId) {
    try {
        const result = await db_1.default.query(`SELECT credentials FROM whatsapp_sessions 
       WHERE business_id = $1 AND employee_id = $2`, [businessId, employeeId]);
        if (result.rows.length === 0 || !result.rows[0].credentials) {
            return null;
        }
        // Parse and convert arrays back to Uint8Arrays where needed
        return reviveCredentials(result.rows[0].credentials);
    }
    catch (error) {
        console.error('[SessionStore] Error getting session:', error);
        return null;
    }
}
/**
 * Save session credentials to database
 */
async function saveSessionToDB(businessId, employeeId, credentials) {
    try {
        // Serialize Uint8Arrays and Buffers to arrays for JSON storage
        const serialized = serializeCredentials(credentials);
        await db_1.default.query(`INSERT INTO whatsapp_sessions 
       (business_id, employee_id, credentials, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (business_id, employee_id) 
       DO UPDATE SET 
         credentials = EXCLUDED.credentials,
         updated_at = NOW()`, [businessId, employeeId, JSON.stringify(serialized)]);
    }
    catch (error) {
        console.error('[SessionStore] Error saving session:', error);
    }
}
/**
 * Get signal data (keys) from database
 */
async function getSignalDataFromDB(businessId, employeeId, type, ids) {
    const result = {};
    try {
        const dbResult = await db_1.default.query(`SELECT key_id, key_data FROM whatsapp_signal_keys 
       WHERE business_id = $1 AND employee_id = $2 AND key_type = $3 AND key_id = ANY($4)`, [businessId, employeeId, type, ids]);
        for (const row of dbResult.rows) {
            try {
                result[row.key_id] = reviveKeyData(row.key_data, type);
            }
            catch {
                result[row.key_id] = row.key_data;
            }
        }
    }
    catch (error) {
        console.error('[SessionStore] Error getting signal data:', error);
    }
    return result;
}
/**
 * Set signal data (keys) in database
 */
async function setSignalDataInDB(businessId, employeeId, type, data) {
    try {
        const client = await db_1.default.connect();
        try {
            await client.query('BEGIN');
            for (const [id, value] of Object.entries(data)) {
                const serialized = serializeKeyData(value);
                await client.query(`INSERT INTO whatsapp_signal_keys 
           (business_id, employee_id, key_type, key_id, key_data, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (business_id, employee_id, key_type, key_id) 
           DO UPDATE SET 
             key_data = EXCLUDED.key_data,
             updated_at = NOW()`, [businessId, employeeId, type, id, JSON.stringify(serialized)]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('[SessionStore] Error setting signal data:', error);
    }
}
/**
 * Remove signal data from database
 */
async function removeSignalDataFromDB(businessId, employeeId, type, ids) {
    try {
        await db_1.default.query(`DELETE FROM whatsapp_signal_keys 
       WHERE business_id = $1 AND employee_id = $2 AND key_type = $3 AND key_id = ANY($4)`, [businessId, employeeId, type, ids]);
    }
    catch (error) {
        console.error('[SessionStore] Error removing signal data:', error);
    }
}
/**
 * Clear all session data from database
 */
async function clearSessionFromDB(businessId, employeeId) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Clear credentials
        await client.query(`UPDATE whatsapp_sessions 
       SET credentials = NULL, status = 'disconnected', updated_at = NOW()
       WHERE business_id = $1 AND employee_id = $2`, [businessId, employeeId]);
        // Clear signal keys
        await client.query(`DELETE FROM whatsapp_signal_keys 
       WHERE business_id = $1 AND employee_id = $2`, [businessId, employeeId]);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('[SessionStore] Error clearing session:', error);
    }
    finally {
        client.release();
    }
}
// ============================================================================
// AUTH STATE FACTORY
// ============================================================================
/**
 * Create auth state using PostgreSQL storage
 * This implements the interface required by Baileys
 */
async function usePostgreSQLAuthState(businessId, employeeId) {
    // Get existing credentials
    const existingCreds = await getSessionFromDB(businessId, employeeId);
    // Initialize state
    const state = {
        creds: existingCreds || {
            noiseKey: { public: new Uint8Array(), private: new Uint8Array() },
            signedIdentityKey: { public: new Uint8Array(), private: new Uint8Array() },
            signedPreKey: {
                keyPair: { public: new Uint8Array(), private: new Uint8Array() },
                signature: new Uint8Array(),
                keyId: 0
            },
            registrationId: 0,
            advSecretKey: '',
            accountSyncCounter: 0,
            accountSettings: { unarchiveChats: false },
            firstUnuploadedPreKeyId: 0,
            nextPreKeyId: 0,
            processedHistoryMessages: []
        },
        keys: {
            // Getter for pre-keys
            get: async (type, ids) => {
                return getSignalDataFromDB(businessId, employeeId, type, ids);
            },
            // Setter for pre-keys
            set: async (data) => {
                for (const [type, typeData] of Object.entries(data)) {
                    if (typeData) {
                        await setSignalDataInDB(businessId, employeeId, type, typeData);
                    }
                }
            }
        }
    };
    // Save credentials function
    const saveCreds = async () => {
        await saveSessionToDB(businessId, employeeId, state.creds);
    };
    return { state, saveCreds };
}
// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================
/**
 * Serialize credentials for JSON storage
 * Converts Uint8Arrays and Buffers to arrays
 */
function serializeCredentials(creds) {
    if (creds === null || creds === undefined) {
        return creds;
    }
    if (creds instanceof Uint8Array || Buffer.isBuffer(creds)) {
        return { __type: 'Uint8Array', data: Array.from(creds) };
    }
    if (Array.isArray(creds)) {
        return creds.map(serializeCredentials);
    }
    if (typeof creds === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(creds)) {
            result[key] = serializeCredentials(value);
        }
        return result;
    }
    return creds;
}
/**
 * Revive credentials from JSON storage
 * Converts arrays back to Uint8Arrays where needed
 */
function reviveCredentials(data) {
    if (data === null || data === undefined) {
        return data;
    }
    if (data.__type === 'Uint8Array' && Array.isArray(data.data)) {
        return new Uint8Array(data.data);
    }
    if (Array.isArray(data)) {
        return data.map(reviveCredentials);
    }
    if (typeof data === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = reviveCredentials(value);
        }
        return result;
    }
    return data;
}
/**
 * Serialize key data for storage
 */
function serializeKeyData(data) {
    return serializeCredentials(data);
}
/**
 * Revive key data from storage
 */
function reviveKeyData(data, type) {
    return reviveCredentials(data);
}
// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
/**
 * Update session connection status
 */
async function updateSessionStatus(businessId, employeeId, status, phoneNumber) {
    try {
        await db_1.default.query(`INSERT INTO whatsapp_sessions 
       (business_id, employee_id, status, phone_number, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (business_id, employee_id) 
       DO UPDATE SET 
         status = EXCLUDED.status,
         phone_number = COALESCE(EXCLUDED.phone_number, whatsapp_sessions.phone_number),
         updated_at = NOW()`, [businessId, employeeId, status, phoneNumber || null]);
    }
    catch (error) {
        console.error('[SessionStore] Error updating status:', error);
    }
}
/**
 * Update employee connection status
 */
async function updateEmployeeStatus(businessId, employeeId, status, phoneNumber) {
    try {
        await db_1.default.query(`UPDATE business_employees 
       SET connection_status = $1, 
           whatsapp_number = COALESCE($2, whatsapp_number),
           updated_at = NOW()
       WHERE business_id = $3 AND employee_id = $4`, [status, phoneNumber, businessId, employeeId]);
    }
    catch (error) {
        console.error('[SessionStore] Error updating employee status:', error);
    }
}
/**
 * Get all active sessions for restoration
 */
async function getAllActiveSessions() {
    try {
        const result = await db_1.default.query(`SELECT business_id, employee_id, status, phone_number 
       FROM whatsapp_sessions 
       WHERE status IN ('connected', 'connecting', 'awaiting_qr')`);
        return result.rows;
    }
    catch (error) {
        console.error('[SessionStore] Error getting active sessions:', error);
        return [];
    }
}
/**
 * Save message to database
 */
async function saveMessage(businessId, from, to, content, direction, status = 'sent') {
    try {
        await db_1.default.query(`INSERT INTO whatsapp_messages 
       (business_id, sender, recipient, content, direction, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`, [businessId, from, to, content, direction, status]);
    }
    catch (error) {
        console.error('[SessionStore] Error saving message:', error);
    }
}
exports.default = {
    usePostgreSQLAuthState,
    updateSessionStatus,
    updateEmployeeStatus,
    getAllActiveSessions,
    saveMessage,
    clearSessionFromDB
};
//# sourceMappingURL=sessionStore.js.map