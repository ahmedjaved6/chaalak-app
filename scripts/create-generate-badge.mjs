/**
 * Creates the generate_badge(p_zone_id uuid) SQL function in Supabase.
 * Run once: node scripts/create-generate-badge.mjs
 */

import { readFileSync } from 'fs'
import { Client } from 'pg'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl || dbUrl.includes('[YOUR-DB-PASSWORD]')) {
  console.error('Replace [YOUR-DB-PASSWORD] in .env.local then re-run.')
  process.exit(1)
}

const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await db.connect()
console.log('Connected')

await db.query(`
  CREATE OR REPLACE FUNCTION generate_badge(p_zone_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    v_zone_number int;
    v_prefix      text;
    v_number      int;
    v_badge_code  text;
  BEGIN
    SELECT zone_number INTO v_zone_number FROM zones WHERE id = p_zone_id;

    v_prefix := CASE v_zone_number
      WHEN 1 THEN 'PB'
      WHEN 2 THEN 'CH'
      WHEN 3 THEN 'DS'
      WHEN 4 THEN 'BT'
      ELSE 'ZZ'
    END;

    -- Atomically claim next number for this zone (includes active + pending)
    SELECT COALESCE(MAX(badge_number) FILTER (WHERE badge_number < 9000), 0) + 1
      INTO v_number
      FROM pullers
     WHERE zone_id = p_zone_id;

    v_badge_code := v_prefix || '-' || LPAD(v_number::text, 3, '0');

    RETURN jsonb_build_object(
      'badge_code',   v_badge_code,
      'badge_number', v_number
    );
  END;
  $$;
`)

console.log('generate_badge function created OK')
await db.end()
