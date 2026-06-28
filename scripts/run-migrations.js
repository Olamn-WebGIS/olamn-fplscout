const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const envPath = path.join(__dirname, '..', '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    process.env[key] = value;
  });
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
}

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  if (!sql.trim()) return;

  console.log(`Running migration: ${path.basename(filePath)}`);
  await client.query(sql);
}

async function main() {
  loadEnv();
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL or SUPABASE_DATABASE_URL in .env. Set one to run migrations.');
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
  if (!migrationFiles.length) {
    console.log('No migration files found.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    migrationFiles.sort();
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      await runSqlFile(client, filePath);
    }
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
