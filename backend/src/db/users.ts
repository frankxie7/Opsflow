import { pool } from "./index";
import { User, CreateUserInput } from "./types";

/**
 * Database access functions for users table
 * No business logic here - just database operations
 */

export async function createUser(input: CreateUserInput): Promise<User> {
  const result = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, password_hash, role, created_at, updated_at",
    [input.email, input.password_hash, input.role || "viewer"]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query(
    "SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1",
    [email]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

export async function findUserById(id: number): Promise<User | null> {
  const result = await pool.query(
    "SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

