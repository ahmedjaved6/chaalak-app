import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('pullers')
    .select('id, badge_code, lat, lng, is_online, zone_id')
    .eq('is_online', true)
  
  console.log('data:', data)
  console.log('error:', error)
}

main().catch(console.error)
