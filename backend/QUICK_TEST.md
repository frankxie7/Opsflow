# Quick Test Guide

## 🚀 Quick Start (3 Steps)

### 1. Start Database
```bash
# From project root
docker-compose up -d postgres

# Or if you have PostgreSQL running locally, skip this
```

### 2. Setup & Start Server
```bash
cd backend

# Set up environment (create .env file with DB credentials if needed)
# Defaults: DB_HOST=localhost, DB_USER=app, DB_PASSWORD=app, DB_NAME=ops_ai

# Run migrations
npm run migrate

# Start server
npm run dev
```

### 3. Run Tests

**Option A: Using Node.js script (easiest)**
```bash
node test-webhook.js
```

**Option B: Using bash script**
```bash
./test-webhook.sh
```

**Option C: Manual curl (see TESTING.md for full examples)**
```bash
# Test URL verification
curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test123"}'

# Test message ingestion
curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "text": "Test message",
      "user": "U123",
      "channel": "C123",
      "ts": "1234567890.123456"
    }
  }'
```

## ✅ Verify It Works

### Check Database
```bash
psql -h localhost -U app -d ops_ai -c "SELECT id, channel, sender, text, created_at FROM raw_messages ORDER BY created_at DESC LIMIT 5;"
```

### Check Server Logs
Look for:
- ✅ "Server running on port 3000"
- ✅ Successful message ingestion logs
- ❌ Any error messages

## 🐛 Common Issues

**Database connection error?**
- Make sure PostgreSQL is running: `docker-compose ps`
- Check `.env` file has correct credentials

**Migration errors?**
- Run: `npm run migrate`
- Check database exists: `psql -h localhost -U app -l`

**Port 3000 in use?**
- Change `PORT` in `.env` or kill the process using port 3000

## 📚 Full Testing Guide

See `TESTING.md` for comprehensive testing instructions including:
- All test scenarios
- Real Slack integration with ngrok
- Database queries
- Troubleshooting guide
