// TypeScript type extensions for Express Request
// This allows us to attach user info to the request object

import { Request } from "express";
import { UserRole } from "../db/types";

export interface AuthUser {
  id: number;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
