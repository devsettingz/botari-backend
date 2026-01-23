export function requireRole(role: string) {
  return function (req: any, res: any, next: any) {
    // req.user is set by verifyToken middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: no user found' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied: requires ${role} role` });
    }

    next(); // ✅ user has the required role
  };
}
