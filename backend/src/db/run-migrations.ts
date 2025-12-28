#!/usr/bin/env node
/**
 * Standalone script to run database migrations
 * Usage: npm run migrate or ts-node src/db/run-migrations.ts
 */

import { runMigrations } from "./migrate";
import { pool } from "./index";

async function main() {
  try {
    console.log("Checking database connection...");
    await pool.query("SELECT 1");

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
