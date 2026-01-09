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
      JSON.stringify(input.raw_payload),
      input.timestamp,
      input.slack_message_ts || null,
    ]
  );
  return {
    ...result.rows[0],
    raw_payload: JSON.parse(result.rows[0].raw_payload),
  };
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
  return {
    ...result.rows[0],
    raw_payload: JSON.parse(result.rows[0].raw_payload),
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
  return {
    ...result.rows[0],
    raw_payload: JSON.parse(result.rows[0].raw_payload),
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
  return result.rows.map((row) => ({
    ...row,
    raw_payload: JSON.parse(row.raw_payload),
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
  return result.rows.map((row) => ({
    ...row,
    raw_payload: JSON.parse(row.raw_payload),
  }));
}
