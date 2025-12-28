import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db";

app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role",
    [email, hash]
  );
  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
  res.json({ token, user });
});
