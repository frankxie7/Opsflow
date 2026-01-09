import { createRawMessage, findRawMessageBySlackTs } from "../db/rawMessages";
import { CreateRawMessageInput, RawMessage } from "../db/types";

/**
 * Message service - business logic for message ingestion
 * Handles validation, deduplication, and storage
 * No AI calls here - that happens in background jobs
 */

export interface SlackEventPayload {
  type: "url_verification" | "event_callback";
  challenge?: string; // For Slack URL verification
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    channel_type?: string;
    ts?: string;
    event_ts?: string;
    subtype?: string; // e.g., 'bot_message', 'message_changed', 'message_deleted'
  };
  team_id?: string;
  api_app_id?: string;
}

export interface IngestedMessage {
  id: number;
  source: string;
  channel: string;
  sender: string;
  text: string;
  timestamp: Date;
  already_existed: boolean; // true if message was already ingested (deduplication)
}

/**
 * Ingest a Slack message event
 * Append-only storage with deduplication
 * Returns the stored message or existing message if duplicate
 */
export async function ingestSlackMessage(
  slackPayload: SlackEventPayload
): Promise<IngestedMessage> {
  // This function should not be called for URL verification
  if (slackPayload.type === "url_verification") {
    throw new Error("URL verification should be handled separately");
  }

  // Must be event_callback type
  if (slackPayload.type !== "event_callback") {
    throw new Error(`Unsupported payload type: ${slackPayload.type}`);
  }

  // Extract event data
  const event = slackPayload.event;
  if (!event) {
    throw new Error("Missing event in Slack payload");
  }

  // Only process message events
  if (event.type !== "message") {
    throw new Error(`Unsupported event type: ${event.type}`);
  }

  // Skip bot messages, message edits, deletes, and other subtypes
  // We only want user-created messages
  if (event.subtype) {
    throw new Error(`Skipping message with subtype: ${event.subtype}`);
  }

  // Validate required fields
  if (!event.text || event.text.trim().length === 0) {
    throw new Error("Message text is empty");
  }

  if (!event.user) {
    throw new Error("Message missing user ID");
  }

  if (!event.channel) {
    throw new Error("Message missing channel ID");
  }

  if (!event.ts) {
    throw new Error("Message missing timestamp");
  }

  // Check for duplicate using slack_message_ts
  // The unique constraint on (source, slack_message_ts) prevents duplicates
  const existing = await findRawMessageBySlackTs("slack", event.ts);
  if (existing) {
    // Message already ingested - return existing
    return {
      id: existing.id,
      source: existing.source,
      channel: existing.channel,
      sender: existing.sender,
      text: existing.text,
      timestamp: existing.timestamp,
      already_existed: true,
    };
  }

  // Prepare message input
  // Slack sends channel IDs - we'll use the ID as both channel and channel_id
  // Later we can enrich with channel name lookups from Slack API
  
  // Parse timestamp - Slack ts is in format "seconds.microseconds" as a string
  const timestampMs = parseFloat(event.ts) * 1000;
  if (isNaN(timestampMs)) {
    throw new Error(`Invalid timestamp format: ${event.ts}`);
  }
  
  const messageInput: CreateRawMessageInput = {
    source: "slack",
    channel: event.channel, // Channel ID (we'll treat as identifier)
    channel_id: event.channel,
    sender: event.user, // User ID
    sender_id: event.user,
    text: event.text,
    raw_payload: slackPayload as unknown as Record<string, unknown>,
    timestamp: new Date(timestampMs), // Convert Slack ts (seconds) to Date (milliseconds)
    slack_message_ts: event.ts,
  };

  // Store message (append-only)
  try {
    const rawMessage = await createRawMessage(messageInput);

    // TODO: Enqueue for background processing (AI triage)
    // For now, we'll stub this - queues will be implemented later
    // await enqueueMessageForTriage(rawMessage.id);

    return {
      id: rawMessage.id,
      source: rawMessage.source,
      channel: rawMessage.channel,
      sender: rawMessage.sender,
      text: rawMessage.text,
      timestamp: rawMessage.timestamp,
      already_existed: false,
    };
  } catch (error: unknown) {
    // Handle unique constraint violation (race condition)
    // PostgreSQL error code 23505 = unique_violation
    const isUniqueViolation =
      error instanceof Error &&
      ((error as { code?: string }).code === "23505" ||
        error.message.includes("duplicate key value") ||
        error.message.includes("unique constraint"));

    if (isUniqueViolation) {
      // Another request processed this message first - fetch existing
      const existing = await findRawMessageBySlackTs("slack", event.ts);
      if (existing) {
        return {
          id: existing.id,
          source: existing.source,
          channel: existing.channel,
          sender: existing.sender,
          text: existing.text,
          timestamp: existing.timestamp,
          already_existed: true,
        };
      }
    }
    throw error;
  }
}

/**
 * Validate Slack webhook signature (optional but recommended)
 * For MVP, we'll skip this but leave a placeholder
 * In production, verify Slack signing secret
 */
export function validateSlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // TODO: Implement Slack signature verification
  // See: https://api.slack.com/authentication/verifying-requests-from-slack
  // For MVP, we'll skip this but should be added before production
  return true;
}
