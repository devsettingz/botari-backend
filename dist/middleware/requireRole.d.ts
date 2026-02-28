import { Response, NextFunction } from 'express';
import { AuthRequest, AuthPayload } from './verifyToken';
export declare function requireRole(role: AuthPayload['role']): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
//# sourceMappingURL=requireRole.d.ts.map