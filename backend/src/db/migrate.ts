import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./index";

/**
 * Initialize database schema by running schema.sql
 * This is a simple migration runner - for production, consider using a proper migration tool
 */
export async function runMigrations(): Promise<void> {
  try {
    const schemaPath = join(__dirname, "schema.sql");
    const schemaSQL = readFileSync(schemaPath, "utf-8");

    // Execute the entire schema file
    await pool.query(schemaSQL);

    console.log("Database schema initialized successfully");
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a "relation already exists" error (schema already initialized)
      if (error.message.includes("already exists")) {
        console.log("Database schema already exists, skipping initialization");
        return;
      }
      throw new Error(`Migration failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if schema is initialized by checking for existence of a key table
 */
export async function isSchemaInitialized(): Promise<boolean> {
  try {
    await pool.query("SELECT 1 FROM users LIMIT 1");
    return true;
  } catch {
    return false;
  }
}
