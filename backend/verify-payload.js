#!/usr/bin/env node
/**
 * Verify raw_payload is stored correctly as JSONB
 */

require('dotenv').config();
require('ts-node/register');
const { pool } = require('./src/db/index');

async function verify() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        raw_payload->>'type' as payload_type,
        raw_payload->'event'->>'type' as event_type,
        raw_payload->'event'->>'text' as event_text,
        jsonb_typeof(raw_payload) as payload_jsonb_type,
        raw_payload IS NOT NULL as has_payload
      FROM raw_messages 
      ORDER BY id DESC 
      LIMIT 3
    `);

    console.log('✅ Raw Payload Verification:\n');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Check if payload is valid JSONB
    const allValid = result.rows.every(row => 
      row.has_payload && 
      row.payload_jsonb_type === 'object' &&
      row.payload_type === 'event_callback'
    );
    
    if (allValid) {
      console.log('\n✅ All payloads are valid JSONB objects!');
    } else {
      console.log('\n⚠️  Some payloads may have issues');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verify();
