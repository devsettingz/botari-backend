declare namespace Express {
  export interface Request {
    user?: {
      id: number;
      business_id: number;
      role: string;
      email?: string;
    };
  }
}
