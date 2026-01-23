import { Response, NextFunction } from 'express';
import { AuthRequest, AuthPayload } from './verifyToken';

export function requireRole(role: AuthPayload['role']) {
  return function (req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: no user found' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied: requires ${role} role` });
    }

    next(); // ✅ user has the required role
  };
}
