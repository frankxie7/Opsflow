import { pool } from "./index";
import { AuditLog, CreateAuditLogInput } from "./types";

/**
 * Database access functions for audit_logs table
 * No business logic here - just database operations
 */

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const result = await pool.query(
    `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, entity_type, entity_id, action, user_id, metadata, created_at`,
    [
      input.entity_type,
      input.entity_id,
      input.action,
      input.user_id || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return {
    ...result.rows[0],
    metadata: result.rows[0].metadata ? JSON.parse(result.rows[0].metadata) : null,
  };
}

export async function findAuditLogsByEntity(
  entityType: string,
  entityId: number
): Promise<AuditLog[]> {
  const result = await pool.query(
    `SELECT id, entity_type, entity_id, action, user_id, metadata, created_at
     FROM audit_logs
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return result.rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

export async function findAuditLogsByUser(userId: number): Promise<AuditLog[]> {
  const result = await pool.query(
    `SELECT id, entity_type, entity_id, action, user_id, metadata, created_at
     FROM audit_logs
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}
