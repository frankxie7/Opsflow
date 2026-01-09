#!/usr/bin/env node
/**
 * Quick script to check raw_messages table
 * Usage: node check-raw-messages.js [limit]
 */

require('dotenv').config();

// Try to load TypeScript files
let pool;
try {
  require('ts-node/register');
  pool = require('./src/db/index').pool;
} catch (e) {
  // Fallback to direct connection
  const { Pool } = require('pg');
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || 'app',
    database: process.env.DB_NAME || 'ops_ai',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });
}

const limit = parseInt(process.argv[2] || '5', 10);

async function checkRawMessages() {
  try {
    console.log(`📋 Fetching last ${limit} raw messages...\n`);
    
    const result = await pool.query(
      `SELECT 
        id,
        source,
        channel,
        sender,
        text,
        timestamp,
        slack_message_ts,
        created_at,
        raw_payload->>'type' as payload_type
      FROM raw_messages 
      ORDER BY created_at DESC 
      LIMIT $1`,
      [limit]
    );

    if (result.rows.length === 0) {
      console.log('❌ No messages found in raw_messages table\n');
      console.log('💡 Make sure you ran the webhook tests first!');
      process.exit(0);
    }

    console.log(`✅ Found ${result.rows.length} message(s):\n`);
    console.log('='.repeat(80));
    
    result.rows.forEach((row, index) => {
      console.log(`\n📨 Message #${index + 1} (ID: ${row.id})`);
      console.log(`   Source: ${row.source}`);
      console.log(`   Channel: ${row.channel}`);
      console.log(`   Sender: ${row.sender}`);
      console.log(`   Text: ${row.text}`);
      console.log(`   Timestamp: ${row.timestamp}`);
      console.log(`   Slack TS: ${row.slack_message_ts || '(null)'}`);
      console.log(`   Created At: ${row.created_at}`);
      console.log(`   Payload Type: ${row.payload_type || '(null)'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Data verification complete!\n');
    
    // Also show summary stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT channel) as unique_channels,
        COUNT(DISTINCT sender) as unique_senders
      FROM raw_messages
    `);
    
    if (stats.rows[0]) {
      const s = stats.rows[0];
      console.log('📊 Summary:');
      console.log(`   Total messages: ${s.total}`);
      console.log(`   Unique channels: ${s.unique_channels}`);
      console.log(`   Unique senders: ${s.unique_senders}`);
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('   PostgreSQL error code:', error.code);
    }
    console.error('\n💡 Make sure:');
    console.error('   - Database is running: docker-compose up -d postgres');
    console.error('   - Migrations ran: npm run migrate');
    console.error('   - .env file has correct credentials\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkRawMessages();
