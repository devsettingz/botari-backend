/**
 * Calls API Routes
 * Botari AI - Voice Call Management
 *
 * Endpoints:
 * - POST /calls/outbound - Make outbound call
 * - GET /calls - List call history
 * - GET /calls/active - Get active calls
 * - GET /calls/analytics - Get call analytics
 * - GET /calls/:id - Get call details
 * - POST /calls/:id/end - End active call
 * - POST /calls/:id/record - Start recording
 * - POST /calls/:id/transfer - Transfer call
 * - POST /calls/:id/hold - Put call on hold
 * - POST /calls/:id/resume - Resume from hold
 * - POST /calls/:id/summary - Generate AI summary
 * - DELETE /calls/:id - Delete call record
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=calls.d.ts.map