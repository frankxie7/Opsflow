# Testing Guide for Slack Webhook Integration

## Prerequisites

1. **Start PostgreSQL Database**
   ```bash
   # If using docker-compose
   docker-compose up -d postgres
   
   # Or start your PostgreSQL instance manually
   ```

2. **Set up Environment Variables**
   Create a `.env` file in the backend directory:
   ```bash
   DB_HOST=localhost
   DB_USER=app
   DB_PASSWORD=app
   DB_NAME=ops_ai
   DB_PORT=5432
   PORT=3000
   JWT_SECRET=your-secret-key-here
   ```

3. **Run Database Migrations**
   ```bash
   cd backend
   npm run migrate
   ```

4. **Start the Server**
   ```bash
   npm run dev
   ```
   The server should start on `http://localhost:3000`

## Testing the Webhook Endpoint

### Option 1: Automated Test Script

```bash
cd backend
./test-webhook.sh
```

Or with a custom URL:
```bash
./test-webhook.sh http://localhost:3000
```

### Option 2: Manual Testing with cURL

#### Test 1: URL Verification (Slack's Initial Setup)

This is what Slack sends when you first configure the webhook URL:

```bash
curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test_challenge_12345"
  }'
```

**Expected Response:**
```json
{
  "challenge": "test_challenge_12345"
}
```

#### Test 2: Valid Message Event

```bash
curl -X POST http://localhost:3000/webhooks/slack \
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
      "ts": "1234567890.123456"
    },
    "team_id": "T123456",
    "api_app_id": "A123456"
  }'
```

**Expected Response:**
```json
{
  "status": "ok",
  "message_id": 1,
  "already_existed": false
}
```

#### Test 3: Duplicate Message (Deduplication)

Send the same message twice with the same `ts` (timestamp):

```bash
# First time
curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "text": "Test message",
      "user": "U123456",
      "channel": "C123456",
      "ts": "9999999999.999999"
    }
  }'

# Second time (same ts)
curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "text": "Test message",
      "user": "U123456",
      "channel": "C123456",
      "ts": "9999999999.999999"
    }
  }'
```

**Expected Response (second time):**
```json
{
  "status": "ok",
  "message_id": 1,
  "already_existed": true
}
```

#### Test 4: Bot Message (Should be Skipped)

```bash
curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "subtype": "bot_message",
      "text": "This is from a bot",
      "user": "U123456",
      "channel": "C123456",
      "ts": "1234567890.123457"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "skipped",
  "reason": "Skipping message with subtype: bot_message"
}
```

### Option 3: Using Postman or Similar Tools

1. **Create a new POST request** to `http://localhost:3000/webhooks/slack`
2. **Set headers:**
   - `Content-Type: application/json`
   - `X-Slack-Signature: test_sig` (optional for MVP)
   - `X-Slack-Request-Timestamp: 1234567890` (optional for MVP)

3. **Use the JSON payloads from the cURL examples above**

## Verifying Data Storage

### Check Raw Messages in Database

Connect to your PostgreSQL database:

```bash
psql -h localhost -U app -d ops_ai
# Password: app
```

Then run:

```sql
-- View recent messages
SELECT 
  id,
  source,
  channel,
  sender,
  text,
  timestamp,
  created_at
FROM raw_messages 
ORDER BY created_at DESC 
LIMIT 10;

-- View full payload (for debugging)
SELECT 
  id,
  text,
  raw_payload,
  slack_message_ts
FROM raw_messages 
ORDER BY created_at DESC 
LIMIT 5;

-- Check for duplicates (should be none due to unique constraint)
SELECT 
  source,
  slack_message_ts,
  COUNT(*) as count
FROM raw_messages
WHERE slack_message_ts IS NOT NULL
GROUP BY source, slack_message_ts
HAVING COUNT(*) > 1;
```

### Check Server Logs

Watch the server console output when sending requests. You should see:
- Successful ingestion logs
- Skipped events (with reasons)
- Any errors (should be minimal)

## Testing with Real Slack (Production-like)

1. **Use ngrok to expose local server:**
   ```bash
   ngrok http 3000
   ```
   This gives you a public URL like `https://abc123.ngrok.io`

2. **Configure Slack App:**
   - Go to https://api.slack.com/apps
   - Create or select your app
   - Go to "Event Subscriptions"
   - Enable Events
   - Set Request URL to: `https://abc123.ngrok.io/webhooks/slack`
   - Slack will send a verification challenge (should work!)
   - Subscribe to `message.channels` event

3. **Test in a Slack channel:**
   - Send a message in a channel your app is subscribed to
   - Check your server logs
   - Verify the message appears in `raw_messages` table

## Common Issues & Troubleshooting

### Issue: "Database connection failed"
- **Solution:** Make sure PostgreSQL is running and credentials in `.env` are correct
- Test: `npm run migrate` should succeed

### Issue: "relation does not exist"
- **Solution:** Run migrations: `npm run migrate`

### Issue: "Port already in use"
- **Solution:** Change `PORT` in `.env` or kill the process using port 3000

### Issue: "duplicate key value violates unique constraint"
- **This is expected!** It means deduplication is working. The code handles this gracefully.

### Issue: Messages not appearing in database
- Check server logs for errors
- Verify the webhook endpoint is receiving requests (check logs)
- Ensure the message event has all required fields (`text`, `user`, `channel`, `ts`)

## Next Steps After Verification

Once webhook ingestion is working:
1. ✅ Messages are stored in `raw_messages`
2. ✅ Deduplication works
3. ✅ URL verification works

Then you can:
- Implement queue system for background processing
- Add AI triage service
- Connect messages → tasks pipeline
