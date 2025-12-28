#!/usr/bin/env node
/**
 * Standalone script to run database migrations
 * Usage: npm run migrate or ts-node src/db/run-migrations.ts
 */

import { runMigrations, isSchemaInitialized } from "./migrate";
import { pool } from "./index";

async function main() {
  try {
    console.log("Checking database connection...");
    await pool.query("SELECT 1");

    const initialized = await isSchemaInitialized();
    if (initialized) {
      console.log("Schema already initialized");
      process.exit(0);
    }

    console.log("Running migrations...");
    await runMigrations();
    console.log("Migrations completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
