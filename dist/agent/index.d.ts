/**
 * AI Agent Core with Function Calling Support
 * Botari AI - Functional AI Employees
 *
 * This module handles AI processing with the ability to:
 * 1. Parse user intent to determine which action to call
 * 2. Call the appropriate action handler
 * 3. Include action results in AI context for response generation
 * 4. Return both reply and executed actions
 */
import { getEmployeeActions, getEmployeeTools, ALL_ACTIONS } from './actions';
import { PERSONAS, PersonaDefinition } from './personas';
import { BusinessContext, AgentResponse, ExecutedAction, ActionResult } from './types';
type EmployeeType = keyof typeof PERSONAS;
export declare function processMessage(text: string, userId: string, employeeType?: EmployeeType, businessContext?: any, channel?: string): Promise<AgentResponse>;
export declare function routeMessage(text: string, userId: string, channel: string, businessId: number): Promise<string>;
export declare function executeAction(actionName: string, params: any, context: BusinessContext): Promise<ActionResult>;
export { PERSONAS, ALL_ACTIONS, getEmployeeActions, getEmployeeTools };
export type { EmployeeType, BusinessContext, AgentResponse, ExecutedAction };
declare const _default: {
    processMessage: typeof processMessage;
    routeMessage: typeof routeMessage;
    executeAction: typeof executeAction;
    PERSONAS: {
        [key: string]: PersonaDefinition;
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map