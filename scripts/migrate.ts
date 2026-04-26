import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Client } from 'pg'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('\n❌  DATABASE_URL not set in .env.local')
  console.error('    Supabase Dashboard → Project Settings → Database → URI\n')
  process.exit(1)
}

const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

async function run(sql: string, label: string) {
  try {
    await db.query(sql)
    console.log(`  ✓  ${label}`)
  } catch (err: any) {
    console.error(`  ✗  ${label}: ${err.message}`)
    throw err
  }
}

// ─── PART 1 · Enums ───────────────────────────────────────────────────────────

const ENUMS = `
DO $$ BEGIN CREATE TYPE user_role          AS ENUM ('passenger','puller','admin');           EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE vehicle_type       AS ENUM ('rickshaw','auto','bike','car');          EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ride_status        AS ENUM ('requested','accepted','active','completed','cancelled','expired','no_show'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE puller_status      AS ENUM ('pending','active','suspended');          EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('active','inactive','expired');          EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE language_pref      AS ENUM ('as','hi','en');                          EXCEPTION WHEN duplicate_object THEN null; END $$;
`

// ─── PART 1 · Tables ──────────────────────────────────────────────────────────

const TABLES: { label: string; sql: string }[] = [
  {
    label: 'zones',
    sql: `
      CREATE TABLE IF NOT EXISTS zones (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT        NOT NULL,
        name_as      TEXT        NOT NULL,
        name_hi      TEXT        NOT NULL,
        color_hex    TEXT        NOT NULL,
        color_label  TEXT        NOT NULL,
        zone_number  INT         NOT NULL UNIQUE,
        is_active    BOOLEAN     NOT NULL DEFAULT true,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
  },
  {
    label: 'sub_zones',
    sql: `
      CREATE TABLE IF NOT EXISTS sub_zones (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        zone_id    UUID        NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
        name       TEXT        NOT NULL,
        name_as    TEXT        NOT NULL,
        name_hi    TEXT        NOT NULL,
        is_active  BOOLEAN     NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sub_zones_zone_id ON sub_zones(zone_id);`,
  },
  {
    label: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id            UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email         TEXT          NOT NULL UNIQUE,
        name          TEXT          NOT NULL,
        phone         TEXT,
        role          user_role     NOT NULL DEFAULT 'passenger',
        language_pref language_pref NOT NULL DEFAULT 'en',
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
      );`,
  },
  {
    label: 'passengers',
    sql: `
      CREATE TABLE IF NOT EXISTS passengers (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        total_rides   INT         NOT NULL DEFAULT 0,
        no_show_count INT         NOT NULL DEFAULT 0,
        is_banned     BOOLEAN     NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_passengers_user_id ON passengers(user_id);`,
  },
  {
    label: 'pullers',
    sql: `
      CREATE TABLE IF NOT EXISTS pullers (
        id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        badge_code     TEXT          NOT NULL UNIQUE,
        badge_number   INT           NOT NULL,
        zone_id        UUID          NOT NULL REFERENCES zones(id),
        is_online      BOOLEAN       NOT NULL DEFAULT false,
        lat            DOUBLE PRECISION,
        lng            DOUBLE PRECISION,
        last_active_at TIMESTAMPTZ,
        total_rides    INT           NOT NULL DEFAULT 0,
        thumbs_up      INT           NOT NULL DEFAULT 0,
        status         puller_status NOT NULL DEFAULT 'pending',
        photo_url      TEXT,
        vehicle_type   vehicle_type  NOT NULL DEFAULT 'rickshaw',
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pullers_zone_id  ON pullers(zone_id);
      CREATE INDEX IF NOT EXISTS idx_pullers_is_online ON pullers(is_online);
      CREATE INDEX IF NOT EXISTS idx_pullers_status   ON pullers(status);`,
  },
  {
    label: 'ride_requests',
    sql: `
      CREATE TABLE IF NOT EXISTS ride_requests (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        passenger_id  UUID        NOT NULL REFERENCES passengers(id),
        zone_id       UUID        NOT NULL REFERENCES zones(id),
        sub_zone_id   UUID        REFERENCES sub_zones(id),
        status        ride_status NOT NULL DEFAULT 'requested',
        accepted_by   UUID        REFERENCES pullers(id),
        passenger_lat DOUBLE PRECISION,
        passenger_lng DOUBLE PRECISION,
        accepted_at   TIMESTAMPTZ,
        started_at    TIMESTAMPTZ,
        completed_at  TIMESTAMPTZ,
        expires_at    TIMESTAMPTZ,
        thumbs_up     BOOLEAN,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger_id ON ride_requests(passenger_id);
      CREATE INDEX IF NOT EXISTS idx_ride_requests_zone_id      ON ride_requests(zone_id);
      CREATE INDEX IF NOT EXISTS idx_ride_requests_status       ON ride_requests(status);
      CREATE INDEX IF NOT EXISTS idx_ride_requests_accepted_by  ON ride_requests(accepted_by);`,
  },
  {
    label: 'subscriptions',
    sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id         UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
        puller_id  UUID                  NOT NULL REFERENCES pullers(id) ON DELETE CASCADE,
        status     subscription_status  NOT NULL DEFAULT 'inactive',
        valid_from TIMESTAMPTZ           NOT NULL,
        valid_till TIMESTAMPTZ           NOT NULL,
        amount     NUMERIC(10,2)         NOT NULL,
        created_at TIMESTAMPTZ           NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_puller_id ON subscriptions(puller_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);`,
  },
  {
    label: 'fare_rules',
    sql: `
      CREATE TABLE IF NOT EXISTS fare_rules (
        id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        from_zone_id UUID          NOT NULL REFERENCES zones(id),
        to_zone_id   UUID          NOT NULL REFERENCES zones(id),
        base_fare    NUMERIC(10,2) NOT NULL DEFAULT 30,
        per_km_rate  NUMERIC(10,2) NOT NULL DEFAULT 12,
        min_fare     NUMERIC(10,2) NOT NULL DEFAULT 20,
        is_active    BOOLEAN       NOT NULL DEFAULT true,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
        UNIQUE(from_zone_id, to_zone_id)
      );`,
  },
  {
    label: 'admin_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS admin_logs (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id    UUID        NOT NULL REFERENCES users(id),
        action      TEXT        NOT NULL,
        target_id   UUID,
        target_type TEXT,
        details     JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON admin_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);`,
  },
  {
    label: 'push_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS push_tokens (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT        NOT NULL,
        platform   TEXT        NOT NULL DEFAULT 'web',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(user_id, platform)
      );
      CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);`,
  },
]

// ─── PART 2 · Seed ────────────────────────────────────────────────────────────

const SEED_ZONES = `
INSERT INTO zones (name, name_as, name_hi, color_hex, color_label, zone_number) VALUES
  ('Pan Bazar', 'পান বজাৰ',   'पान बाज़ार', '#F59E0B', 'amber',  1),
  ('Chandmari', 'চান্দমাৰী',  'चांदमारी',   '#10B981', 'green',  2),
  ('Dispur',    'দিছপুৰ',      'दिसपुर',     '#3B82F6', 'blue',   3),
  ('Beltola',   'বেলটোলা',    'बेलतोला',    '#8B5CF6', 'purple', 4)
ON CONFLICT (zone_number) DO NOTHING;
`

const SEED_SUB_ZONES = `
WITH z AS (SELECT id, zone_number FROM zones)
INSERT INTO sub_zones (zone_id, name, name_as, name_hi)
SELECT z.id, v.name, v.name_as, v.name_hi
FROM (VALUES
  (1, 'Pan Bazar Main', 'পান বজাৰ মেইন',       'पान बाज़ार मेन'),
  (1, 'Fancy Bazar',    'ফেন্সী বজাৰ',          'फैंसी बाज़ार'),
  (1, 'Paltan Bazar',   'পল্টন বজাৰ',           'पल्टन बाज़ार'),
  (1, 'Uzan Bazar',     'উজান বজাৰ',            'उजान बाज़ार'),
  (2, 'Chandmari Main', 'চান্দমাৰী মেইন',       'चांदमारी मेन'),
  (2, 'Six Mile',       'ছয় মাইল',             'सिक्स माइल'),
  (2, 'Ganeshguri',     'গণেশগুৰি',             'गणेशगुड़ी'),
  (2, 'Bhangagarh',     'ভাঙাগড়',               'भांगागढ़'),
  (3, 'Dispur Main',    'দিছপুৰ মেইন',          'दिसपुर मेन'),
  (3, 'Guwahati Club',  'গুৱাহাটী ক্লাব',      'गुवाहाटी क्लब'),
  (3, 'Lachit Nagar',   'লাচিত নগৰ',            'लाचित नगर'),
  (3, 'Hatigaon',       'হাতীগাঁও',             'हाथीगांव'),
  (4, 'Beltola Main',   'বেলটোলা মেইন',         'बेलतोला मेन'),
  (4, 'VIP Road',       'ভিআইপি ৰোড',           'वीआईपी रोड'),
  (4, 'Zoo Narengi',    'চিৰিয়াখানা নাৰেংগী',  'जू नरेंगी'),
  (4, 'Bora Service',   'বৰা চাৰ্ভিচ',          'बोरा सर्विस')
) AS v(zone_num, name, name_as, name_hi)
JOIN z ON z.zone_number = v.zone_num
ON CONFLICT DO NOTHING;
`

// 16 fare rules via cross join – fares scale with zone distance
const SEED_FARE_RULES = `
WITH z AS (SELECT id, zone_number FROM zones)
INSERT INTO fare_rules (from_zone_id, to_zone_id, base_fare, per_km_rate, min_fare)
SELECT
  f.id,
  t.id,
  CASE ABS(f.zone_number - t.zone_number)
    WHEN 0 THEN 30  WHEN 1 THEN 40  WHEN 2 THEN 60  ELSE 80 END,
  CASE ABS(f.zone_number - t.zone_number)
    WHEN 0 THEN 10  WHEN 1 THEN 12  WHEN 2 THEN 14  ELSE 16 END,
  CASE ABS(f.zone_number - t.zone_number)
    WHEN 0 THEN 20  WHEN 1 THEN 30  WHEN 2 THEN 45  ELSE 60 END
FROM z f CROSS JOIN z t
ON CONFLICT (from_zone_id, to_zone_id) DO NOTHING;
`

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  await db.connect()
  console.log('✓  Connected to Supabase\n')

  console.log('── Part 1 · Enums ──────────────────────────')
  await run(ENUMS, '6 enum types')

  console.log('\n── Part 1 · Tables ─────────────────────────')
  for (const { label, sql } of TABLES) {
    await run(sql, label)
  }

  console.log('\n── Part 2 · Seed data ──────────────────────')
  await run(SEED_ZONES,      '4 zones')
  await run(SEED_SUB_ZONES,  '16 sub-zones')
  await run(SEED_FARE_RULES, '16 fare rules (4×4 zone matrix)')

  // ── Verify ────────────────────────────────────────────────────────────────
  const { rows } = await db.query('SELECT count(*)::int AS n FROM zones')
  const n: number = rows[0].n
  console.log(`\n── Verify ──────────────────────────────────`)
  console.log(`  zones.count = ${n}`)
  if (n !== 4) throw new Error(`Expected 4 zones, got ${n}`)
  console.log('  ✓  zones count = 4')

  await db.end()
  console.log('\n🎉  Migration complete!\n')
}

main().catch((err) => {
  console.error('\n❌  Migration failed:', err.message)
  db.end().catch(() => {})
  process.exit(1)
})
