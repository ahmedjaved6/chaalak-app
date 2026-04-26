import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')

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

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  try {
    console.log('🏗️  Creating admin_logs table …')
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid,
        ride_id uuid,
        role text,
        event text,
        details jsonb,
        created_at timestamptz DEFAULT now()
      );
    `)
    console.log('✅  admin_logs table ready.')
  } catch (err) {
    console.error('❌  Failed to create table:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
