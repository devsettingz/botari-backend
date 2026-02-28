/**
 * PostgreSQL Session Store for WhatsApp Baileys
 *
 * This module provides auth state storage in PostgreSQL for Baileys sessions.
 * It implements the auth state interface required by Baileys using database
 * persistence instead of file system storage.
 */
import { AuthenticationState, SignalDataTypeMap, AuthenticationCreds } from '@adiwajshing/baileys';
/**
 * Get session credentials from database
 */
export declare function getSessionFromDB(businessId: number, employeeId: number): Promise<AuthenticationCreds | null>;
/**
 * Save session credentials to database
 */
export declare function saveSessionToDB(businessId: number, employeeId: number, credentials: AuthenticationCreds): Promise<void>;
/**
 * Get signal data (keys) from database
 */
export declare function getSignalDataFromDB(businessId: number, employeeId: number, type: keyof SignalDataTypeMap, ids: string[]): Promise<{
    [id: string]: SignalDataTypeMap[typeof type];
}>;
/**
 * Set signal data (keys) in database
 */
export declare function setSignalDataInDB(businessId: number, employeeId: number, type: keyof SignalDataTypeMap, data: {
    [id: string]: SignalDataTypeMap[typeof type];
}): Promise<void>;
/**
 * Remove signal data from database
 */
export declare function removeSignalDataFromDB(businessId: number, employeeId: number, type: keyof SignalDataTypeMap, ids: string[]): Promise<void>;
/**
 * Clear all session data from database
 */
export declare function clearSessionFromDB(businessId: number, employeeId: number): Promise<void>;
/**
 * Create auth state using PostgreSQL storage
 * This implements the interface required by Baileys
 */
export declare function usePostgreSQLAuthState(businessId: number, employeeId: number): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
}>;
/**
 * Update session connection status
 */
export declare function updateSessionStatus(businessId: number, employeeId: number, status: string, phoneNumber?: string): Promise<void>;
/**
 * Update employee connection status
 */
export declare function updateEmployeeStatus(businessId: number, employeeId: number, status: string, phoneNumber?: string): Promise<void>;
/**
 * Get all active sessions for restoration
 */
export declare function getAllActiveSessions(): Promise<Array<{
    business_id: number;
    employee_id: number;
    status: string;
    phone_number?: string;
}>>;
/**
 * Save message to database
 */
export declare function saveMessage(businessId: number, from: string, to: string, content: string, direction: 'incoming' | 'outgoing', status?: 'sent' | 'delivered' | 'read' | 'failed'): Promise<void>;
declare const _default: {
    usePostgreSQLAuthState: typeof usePostgreSQLAuthState;
    updateSessionStatus: typeof updateSessionStatus;
    updateEmployeeStatus: typeof updateEmployeeStatus;
    getAllActiveSessions: typeof getAllActiveSessions;
    saveMessage: typeof saveMessage;
    clearSessionFromDB: typeof clearSessionFromDB;
};
export default _default;
//# sourceMappingURL=sessionStore.d.ts.map