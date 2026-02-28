/**
 * AI Employee Personas
 * Botari AI - Comprehensive AI Employee Roster
 *
 * This module defines all available AI employee personas with their
 * unique capabilities, personalities, and pricing tiers.
 */
export interface PersonaDefinition {
    name: string;
    displayName: string;
    role: string;
    description: string;
    tier: 'starter' | 'professional' | 'premium' | 'enterprise';
    priceMonthly: number;
    colorTheme: string;
    iconEmoji: string;
    languages: string[];
    tools: string[];
    features: string[];
    prompt: string;
}
export declare const PERSONAS: {
    [key: string]: PersonaDefinition;
};
/**
 * Get all personas as an array
 */
export declare function getAllPersonas(): PersonaDefinition[];
/**
 * Get personas filtered by tier
 */
export declare function getPersonasByTier(tier: PersonaDefinition['tier']): PersonaDefinition[];
/**
 * Get a single persona by key
 */
export declare function getPersona(key: string): PersonaDefinition | undefined;
/**
 * Get all available tiers with their display info
 */
export declare const TIERS: {
    starter: {
        name: string;
        price: number;
        description: string;
        color: string;
    };
    professional: {
        name: string;
        price: number;
        description: string;
        color: string;
    };
    premium: {
        name: string;
        price: number;
        description: string;
        color: string;
    };
    enterprise: {
        name: string;
        price: number;
        description: string;
        color: string;
    };
};
/**
 * Get tools for a specific employee type
 * Used by the agent system to determine available actions
 */
export declare function getEmployeeTools(employeeType: string): string[];
/**
 * Get features array for SQL seeding
 */
export declare function getPersonaFeaturesArray(personaKey: string): string[];
export default PERSONAS;
//# sourceMappingURL=personas.d.ts.map