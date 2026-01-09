import { pool } from "./index";
import { Task, CreateTaskInput } from "./types";

/**
 * Database access functions for tasks table
 * No business logic here - just database operations
 */

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const result = await pool.query(
    `INSERT INTO tasks (
      raw_message_id, category, urgency, summary, status, 
      assigned_to, ai_confidence, requires_review
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, raw_message_id, category, urgency, summary, status, 
              assigned_to, ai_confidence, requires_review, 
              created_at, updated_at, completed_at`,
    [
      input.raw_message_id,
      input.category || null,
      input.urgency || null,
      input.summary || null,
      input.status || "new",
      input.assigned_to || null,
      input.ai_confidence || null,
      input.requires_review || false,
    ]
  );
  return result.rows[0];
}

export async function findTaskById(id: number): Promise<Task | null> {
  const result = await pool.query(
    `SELECT id, raw_message_id, category, urgency, summary, status, 
            assigned_to, ai_confidence, requires_review, 
            created_at, updated_at, completed_at
     FROM tasks WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

export async function findTasksByAssignedTo(
  userId: number
): Promise<Task[]> {
  const result = await pool.query(
    `SELECT id, raw_message_id, category, urgency, summary, status, 
            assigned_to, ai_confidence, requires_review, 
            created_at, updated_at, completed_at
     FROM tasks 
     WHERE assigned_to = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function findTasksByStatus(status: string): Promise<Task[]> {
  const result = await pool.query(
    `SELECT id, raw_message_id, category, urgency, summary, status, 
            assigned_to, ai_confidence, requires_review, 
            created_at, updated_at, completed_at
     FROM tasks 
     WHERE status = $1
     ORDER BY created_at DESC`,
    [status]
  );
  return result.rows;
}

export async function findAllTasks(): Promise<Task[]> {
  const result = await pool.query(
    `SELECT id, raw_message_id, category, urgency, summary, status, 
            assigned_to, ai_confidence, requires_review, 
            created_at, updated_at, completed_at
     FROM tasks 
     ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function updateTaskStatus(
  id: number,
  status: string,
  completedAt?: Date | null
): Promise<Task | null> {
  const result = await pool.query(
    `UPDATE tasks 
     SET status = $1, completed_at = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, raw_message_id, category, urgency, summary, status, 
               assigned_to, ai_confidence, requires_review, 
               created_at, updated_at, completed_at`,
    [status, completedAt, id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

export async function updateTaskAssignment(
  id: number,
  assignedTo: number | null
): Promise<Task | null> {
  const result = await pool.query(
    `UPDATE tasks 
     SET assigned_to = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, raw_message_id, category, urgency, summary, status, 
               assigned_to, ai_confidence, requires_review, 
               created_at, updated_at, completed_at`,
    [assignedTo, id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

export async function updateTask(
  id: number,
  updates: {
    category?: string | null;
    urgency?: string | null;
    summary?: string | null;
    status?: string;
    assigned_to?: number | null;
    requires_review?: boolean;
  }
): Promise<Task | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    values.push(updates.category);
  }
  if (updates.urgency !== undefined) {
    fields.push(`urgency = $${paramIndex++}`);
    values.push(updates.urgency);
  }
  if (updates.summary !== undefined) {
    fields.push(`summary = $${paramIndex++}`);
    values.push(updates.summary);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.assigned_to !== undefined) {
    fields.push(`assigned_to = $${paramIndex++}`);
    values.push(updates.assigned_to);
  }
  if (updates.requires_review !== undefined) {
    fields.push(`requires_review = $${paramIndex++}`);
    values.push(updates.requires_review);
  }

  if (fields.length === 0) {
    return findTaskById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE tasks 
     SET ${fields.join(", ")}
     WHERE id = $${paramIndex}
     RETURNING id, raw_message_id, category, urgency, summary, status, 
               assigned_to, ai_confidence, requires_review, 
               created_at, updated_at, completed_at`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}
