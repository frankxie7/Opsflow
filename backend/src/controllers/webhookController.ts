import { Request, Response } from "express";
import {
  ingestSlackMessage,
  validateSlackSignature,
  SlackEventPayload,
} from "../services/messageService";

/**
 * Webhook controller - handles incoming webhook requests
 * No auth required (webhooks come from external services)
 * But we should verify Slack signatures for security
 */

export async function slackWebhookController(req: Request, res: Response) {
  try {
    const payload = req.body as SlackEventPayload;

    // Handle Slack URL verification challenge
    // Slack sends this when you first configure the webhook URL
    if (payload.type === "url_verification") {
      if (!payload.challenge) {
        return res.status(400).json({ error: "Missing challenge in verification request" });
      }
      // Return the challenge to verify the endpoint
      return res.status(200).json({ challenge: payload.challenge });
    }

    // Verify Slack signature (optional but recommended)
    // For MVP, we'll skip this but should be added before production
    const slackSignature = req.headers["x-slack-signature"] as string;
    const slackTimestamp = req.headers["x-slack-request-timestamp"] as string;

    if (slackSignature && slackTimestamp) {
      // Get raw body for signature verification
      // Note: Express.json() parses the body, so we'd need raw body middleware
      // For MVP, we'll skip signature verification but log it
      // TODO: Add signature verification in production
      // const isValid = validateSlackSignature(
      //   slackSignature,
      //   slackTimestamp,
      //   req.body
      // );
      // if (!isValid) {
      //   return res.status(401).json({ error: "Invalid Slack signature" });
      // }
    }

    // Process the event
    if (payload.type === "event_callback") {
      try {
        const result = await ingestSlackMessage(payload);

        // Return 200 immediately (don't wait for background processing)
        // Slack requires a response within 3 seconds
        return res.status(200).json({
          status: "ok",
          message_id: result.id,
          already_existed: result.already_existed,
        });
      } catch (error) {
        // Handle expected errors (e.g., unsupported event types, duplicates)
        if (error instanceof Error) {
          console.error("Error in ingestSlackMessage:", error.message);
          console.error("Stack:", error.stack);
          
          if (
            error.message.includes("Unsupported") ||
            error.message.includes("Skipping") ||
            error.message.includes("empty") ||
            error.message.includes("missing")
          ) {
            // Log but don't fail - these are expected for certain events
            console.log(`Skipping event: ${error.message}`);
            return res.status(200).json({
              status: "skipped",
              reason: error.message,
            });
          }
        }
        throw error;
      }
    }

    // Unknown payload type
    return res.status(400).json({
      error: `Unsupported payload type: ${payload.type}`,
    });
  } catch (error) {
    // Log full error details for debugging
    console.error("Slack webhook error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      // Log the error code if it's a database error
      if ('code' in error) {
        console.error("Error code:", (error as { code?: string }).code);
      }
    }
    // Always return 200 to Slack to prevent retries for unexpected errors
    // Log the error for investigation
    return res.status(200).json({
      status: "error",
      message: "Internal error processing webhook",
      // Include error details in development mode
      ...(process.env.NODE_ENV !== "production" && error instanceof Error
        ? { error: error.message }
        : {}),
    });
  }
}
