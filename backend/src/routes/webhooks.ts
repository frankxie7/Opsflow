import { Router } from "express";
import { slackWebhookController } from "../controllers/webhookController";

const router = Router();

/**
 * Webhook routes
 * These endpoints receive events from external services (Slack, etc.)
 * No authentication required (verified via signatures/keys)
 */

// POST /webhooks/slack - Slack Events API webhook
router.post("/slack", slackWebhookController);

export default router;
