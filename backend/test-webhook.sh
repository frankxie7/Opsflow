#!/bin/bash
# Test script for Slack webhook endpoint
# Usage: ./test-webhook.sh [base_url]
# Example: ./test-webhook.sh http://localhost:3000

BASE_URL="${1:-http://localhost:3000}"
WEBHOOK_URL="${BASE_URL}/webhooks/slack"

echo "🧪 Testing Slack Webhook at ${WEBHOOK_URL}"
echo ""

# Test 1: URL Verification Challenge (Slack's initial setup)
echo "1️⃣  Testing URL Verification Challenge..."
CHALLENGE_RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test_challenge_12345"
  }')

echo "Response: ${CHALLENGE_RESPONSE}"
echo ""

# Test 2: Valid Message Event
echo "2️⃣  Testing Valid Message Event..."
MESSAGE_RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "X-Slack-Signature: test_sig" \
  -H "X-Slack-Request-Timestamp: $(date +%s)" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "text": "Our invoice looks wrong for March",
      "user": "U123456",
      "channel": "C123456",
      "ts": "'$(date +%s).$(date +%N | cut -b1-6)'"
    },
    "team_id": "T123456",
    "api_app_id": "A123456"
  }')

echo "Response: ${MESSAGE_RESPONSE}"
echo ""

# Test 3: Duplicate Message (should return existing)
echo "3️⃣  Testing Duplicate Message (should return existing)..."
DUPLICATE_RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "text": "Our invoice looks wrong for March",
      "user": "U123456",
      "channel": "C123456",
      "ts": "'$(date +%s).$(date +%N | cut -b1-6)'"
    },
    "team_id": "T123456",
    "api_app_id": "A123456"
  }')

echo "Response: ${DUPLICATE_RESPONSE}"
echo ""

# Test 4: Bot Message (should be skipped)
echo "4️⃣  Testing Bot Message (should be skipped)..."
BOT_RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "subtype": "bot_message",
      "text": "This is a bot message",
      "user": "U123456",
      "channel": "C123456",
      "ts": "'$(date +%s).$(date +%N | cut -b1-6)'"
    }
  }')

echo "Response: ${BOT_RESPONSE}"
echo ""

# Test 5: Invalid Payload (missing event)
echo "5️⃣  Testing Invalid Payload (should handle gracefully)..."
INVALID_RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback"
  }')

echo "Response: ${INVALID_RESPONSE}"
echo ""

echo "✅ Tests complete!"
echo ""
echo "Next steps:"
echo "  - Check database: SELECT * FROM raw_messages ORDER BY created_at DESC LIMIT 5;"
echo "  - Check server logs for any errors"
