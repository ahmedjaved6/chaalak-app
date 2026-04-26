import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const dbUrl = process.env.DATABASE_URL!

async function migrate() {
  const client = new Client({
    connectionString: dbUrl,
  })

  try {
    await client.connect()
    console.log('Connected to database.')

    console.log('Adding cooldown_until column to passengers table...')
    await client.query(`
      ALTER TABLE passengers ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;
    `)
    console.log('Column added successfully.')

  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.end()
  }
}

migrate()
