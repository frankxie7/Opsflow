#!/usr/bin/env node
/**
 * Simple Node.js test script for Slack webhook
 * Usage: node test-webhook.js [base_url]
 */

const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/webhooks/slack`;

function makeRequest(payload, description) {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_URL);
    const postData = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Slack-Signature': 'test_sig',
        'X-Slack-Request-Timestamp': Math.floor(Date.now() / 1000).toString(),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`\n${description}`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Response:', data);
        }
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.error(`\n${description}`);
      console.error('Error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Slack Webhook at', WEBHOOK_URL);
  console.log('='.repeat(60));

  try {
    // Test 1: URL Verification
    await makeRequest(
      {
        type: 'url_verification',
        challenge: 'test_challenge_12345',
      },
      '1️⃣  URL Verification Challenge'
    );

    // Test 2: Valid Message Event
    const timestamp = `${Math.floor(Date.now() / 1000)}.${Date.now() % 1000000}`;
    await makeRequest(
      {
        type: 'event_callback',
        event: {
          type: 'message',
          text: 'Our invoice looks wrong for March',
          user: 'U123456',
          channel: 'C123456',
          ts: timestamp,
        },
        team_id: 'T123456',
        api_app_id: 'A123456',
      },
      '2️⃣  Valid Message Event'
    );

    // Test 3: Duplicate Message (using same timestamp)
    await makeRequest(
      {
        type: 'event_callback',
        event: {
          type: 'message',
          text: 'Our invoice looks wrong for March',
          user: 'U123456',
          channel: 'C123456',
          ts: timestamp, // Same timestamp = duplicate
        },
        team_id: 'T123456',
        api_app_id: 'A123456',
      },
      '3️⃣  Duplicate Message (should return existing)'
    );

    // Test 4: Bot Message (should be skipped)
    await makeRequest(
      {
        type: 'event_callback',
        event: {
          type: 'message',
          subtype: 'bot_message',
          text: 'This is from a bot',
          user: 'U123456',
          channel: 'C123456',
          ts: `${Math.floor(Date.now() / 1000)}.${Date.now() % 1000000}`,
        },
      },
      '4️⃣  Bot Message (should be skipped)'
    );

    // Test 5: Invalid Payload
    await makeRequest(
      {
        type: 'event_callback',
        // Missing event
      },
      '5️⃣  Invalid Payload (missing event)'
    );

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tests complete!');
    console.log('\nNext steps:');
    console.log('  - Check database: SELECT * FROM raw_messages ORDER BY created_at DESC LIMIT 5;');
    console.log('  - Check server logs for any errors');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
