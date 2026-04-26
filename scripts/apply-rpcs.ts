/**
 * scripts/apply-rpcs.ts
 *
 * Applies the two Supabase PostgreSQL RPCs required by the Chaalak app:
 *   1. accept_ride   — atomically accepts a ride request
 *   2. puller_heartbeat — updates puller GPS + online status
 *
 * Uses pg (direct PostgreSQL connection) because Supabase JS client
 * cannot execute DDL (CREATE FUNCTION) via the REST API.
 *
 * Run:
 *   npx ts-node --project tsconfig.seed.json scripts/apply-rpcs.ts
 */

import { Pool, PoolClient } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// ── Load .env.local ──────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')

// Parse manually (dotenv.config doesn't handle .env.local by default)
for (const line of envText.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set in .env.local')
  process.exit(1)
}

// ── SQL definitions ──────────────────────────────────────────────────────────

const ACCEPT_RIDE_SQL = `
CREATE OR REPLACE FUNCTION accept_ride(p_ride_id uuid, p_puller_id uuid)
RETURNS ride_requests LANGUAGE plpgsql AS $$
DECLARE v_result ride_requests;
BEGIN
  UPDATE ride_requests
    SET status     = 'accepted',
        accepted_by = p_puller_id,
        accepted_at = now()
  WHERE id       = p_ride_id
    AND status   = 'requested'
    AND expires_at > now()
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
`.trim()

const PULLER_HEARTBEAT_SQL = `
CREATE OR REPLACE FUNCTION puller_heartbeat(
  p_puller_id uuid,
  p_lat       double precision,
  p_lng       double precision
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE pullers
    SET lat            = p_lat,
        lng            = p_lng,
        last_active_at = now(),
        is_online      = true,
        updated_at     = now()
  WHERE id = p_puller_id;
END;
$$;
`.trim()

const VERIFY_SQL = `
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('accept_ride', 'puller_heartbeat')
ORDER BY routine_name;
`

// ── Helper ───────────────────────────────────────────────────────────────────

async function runSQL(client: PoolClient, label: string, sql: string): Promise<void> {
  process.stdout.write(`  ⚙  ${label} … `)
  try {
    await client.query(sql)
    console.log('✅  done')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`❌  FAILED\n     ${msg}`)
    throw err
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  let client!: PoolClient
  try {
    console.log('\n🔌  Connecting to Supabase (direct) …')
    client = await pool.connect()

    const { rows: info } = await client.query(
      'SELECT current_database() AS db, current_user AS usr, version() AS ver'
    )
    console.log(`✅  Connected  db=${info[0].db}  user=${info[0].usr}`)
    console.log(`   PostgreSQL ${info[0].ver.split(' ').slice(0, 2).join(' ')}`)

    // ── Apply RPCs ─────────────────────────────────────────────────────────

    console.log('\n📦  Applying RPCs …')
    await runSQL(client, 'accept_ride', ACCEPT_RIDE_SQL)
    await runSQL(client, 'puller_heartbeat', PULLER_HEARTBEAT_SQL)

    // ── Verify ─────────────────────────────────────────────────────────────

    console.log('\n🔍  Verifying both functions exist …')
    const { rows: fns } = await client.query(VERIFY_SQL)

    const found = fns.map((r: { routine_name: string }) => r.routine_name)
    const expected = ['accept_ride', 'puller_heartbeat']

    for (const fn of expected) {
      if (found.includes(fn)) {
        console.log(`  ✅  ${fn}`)
      } else {
        console.log(`  ❌  ${fn}  ← MISSING`)
      }
    }

    const allOk = expected.every((fn) => found.includes(fn))
    if (allOk) {
      console.log('\n🎉  Both RPCs are live and ready!')
    } else {
      console.error('\n❌  One or more RPCs are missing — check errors above.')
      process.exit(1)
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('\n💥  Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
