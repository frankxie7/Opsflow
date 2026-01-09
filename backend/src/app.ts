import express from "express";
import { pool } from "./db";
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.get("/db-check", async (_, res) => {
  try {
    const result = await pool.query("SELECT 1");
    res.json({ db: "connected" });
  } catch (error) {
    console.error("DB check error:", error);
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
