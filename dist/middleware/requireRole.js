"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(role) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: no user found' });
        }
        if (req.user.role !== role) {
            return res.status(403).json({ error: `Access denied: requires ${role} role` });
        }
        next(); // ✅ user has the required role
    };
}
//# sourceMappingURL=requireRole.js.map