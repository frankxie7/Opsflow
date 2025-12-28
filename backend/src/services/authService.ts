import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail } from "../db/users";
import { User } from "../db/types";

/**
 * Auth service - handles business logic for authentication
 * No HTTP handling, no database access (uses db functions)
 */

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = "1h";

export interface RegisterInput {
  email: string;
  password: string;
  role?: "admin" | "operator" | "viewer";
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: Omit<User, "password_hash">;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  // Check if user already exists
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, 10);

  // Create user
  const user = await createUser({
    email: input.email,
    password_hash: passwordHash,
    role: input.role || "viewer",
  });

  // Generate token
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  // Return user without password hash
  const { password_hash, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  // Find user by email
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check password
  const passwordMatch = await bcrypt.compare(
    input.password,
    user.password_hash
  );
  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  // Generate token
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  // Return user without password hash
  const { password_hash, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
  };
}
