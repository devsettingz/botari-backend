import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export function verifyToken(req: any, res: any, next: any) {
  // Expect token in Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded; // attach decoded user info to request
    next(); // continue to the route handler
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
