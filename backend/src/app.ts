import express from "express";
import { pool } from "./db";
import { redis } from "./queues/redis";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.get("/db-check", async (_, res) => {
  const result = await pool.query("SELECT 1");
  res.json({ db: "connected" });
});

app.get("/redis-check", async (_, res) => {
  await redis.set("ping", "pong");
  const value = await redis.get("ping");
  res.json({ redis: value });
});

export default app;
