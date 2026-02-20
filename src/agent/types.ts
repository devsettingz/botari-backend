/**
 * AI Agent Actions System - Type Definitions
 * Botari AI - Functional AI Employees
 */

// Business context passed to all action handlers
export interface BusinessContext {
  business_id: number;
  business_name?: string;
  conversation_id?: number;
  customer_phone?: string;
  employee_id?: number;
  employee_name?: string;
  employee_type?: string;
  channel?: string;
}

// Result returned by action execution
export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Action handler definition
export interface ActionHandler {
  name: string;
  description: string;
  parameters: ActionParameter[];
  execute: (params: any, context: BusinessContext) => Promise<ActionResult>;
}

// Parameter definition for actions
export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  enum?: string[]; // For enum parameters
}

// OpenAI Function Schema
export interface OpenAIFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

// Executed action record
export interface ExecutedAction {
  name: string;
  params: any;
  result: ActionResult;
  timestamp: Date;
}

// Action registry for employee types
export interface EmployeeActions {
  [employeeType: string]: string[]; // List of action names this employee can perform
}

// Agent response structure
export interface AgentResponse {
  reply: string;
  actions: ExecutedAction[];
  intent?: string;
}

// Product type
export interface Product {
  id: number;
  business_id: number;
  name: string;
  price: number;
  stock_quantity: number;
  description?: string;
  category?: string;
  sku?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Appointment type
export interface Appointment {
  id: number;
  business_id: number;
  customer_phone: string;
  employee_id?: number;
  scheduled_at: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  duration_minutes?: number;
  service_name?: string;
  created_at: Date;
  updated_at: Date;
}

// Order item type
export interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Order type
export interface Order {
  id: number;
  business_id: number;
  customer_phone: string;
  items: OrderItem[];
  total_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Customer type
export interface Customer {
  id: number;
  business_id: number;
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  notes?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

// Follow-up reminder type
export interface FollowUp {
  id: number;
  business_id: number;
  customer_phone: string;
  scheduled_at: Date;
  notes: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_by: string;
  created_at: Date;
}
