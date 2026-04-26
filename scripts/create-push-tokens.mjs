import { readFileSync } from 'fs';
import { Client } from 'pg';

// Load .env.local manually
const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || dbUrl.includes('[YOUR-DB-PASSWORD]')) {
  console.error('DATABASE_URL in .env.local still has the placeholder password.');
  console.error('Replace [YOUR-DB-PASSWORD] with your real Supabase DB password and re-run.');
  process.exit(1);
}

const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await db.connect();
console.log('Connected to Supabase');

await db.query(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT        NOT NULL,
    platform   TEXT        NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, platform)
  );
  CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
`);

console.log('push_tokens table created OK');
await db.end();
