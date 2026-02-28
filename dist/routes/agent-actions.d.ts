/**
 * AI Agent Actions API Routes
 * Botari AI - Functional AI Employees
 *
 * Endpoints:
 * - POST /execute - Execute a specific action
 * - GET /:employeeId/actions - Get available actions for an employee
 * - POST /process-message - Process message with AI and function calling
 * - GET /:employeeType/stats - Get agent statistics
 *
 * Action Categories:
 * - Inventory: check_inventory, update_inventory, check_price
 * - Appointments: check_availability, book_appointment, cancel_appointment, list_appointments
 * - Orders: take_order, check_order_status, cancel_order
 * - Customers: find_customer, create_customer, update_customer
 * - Communication: send_email, schedule_followup, escalate_to_human
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=agent-actions.d.ts.map