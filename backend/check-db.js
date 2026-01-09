#!/usr/bin/env node
/**
 * Quick database connection and schema check
 * Usage: node check-db.js
 */

require('dotenv').config();

// Try to load TypeScript files using ts-node if available
let pool;
try {
  // First try compiled JS
  pool = require('./dist/db/index').pool;
} catch (e) {
  try {
    // Fallback to TypeScript with ts-node
    require('ts-node/register');
    pool = require('./src/db/index').pool;
  } catch (e2) {
    // Last resort: direct pg connection
    const { Pool } = require('pg');
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'app',
      password: process.env.DB_PASSWORD || 'app',
      database: process.env.DB_NAME || 'ops_ai',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });
  }
}

async function checkDatabase() {
  console.log('🔍 Checking database connection and schema...\n');

  try {
    // Test connection
    console.log('1. Testing database connection...');
    await pool.query('SELECT 1');
    console.log('   ✅ Database connection successful\n');

    // Check if table exists
    console.log('2. Checking if raw_messages table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'raw_messages'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('   ✅ raw_messages table exists\n');

      // Check table structure
      console.log('3. Checking table structure...');
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'raw_messages'
        ORDER BY ordinal_position;
      `);
      console.log('   Columns:');
      columns.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
      console.log('');

      // Test insert
      console.log('4. Testing insert (will be rolled back)...');
      const testTs = `${Date.now() / 1000}.${Date.now() % 1000000}`;
      await pool.query('BEGIN');
      try {
        const result = await pool.query(`
          INSERT INTO raw_messages (
            source, channel, sender, text, raw_payload, timestamp, slack_message_ts
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;
        `, [
          'slack',
          'C_TEST',
          'U_TEST',
          'Test message',
          '{}',
          new Date(),
          testTs
        ]);
        console.log(`   ✅ Insert successful (ID: ${result.rows[0].id})`);
        await pool.query('ROLLBACK');
        console.log('   ✅ Test data rolled back\n');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }

    } else {
      console.log('   ❌ raw_messages table does NOT exist');
      console.log('   💡 Run: npm run migrate\n');
    }

    // Check for unique constraint
    console.log('5. Checking constraints...');
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'raw_messages';
    `);
    
    if (constraints.rows.length > 0) {
      console.log('   Constraints:');
      constraints.rows.forEach(con => {
        console.log(`     - ${con.constraint_name} (${con.constraint_type})`);
      });
    } else {
      console.log('   ⚠️  No constraints found');
    }

    console.log('\n✅ All checks passed! Database is ready.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('   PostgreSQL error code:', error.code);
    }
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    console.log('\n💡 Common fixes:');
    console.log('   - Start database: docker-compose up -d postgres');
    console.log('   - Run migrations: npm run migrate');
    console.log('   - Check .env file has correct database credentials\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabase();
