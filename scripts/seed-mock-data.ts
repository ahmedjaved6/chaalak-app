/**
 * scripts/seed-mock-data.ts
 *
 * Seeds initial data for the Chaalak app:
 * 1. Zones, Sub-zones, Fare rules
 * 2. Auth Users (Passenger, Puller, Admin)
 * 3. Profiles (users, passengers, pullers)
 * 4. Subscriptions & Ride Requests
 *
 * Run:
 *   npx ts-node --project tsconfig.seed.json scripts/seed-mock-data.ts
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

// ── Data Definitions ─────────────────────────────────────────────────────────

const ZONES = [
  { name: 'Paltan Bazaar', name_as: 'পল্টান বজাৰ', zone_number: 1, color_hex: '#F59E0B', color_label: 'amber' },
  { name: 'Chandmari',     name_as: 'চান্দমাৰী',   zone_number: 2, color_hex: '#10B981', color_label: 'green' },
  { name: 'Dispur',        name_as: 'দিছপুৰ',      zone_number: 3, color_hex: '#3B82F6', color_label: 'blue' },
  { name: 'Beltola',       name_as: 'বেলতলা',      zone_number: 4, color_hex: '#8B5CF6', color_label: 'purple' },
]

const TEST_USERS = [
  { email: 'passenger@test.com', password: 'test1234', phone: '+919876543210', role: 'passenger', name: 'Test Passenger' },
  { email: 'puller@test.com',    password: 'test1234', phone: '+919876543211', role: 'puller',    name: 'Test Puller' },
  { email: 'admin@chaalak.app',  password: 'test1234', phone: '+919876543212', role: 'admin',     name: 'Chaalak Admin' },
]

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log('🔌  Connecting to DB …')
  const client = await pool.connect()

  try {
    // ── 1. Seed Zones ────────────────────────────────────────────────────────
    console.log('📍  Seeding Zones …')
    const zoneIds: Record<number, string> = {}
    for (const z of ZONES) {
      const res = await client.query(`
        INSERT INTO zones (name, name_as, zone_number, color_hex, color_label, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (zone_number) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [z.name, z.name_as, z.zone_number, z.color_hex, z.color_label])
      zoneIds[z.zone_number] = res.rows[0].id
    }

    // ── 2. Seed Sub-Zones ────────────────────────────────────────────────────
    console.log('🏘️  Seeding Sub-Zones …')
    const subZones = [
      { zone: 1, name: 'Railway Station', name_as: 'ৰেল ষ্টেচন' },
      { zone: 1, name: 'Solapara',        name_as: 'চোলাপাড়া' },
      { zone: 2, name: 'Commerce Point',  name_as: 'কমাৰ্চ পইণ্ট' },
      { zone: 3, name: 'Last Gate',       name_as: 'লাষ্ট গেট' },
      { zone: 4, name: 'Survey',          name_as: 'চাৰ্ভে' },
    ]
    for (const sz of subZones) {
      await client.query(`
        INSERT INTO sub_zones (zone_id, name, name_as, is_active)
        SELECT $1, $2, $3, true WHERE NOT EXISTS (SELECT 1 FROM sub_zones WHERE zone_id = $1 AND name = $2)
      `, [zoneIds[sz.zone], sz.name, sz.name_as])
    }

    // ── 3. Seed Fare Rules ───────────────────────────────────────────────────
    console.log('💰  Seeding Fare Rules …')
    for (const zNum of [1, 2, 3, 4]) {
      await client.query(`
        INSERT INTO fare_rules (from_zone_id, to_zone_id, vehicle_type, fare_min, fare_max)
        SELECT $1, $1, 'rickshaw', 30, 40 WHERE NOT EXISTS (SELECT 1 FROM fare_rules WHERE from_zone_id = $1 AND to_zone_id = $1)
      `, [zoneIds[zNum]])
    }

    // ── 4. Seed Auth Users & Profiles ────────────────────────────────────────
    console.log('👤  Seeding Auth Users …')
    const userIds: Record<string, string> = {}

    for (const u of TEST_USERS) {
      // Check if user exists in auth.users
      const existingAuth = await client.query('SELECT id FROM auth.users WHERE email = $1', [u.email])
      let uid: string

      if (existingAuth.rows.length > 0) {
        uid = existingAuth.rows[0].id
        console.log(`   🔸 Auth user ${u.email} already exists (${uid}).`)
      } else {
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          phone: u.phone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { role: u.role, name: u.name }
        })
        if (authErr) {
          console.error(`   ❌ Failed to create auth user ${u.email}:`, authErr.message)
          continue 
        }
        uid = authUser.user.id
        console.log(`   ✅ Auth user ${u.email} created.`)
      }
      userIds[u.role] = uid


      // Ensure users table row
      await client.query(`
        INSERT INTO users (id, phone, name, role, lang)
        VALUES ($1, $2, $3, $4, 'as')
        ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name
      `, [uid, u.phone, u.name, u.role])

    }

    // ── 5. Seed Passenger/Puller Details ────────────────────────────────────
    console.log('🆔  Seeding Passenger/Puller profiles …')
    
    // Passenger
    const passengerRes = await client.query(`
      INSERT INTO passengers (user_id, total_rides, thumbs_given, no_show_count)
      VALUES ($1, 12, 8, 0) ON CONFLICT (user_id) DO UPDATE SET total_rides = EXCLUDED.total_rides
      RETURNING id
    `, [userIds['passenger']])
    const passengerRowId = passengerRes.rows[0].id

    // Puller
    const pullerRes = await client.query(`
      INSERT INTO pullers (user_id, badge_code, badge_number, zone_id, status, is_online, total_rides, thumbs_up, vehicle_type)
      VALUES ($1, 'PB-47', 47, $2, 'active', false, 143, 61, 'rickshaw')
      ON CONFLICT (user_id) DO UPDATE SET badge_code = EXCLUDED.badge_code
      RETURNING id
    `, [userIds['puller'], zoneIds[1]])
    const pullerRowId = pullerRes.rows[0].id

    // Subscription
    console.log('💳  Seeding Subscriptions …')
    const today = new Date()
    const validTill = new Date()
    validTill.setDate(today.getDate() + 22)
    
    await client.query(`
      INSERT INTO subscriptions (puller_id, status, valid_from, valid_till, amount)
      SELECT $1, 'active', $2, $3, 100
      WHERE NOT EXISTS (
        SELECT 1 FROM subscriptions WHERE puller_id = $1 AND status = 'active'
      )
    `, [pullerRowId, today.toISOString(), validTill.toISOString()])


    // ── 6. Seed Ride Requests ───────────────────────────────────────────────
    console.log('🛺  Seeding Ride Requests …')
    const rideStats = ['completed', 'completed', 'cancelled', 'expired', 'requested']
    for (let i = 0; i < rideStats.length; i++) {
      const status = rideStats[i]
      const finalStatus = i === 4 ? 'accepted' : status // make 5th one accepted
      
      await client.query(`
        INSERT INTO ride_requests (
          passenger_id, zone_id, status, 
          passenger_lat, passenger_lng, 
          accepted_by, accepted_at,
          started_at, completed_at,
          expires_at
        )
        VALUES ($1, $2, $3, 26.1, 91.7, $4, $5, $6, $7, $8)
      `, [
        passengerRowId, 
        zoneIds[1], 
        finalStatus,
        finalStatus !== 'requested' && finalStatus !== 'expired' ? pullerRowId : null,
        finalStatus !== 'requested' && finalStatus !== 'expired' ? new Date().toISOString() : null,
        finalStatus === 'completed' ? new Date().toISOString() : null,
        finalStatus === 'completed' ? new Date().toISOString() : null,
        new Date(Date.now() + 3600000).toISOString()
      ])
    }


    // ── 7. Summary ──────────────────────────────────────────────────────────
    console.log('\n📊  SEED SUMMARY')
    console.table([
      { Role: 'Passenger', Email: 'passenger@test.com', ID: userIds['passenger'] },
      { Role: 'Puller',    Email: 'puller@test.com',    ID: userIds['puller'] },
      { Role: 'Admin',     Email: 'admin@chaalak.app',  ID: userIds['admin'] },
    ])
    console.log('   Zone 1 ID:', zoneIds[1])
    console.log('   Puller Row ID:', pullerRowId)
    console.log('\n🎉  Seed completed successfully!')

  } catch (err) {
    console.error('\n💥  Seed FAILED:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
