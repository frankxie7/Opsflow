import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "app",
  password: process.env.DB_PASSWORD || "app",
  database: process.env.DB_NAME || "ops_ai",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

// Export migration functions
export { runMigrations, isSchemaInitialized } from "./migrate";

// Export types
export * from "./types";
