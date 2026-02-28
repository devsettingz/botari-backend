/**
 * AI Agent Actions System - Action Handlers
 * Botari AI - Functional AI Employees
 *
 * All business action handlers for inventory, appointments, orders, customers, and communication
 */
import { ActionHandler, OpenAIFunction } from './types';
export declare const ALL_ACTIONS: ActionHandler[];
export declare const EMPLOYEE_ACTIONS: {
    [key: string]: string[];
};
export declare function getEmployeeActions(employeeType: string): ActionHandler[];
export declare function getAction(name: string): ActionHandler | undefined;
export declare function actionToOpenAIFunction(action: ActionHandler): OpenAIFunction;
export declare function getEmployeeTools(employeeType: string): OpenAIFunction[];
//# sourceMappingURL=actions.d.ts.map