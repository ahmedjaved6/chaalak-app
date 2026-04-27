import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Client } from 'pg'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  await db.connect()
  console.log('connected')

  const sql = `
    UPDATE pullers SET 
      is_online=true,
      last_active_at=now(),
      lat=CASE badge_code
        WHEN 'PB-47' THEN 26.1445
        WHEN 'PB-12' THEN 26.1478
        WHEN 'PB-31' THEN 26.1420
        WHEN 'CH-08' THEN 26.1589
        WHEN 'DS-15' THEN 26.1312
        WHEN 'BT-03' THEN 26.1198
        ELSE 26.1445
      END,
      lng=CASE badge_code
        WHEN 'PB-47' THEN 91.7362
        WHEN 'PB-12' THEN 91.7401
        WHEN 'PB-31' THEN 91.7380
        WHEN 'CH-08' THEN 91.7214
        WHEN 'DS-15' THEN 91.7589
        WHEN 'BT-03' THEN 91.7445
        ELSE 91.7362
      END
    WHERE status='active';
  `

  const res = await db.query(sql)
  console.log('Updated rows:', res.rowCount)

  await db.end()
}

main().catch(console.error)
