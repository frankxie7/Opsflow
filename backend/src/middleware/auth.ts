import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import "./types"; // Ensure Express Request type extension is loaded
import { AuthUser } from "./types";

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 * Returns 401 if token is missing or invalid
 */

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Authorization header required" });
      return;
    }

    // Extract token from "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({ error: "Invalid authorization header format" });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    // Extract user info from token payload
    // Token payload should have: { id: number, role: UserRole }
    if (!decoded.id || !decoded.role) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    // Attach user to request
    req.user = {
      id: decoded.id as number,
      role: decoded.role as AuthUser["role"],
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
