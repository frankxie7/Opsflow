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

    // Add missing columns if table already exists (for schema updates)
    await addMissingColumns();

    console.log("Database schema initialized successfully");
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a "relation already exists" error (schema already initialized)
      if (error.message.includes("already exists")) {
        console.log(
          "Database schema already exists, applying schema updates..."
        );
        await addMissingColumns();
        return;
      }
      throw new Error(`Migration failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Add missing columns to existing tables to match schema.sql
 */
async function addMissingColumns(): Promise<void> {
  // Check if users table exists
  const tableExists = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'users'
    )
  `);

  if (!tableExists.rows[0].exists) {
    return; // Table doesn't exist yet, schema.sql will create it
  }

  // Ensure the update function exists
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Check if users.updated_at exists, add if missing
  const checkColumn = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'updated_at'
  `);

  if (checkColumn.rows.length === 0) {
    console.log("Adding updated_at column to users table...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `);
  }

  // Ensure trigger exists (drop and recreate to avoid conflicts)
  await pool.query(`
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
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
