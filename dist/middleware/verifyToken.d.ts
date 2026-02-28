import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    id: number;
    business_id: number;
    role: string;
    email?: string;
}
export interface AuthRequest extends Request {
    user?: AuthPayload;
}
export declare function verifyToken(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
//# sourceMappingURL=verifyToken.d.ts.map