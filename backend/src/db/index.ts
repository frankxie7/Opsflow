import { Pool } from "pg";

export const pool = new Pool({
  host: "localhost",
  user: "app",
  password: "app",
  database: "ops_ai",
  port: 5432,
});
