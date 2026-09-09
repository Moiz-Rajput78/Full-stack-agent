import "express";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        authUserId: string;
        email?: string;
        name?: string;
        userId: string;
        token: Record<string, unknown>;
      };
    }
  }
}

export {};