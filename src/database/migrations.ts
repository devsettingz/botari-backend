import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('Running migrations...');
  
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  // Check if we need to reset (if initial schema not present)
  const { rows: businessesExists } = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'businesses'
    )
  `);
  
  if (!businessesExists[0].exists) {
    console.log('  → Businesses table not found, clearing migration history for fresh start...');
    await pool.query('DELETE FROM migrations');
  }
  
  // Get list of executed migrations
  const { rows: executed } = await pool.query('SELECT filename FROM migrations');
  const executedFiles = new Set(executed.map(r => r.filename));
  
  // Read migration files
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of files) {
    if (executedFiles.has(file)) {
      console.log(`  ✓ ${file} (already executed)`);
      continue;
    }
    
    console.log(`  → Running ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`  ✓ ${file} executed successfully`);
    } catch (err: any) {
      await pool.query('ROLLBACK');
      console.error(`  ✗ ${file} failed:`, err.message);
      throw err;
    }
  }
  
  console.log('Migrations complete!');
}

export { runMigrations };
