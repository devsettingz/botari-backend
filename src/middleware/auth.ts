import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';

export interface AuthUser {
  user_id: number;
  business_id: number;
  role: string;
  email?: string;
}

// Middleware to verify JWT and attach user payload
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    // Attach decoded user info to req.user
    (req as any).user = {
      id: decoded.user_id,
      business_id: decoded.business_id,
      role: decoded.role,
      email: decoded.email || ''
    };

    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
