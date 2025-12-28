import { Request, Response } from "express";
import { register, login } from "../services/authService";

/**
 * Auth controller - handles HTTP request/response
 * Validates input, calls service, handles errors
 */

export async function registerController(req: Request, res: Response) {
  try {
    console.log("Register request received:", { email: req.body?.email });
    // Validate input
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return res
        .status(400)
        .json({ error: "Email and password must be strings" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Call service
    const result = await register({
      email: email.trim().toLowerCase(),
      password,
      role,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Register error:", error);
    if (error instanceof Error) {
      if (error.message === "User with this email already exists") {
        return res.status(409).json({ error: error.message });
      }
      // In development, show the actual error for debugging
      const isDevelopment = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Internal server error",
        message: isDevelopment ? error.message : undefined,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    console.log("Login request received:", { email: req.body?.email });
    // Validate input
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return res
        .status(400)
        .json({ error: "Email and password must be strings" });
    }

    // Call service
    const result = await login({
      email: email.trim().toLowerCase(),
      password,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error) {
      if (error.message === "Invalid email or password") {
        return res.status(401).json({ error: error.message });
      }
      // In development, show the actual error for debugging
      const isDevelopment = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Internal server error",
        message: isDevelopment ? error.message : undefined,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
