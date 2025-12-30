import { Request, Response, NextFunction } from "express";
import "./types"; // Ensure Express Request type extension is loaded
import { UserRole } from "../db/types";

/**
 * Role-based access control middleware
 * Checks if the authenticated user has one of the required roles
 * Must be used after authenticate() middleware
 */

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Ensure user is authenticated (should be set by authenticate middleware)
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Check if user's role is in the allowed roles list
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Insufficient permissions",
        message: `This action requires one of: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}
