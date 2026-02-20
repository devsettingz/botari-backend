/**
 * Run database migrations using Node.js (no psql needed)
 * Usage: node run-migrations-node.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  console.log('🚀 Botari AI Database Migrations\n');
  console.log('Database:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'), '\n');

  const migrationsDir = './migrations';
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  for (const file of files) {
    const filepath = path.join(migrationsDir, file);
    console.log(`Running: ${file} ...`);
    
    try {
      const sql = fs.readFileSync(filepath, 'utf8');
      await pool.query(sql);
      console.log(`  ✅ ${file} completed\n`);
    } catch (err) {
      console.log(`  ⚠️  ${file} - ${err.message}\n`);
    }
  }

  console.log('✨ All migrations completed!');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
