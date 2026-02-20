#!/usr/bin/env node

/**
 * Botari AI Database Migration Runner
 * 
 * Usage:
 *   node migrate.js up       - Run all pending migrations
 *   node migrate.js down     - Rollback last migration
 *   node migrate.js reset    - Rollback all migrations
 *   node migrate.js create   - Create a new migration file
 *   node migrate.js status   - Show migration status
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'botari',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const MIGRATIONS_DIR = __dirname;

// Migration table SQL
const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
  );
`;

async function initMigrationsTable() {
  await pool.query(CREATE_MIGRATIONS_TABLE);
}

async function getExecutedMigrations() {
  const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map(row => row.filename);
}

function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

async function runMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`✅ Applied migration: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to apply migration: ${filename}`);
    throw error;
  } finally {
    client.release();
  }
}

async function rollbackMigration(filename) {
  // Note: This is a simplified rollback. In production, you'd have down migrations.
  console.log(`⚠️  Rollback not fully implemented for: ${filename}`);
  console.log('   Please manually review and rollback if needed.');
}

async function migrateUp() {
  await initMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = getMigrationFiles();
  const pending = files.filter(f => !executed.includes(f));
  
  if (pending.length === 0) {
    console.log('✨ No pending migrations');
    return;
  }
  
  console.log(`Found ${pending.length} pending migration(s)...\n`);
  
  for (const filename of pending) {
    await runMigration(filename);
  }
  
  console.log('\n✅ All migrations applied successfully!');
}

async function migrateDown() {
  await initMigrationsTable();
  const executed = await getExecutedMigrations();
  
  if (executed.length === 0) {
    console.log('✨ No migrations to rollback');
    return;
  }
  
  const lastMigration = executed[executed.length - 1];
  await rollbackMigration(lastMigration);
}

async function migrateStatus() {
  await initMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = getMigrationFiles();
  
  console.log('\n📊 Migration Status:\n');
  console.log('Filename                          | Status');
  console.log('----------------------------------|--------');
  
  for (const file of files) {
    const status = executed.includes(file) ? '✅ Applied' : '⏳ Pending';
    const paddedFile = file.padEnd(33);
    console.log(`${paddedFile} | ${status}`);
  }
  
  console.log(`\n${executed.length}/${files.length} migrations applied`);
}

function createMigration() {
  const name = process.argv[3];
  if (!name) {
    console.error('❌ Please provide a migration name: node migrate.js create <name>');
    process.exit(1);
  }
  
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${timestamp}_${name}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);
  
  const template = `-- ============================================================================
-- Migration: ${name}
-- Created at: ${new Date().toISOString()}
-- ============================================================================

BEGIN;

-- Add your migration SQL here

COMMIT;
`;
  
  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
}

async function main() {
  const command = process.argv[2] || 'up';
  
  try {
    switch (command) {
      case 'up':
        await migrateUp();
        break;
      case 'down':
        await migrateDown();
        break;
      case 'reset':
        console.log('⚠️  Reset not implemented. Please manually drop and recreate the database.');
        break;
      case 'create':
        createMigration();
        break;
      case 'status':
        await migrateStatus();
        break;
      default:
        console.log(`
🚀 Botari AI Database Migration Runner

Usage:
  node migrate.js up       - Run all pending migrations
  node migrate.js down     - Rollback last migration
  node migrate.js status   - Show migration status
  node migrate.js create <name>  - Create a new migration file
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
