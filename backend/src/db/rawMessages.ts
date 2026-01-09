import { pool } from "./index";
import { RawMessage, CreateRawMessageInput } from "./types";

/**
 * Database access functions for raw_messages table
 * Append-only storage - no updates or deletes
 * No business logic here - just database operations
 */

export async function createRawMessage(
  input: CreateRawMessageInput
): Promise<RawMessage> {
  try {
    const result = await pool.query(
      `INSERT INTO raw_messages (
        source, channel, channel_id, sender, sender_id, 
        text, raw_payload, timestamp, slack_message_ts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, source, channel, channel_id, sender, sender_id, 
                text, raw_payload, timestamp, slack_message_ts, created_at`,
      [
        input.source || "slack",
        input.channel,
        input.channel_id || null,
        input.sender,
        input.sender_id || null,
        input.text,
        input.raw_payload, // PostgreSQL JSONB accepts objects directly
        input.timestamp,
        input.slack_message_ts || null,
      ]
    );
    // PostgreSQL JSONB columns return as objects, not strings
    // No need to parse - it's already an object
    return {
      ...result.rows[0],
      raw_payload: result.rows[0].raw_payload, // Already an object from JSONB
    };
  } catch (error) {
    // Add better error context
    if (error instanceof Error) {
      console.error("Database error in createRawMessage:", error.message);
      if ('code' in error) {
        console.error("PostgreSQL error code:", (error as { code?: string }).code);
      }
      // Re-throw with more context
      throw new Error(`Failed to create raw message: ${error.message}`);
    }
    throw error;
  }
}

export async function findRawMessageById(id: number): Promise<RawMessage | null> {
  const result = await pool.query(
    `SELECT id, source, channel, channel_id, sender, sender_id, 
            text, raw_payload, timestamp, slack_message_ts, created_at
     FROM raw_messages 
     WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  // PostgreSQL JSONB columns return as objects, not strings
  return {
    ...result.rows[0],
    raw_payload: result.rows[0].raw_payload, // Already an object from JSONB
  };
}

export async function findRawMessageBySlackTs(
  source: string,
  slackMessageTs: string
): Promise<RawMessage | null> {
  const result = await pool.query(
    `SELECT id, source, channel, channel_id, sender, sender_id, 
            text, raw_payload, timestamp, slack_message_ts, created_at
     FROM raw_messages 
     WHERE source = $1 AND slack_message_ts = $2`,
    [source, slackMessageTs]
  );
  if (result.rows.length === 0) {
    return null;
  }
  // PostgreSQL JSONB columns return as objects, not strings
  return {
    ...result.rows[0],
    raw_payload: result.rows[0].raw_payload, // Already an object from JSONB
  };
}

export async function findRawMessagesByChannel(
  channel: string,
  limit: number = 100
): Promise<RawMessage[]> {
  const result = await pool.query(
    `SELECT id, source, channel, channel_id, sender, sender_id, 
            text, raw_payload, timestamp, slack_message_ts, created_at
     FROM raw_messages 
     WHERE channel = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [channel, limit]
  );
  // PostgreSQL JSONB columns return as objects, not strings
  return result.rows.map((row) => ({
    ...row,
    raw_payload: row.raw_payload, // Already an object from JSONB
  }));
}

export async function findAllRawMessages(limit: number = 100): Promise<RawMessage[]> {
  const result = await pool.query(
    `SELECT id, source, channel, channel_id, sender, sender_id, 
            text, raw_payload, timestamp, slack_message_ts, created_at
     FROM raw_messages 
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  // PostgreSQL JSONB columns return as objects, not strings
  return result.rows.map((row) => ({
    ...row,
    raw_payload: row.raw_payload, // Already an object from JSONB
  }));
}
