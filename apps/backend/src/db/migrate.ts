/**
 * Migration runner
 * Usage: npm run migrate (from apps/backend)
 * 
 * Reads all .sql files from migrations/ in order and executes them
 * against the Supabase database.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../lib/supabase';

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s).`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);

    const { error } = await supabaseAdmin.rpc('exec_sql', { sql }).single();
    
    // Supabase doesn't expose raw SQL via the client directly in all tiers.
    // For production, run migrations via the Supabase dashboard SQL editor or CLI.
    // This script is a convenience wrapper.
    if (error) {
      console.error(`Migration ${file} failed:`, error);
      process.exit(1);
    }

    console.log(`✅ ${file} applied.`);
  }

  console.log('All migrations complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
