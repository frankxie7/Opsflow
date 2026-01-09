# Debugging Webhook Errors

If tests 2, 3, and 5 are failing with "Internal error processing webhook", check the following:

## 1. Check Server Logs

The server console should show detailed error messages. Look for:
- Database connection errors
- SQL errors
- Timestamp parsing errors

## 2. Verify Database Setup

```bash
# Check if database is running
docker-compose ps

# Check if migrations ran
cd backend
npm run migrate

# Verify table exists
psql -h localhost -U app -d ops_ai -c "\d raw_messages"
```

## 3. Common Issues

### Issue: "relation raw_messages does not exist"
**Solution:** Run migrations:
```bash
npm run migrate
```

### Issue: "connection refused" or database errors
**Solution:** 
- Start PostgreSQL: `docker-compose up -d postgres`
- Check `.env` file has correct database credentials

### Issue: "null value in column" errors
**Solution:** Check that all required fields are being sent:
- `event.text` (required)
- `event.user` (required)
- `event.channel` (required)
- `event.ts` (required)

### Issue: Unique constraint violation (expected for duplicates)
**This is normal!** The code handles this and should return `already_existed: true`.

## 4. Test Database Connection Directly

```bash
cd backend
node -e "
const { pool } = require('./dist/db/index.js');
pool.query('SELECT 1').then(() => {
  console.log('✅ Database connected');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database error:', err.message);
  process.exit(1);
});
"
```

## 5. Manual Database Insert Test

```bash
psql -h localhost -U app -d ops_ai << EOF
INSERT INTO raw_messages (
  source, channel, sender, text, raw_payload, timestamp, slack_message_ts
) VALUES (
  'slack', 'C123', 'U123', 'Test message', '{}'::jsonb, NOW(), '1234567890.123456'
) RETURNING id;
EOF
```

If this fails, there's a database schema issue.
If this succeeds, the issue is in the application code.
