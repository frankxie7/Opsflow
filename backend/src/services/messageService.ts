import {
  createRawMessage,
  findRawMessageBySlackTs,
} from "../db/rawMessages";
import { CreateRawMessageInput, RawMessage } from "../db/types";

/**
 * Message service - business logic for message ingestion
 * Handles validation, deduplication, and storage
 * No AI calls here - that happens in background jobs
 */

export interface SlackEventPayload {
  type: string;
  event?: {
    type: string;
    text: string;
    user: string;
    channel: string;
    channel_type?: string;
    ts: string;
    event_ts?: string;
  };
  challenge?: string; // For Slack URL verification
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
  // Handle Slack URL verification challenge
  if (slackPayload.type === "url_verification" && slackPayload.challenge) {
    // This will be handled in the controller, but we need to validate it's not a real message
    throw new Error("URL verification challenge - not a message event");
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

  // Skip bot messages and message edits/deletes (for now)
  // Slack sends subtypes like 'bot_message', 'message_changed', 'message_deleted'
  // We only want 'message' events with user messages
  if (!event.text || event.text.trim().length === 0) {
    throw new Error("Message text is empty");
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
  // Extract channel name from channel ID if needed (Slack sends channel IDs)
  // For MVP, we'll store the channel ID and use it as channel name
  // Later we can enrich with channel name lookups
  const messageInput: CreateRawMessageInput = {
    source: "slack",
    channel: event.channel, // Channel ID or name
    channel_id: event.channel,
    sender: event.user, // User ID
    sender_id: event.user,
    text: event.text,
    raw_payload: slackPayload as Record<string, unknown>,
    timestamp: new Date(parseFloat(event.ts) * 1000), // Convert Slack ts to Date
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
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (
      error instanceof Error &&
      error.message.includes("duplicate key value")
    ) {
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
