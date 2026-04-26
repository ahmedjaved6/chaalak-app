/**
 * Tests multiple connection string variants to find the working one.
 * Run: node scripts/check-phone-column.mjs
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envText   = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')

for (const line of envText.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

const PROJECT_REF = 'ycxdrfjtpjshoferxdrj'
const RAW_PASS    = 'Nitish#$2024'
const ENC_PASS    = encodeURIComponent(RAW_PASS)  // Nitish%23%242024

const VARIANTS = [
  // Session pooler (port 5432) - what was in .env.local
  { label: 'Session pooler 5432 (postgres.ref user)',
    url: `postgresql://postgres.${PROJECT_REF}:${ENC_PASS}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` },

  // Transaction pooler (port 6543)
  { label: 'Transaction pooler 6543 (postgres.ref user)',
    url: `postgresql://postgres.${PROJECT_REF}:${ENC_PASS}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` },

  // Direct connection (port 5432, direct host)
  { label: 'Direct connection (db.ref host)',
    url: `postgresql://postgres:${ENC_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres` },

  // Session pooler with raw password (in case encoding is wrong)
  { label: 'Session pooler 5432 (raw password via object)',
    config: {
      host: 'aws-0-ap-south-1.pooler.supabase.com',
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password: RAW_PASS,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    }
  },
]

const { Pool } = pg

for (const variant of VARIANTS) {
  process.stdout.write(`Testing: ${variant.label} … `)
  const pool = variant.url
    ? new Pool({ connectionString: variant.url, ssl: { rejectUnauthorized: false } })
    : new Pool(variant.config)

  try {
    const client = await pool.connect()
    const { rows } = await client.query('SELECT current_database(), current_user, version()')
    console.log('✅  CONNECTED!')
    console.log('   db=%s  user=%s', rows[0].current_database, rows[0].current_user)
    console.log('   pg=%s', rows[0].version.split(' ').slice(0,2).join(' '))

    // ── Check / add phone column ───────────────────────────────────────────
    console.log('\n🔍  Checking users.phone column …')
    const { rows: colRows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='phone'
    `)

    if (colRows.length > 0) {
      console.log('✅  users.phone already exists.')
    } else {
      console.log('➕  Missing — adding phone column …')
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text')
      console.log('✅  phone column added!')
    }

    // ── List all users columns ─────────────────────────────────────────────
    const { rows: allCols } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users'
      ORDER BY ordinal_position
    `)
    console.log('\n📋  users table columns:')
    allCols.forEach(c =>
      console.log(`   • ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`)
    )

    client.release()
    await pool.end()
    process.exit(0)
  } catch (err) {
    console.log(`❌  ${err.message}`)
    await pool.end().catch(() => {})
  }
}

console.log('\n❌  All connection variants failed.')
process.exit(1)
