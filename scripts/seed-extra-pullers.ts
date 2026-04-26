/**
 * scripts/seed-extra-pullers.ts
 */

import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Load .env.local ──────────────────────────────────────────────────────────

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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing environment variables in .env.local')
  process.exit(1)
}

const EXTRA_PULLERS = [
  { email: 'puller2@test.com', password: 'test1234', name: 'Bipul Borah', badge: 'PB-12', zone: 1, is_online: true,  lat: 26.1445, lng: 91.7362, status: 'active', thumbs_up: 23, total_rides: 67 },
  { email: 'puller3@test.com', password: 'test1234', name: 'Dilip Sharma', badge: 'CH-08', zone: 2, is_online: true,  lat: 26.1589, lng: 91.7214, status: 'active', thumbs_up: 41, total_rides: 98 },
  { email: 'puller4@test.com', password: 'test1234', name: 'Manoj Das',    badge: 'DS-15', zone: 3, is_online: false, lat: 26.1312, lng: 91.7589, status: 'active', thumbs_up: 18, total_rides: 44 },
  { email: 'puller5@test.com', password: 'test1234', name: 'Sanjay Nath',  badge: 'BT-03', zone: 4, is_online: true,  lat: 26.1198, lng: 91.7445, status: 'active', thumbs_up: 55, total_rides: 112 },
  { email: 'puller6@test.com', password: 'test1234', name: 'Raju Kalita',  badge: 'PB-31', zone: 1, is_online: true,  lat: 26.1478, lng: 91.7401, status: 'active', thumbs_up: 29, total_rides: 78 },
]

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log('🔌  Connecting to DB …')
  const client = await pool.connect()

  try {
    // Get zone IDs
    const zoneRes = await client.query('SELECT id, zone_number FROM zones')
    const zoneIds: Record<number, string> = {}
    zoneRes.rows.forEach(r => zoneIds[r.zone_number] = r.id)

    console.log('📍  Zones found:', zoneIds)

    const today = new Date()
    const validTill = new Date()
    validTill.setDate(today.getDate() + 25)

    for (const p of EXTRA_PULLERS) {
      console.log(`👤  Seeding ${p.name} (${p.email}) …`)

      // 1. Auth User
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: p.email,
        password: p.password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { role: 'puller', name: p.name }
      })

      let uid: string
      if (authErr) {
        if (authErr.message.includes('already exists')) {
          const existing = await client.query('SELECT id FROM auth.users WHERE email = $1', [p.email])
          uid = existing.rows[0].id
          console.log(`   🔸 Auth user already exists (${uid}).`)
        } else {
          console.error(`   ❌ Failed to create auth user:`, authErr.message)
          continue
        }
      } else {
        uid = authUser.user.id
        console.log(`   ✅ Auth user created.`)
      }

      // 2. Users table
      await client.query(`
        INSERT INTO users (id, name, role, lang)
        VALUES ($1, $2, 'puller', 'as')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
      `, [uid, p.name])

      // 3. Pullers table
      const dashIdx = p.badge.indexOf('-')
      const bCode = p.badge
      const bNum  = parseInt(p.badge.slice(dashIdx + 1))

      const pullerRes = await client.query(`
        INSERT INTO pullers (user_id, badge_code, badge_number, zone_id, status, is_online, total_rides, thumbs_up, vehicle_type, lat, lng)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'rickshaw', $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET 
          badge_code = EXCLUDED.badge_code,
          badge_number = EXCLUDED.badge_number,
          is_online = EXCLUDED.is_online,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng
        RETURNING id
      `, [uid, bCode, bNum, zoneIds[p.zone], p.status, p.is_online, p.total_rides, p.thumbs_up, p.lat, p.lng])

      const pullerRowId = pullerRes.rows[0].id

      // 4. Subscription
      await client.query(`
        INSERT INTO subscriptions (puller_id, status, valid_from, valid_till, amount)
        VALUES ($1, 'active', $2, $3, 100)
        ON CONFLICT DO NOTHING
      `, [pullerRowId, today.toISOString(), validTill.toISOString()])

      console.log(`   ✅ Puller profile & subscription created.`)
    }

    const countRes = await client.query('SELECT count(*) FROM pullers')
    console.log(`\n🎉  Seed completed! Total pullers: ${countRes.rows[0].count}`)

  } catch (err) {
    console.error('\n💥  Seed FAILED:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
