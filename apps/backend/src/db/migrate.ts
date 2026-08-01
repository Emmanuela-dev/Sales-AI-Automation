/**
 * Migration runner
 * Usage: npm run migrate (from apps/backend)
 *
 * Applies every .sql file in migrations/ in filename order over a direct
 * Postgres connection (DATABASE_URL). Each file runs inside a transaction and
 * is recorded in the _migrations table, so re-running is safe and idempotent.
 *
 * DATABASE_URL comes from:
 *   Supabase → Project Settings → Database → Connection string → URI
 * or, for the local docker-compose Postgres:
 *   postgresql://prospectai:prospectai_secret@localhost:5432/prospectai
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

const MIGRATIONS_TABLE = '_migrations';

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url || url.includes('your-project') || url.includes('your-db-password')) {
    console.error('\n❌ DATABASE_URL is not set (or is still the placeholder).\n');
    console.error('   Set it in apps/backend/.env. Get the value from:');
    console.error('   Supabase → Project Settings → Database → Connection string → URI\n');
    console.error('   For the local docker-compose Postgres use:');
    console.error('   DATABASE_URL=postgresql://prospectai:prospectai_secret@localhost:5432/prospectai\n');
    process.exit(1);
  }

  return url;
}

/** Supabase and other hosted Postgres require TLS; local Docker does not. */
function sslConfig(connectionString: string) {
  const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(connectionString);
  return isLocal ? undefined : { rejectUnauthorized: false };
}

async function migrate() {
  const connectionString = resolveConnectionString();
  const client = new Client({ connectionString, ssl: sslConfig(connectionString) });

  try {
    await client.connect();
  } catch (err) {
    console.error('\n❌ Could not connect to the database.');
    console.error(`   ${(err as Error).message}\n`);
    console.error('   Check that DATABASE_URL is correct and the database is reachable.\n');
    process.exit(1);
  }

  console.log('✅ Connected to database.');

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s).`);

  const { rows: applied } = await client.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM ${MIGRATIONS_TABLE}`
  );
  const appliedByName = new Map(applied.map((r) => [r.filename, r.checksum]));

  let appliedCount = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const previousChecksum = appliedByName.get(file);

    if (previousChecksum) {
      if (previousChecksum !== checksum) {
        console.warn(
          `⚠️  ${file} was already applied but its contents have changed. ` +
            'Skipping — add a new migration file instead of editing an applied one.'
        );
      } else {
        console.log(`⏭️  ${file} already applied.`);
      }
      continue;
    }

    console.log(`Running migration: ${file}`);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum) VALUES ($1, $2)`,
        [file, checksum]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`\n❌ Migration ${file} failed and was rolled back:`);
      console.error(`   ${(err as Error).message}\n`);
      await client.end();
      process.exit(1);
    }

    console.log(`✅ ${file} applied.`);
    appliedCount++;
  }

  await client.end();

  console.log(
    appliedCount > 0
      ? `\nAll migrations complete. ${appliedCount} newly applied.`
      : '\nDatabase already up to date.'
  );
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
