import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkDatabase() {
  const { adminSupabase } = await import('../lib/supabase/admin')
  
  const tables = [
    'users', 'passengers', 'pullers', 'zones', 
    'sub_zones', 'ride_requests', 'subscriptions', 
    'fare_rules', 'admin_logs', 'push_tokens'
  ]

  console.log('═══════════════════════════════════════')
  console.log('DATABASE CHECK')
  console.log('═══════════════════════════════════════')

  for (const table of tables) {
    const { count, error } = await adminSupabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.log(`${table}: MISSING or ERROR (${error.message})`)
    } else {
      console.log(`${table}: EXISTS (Rows: ${count})`)
    }
  }

  const rpcs = ['accept_ride', 'puller_heartbeat', 'expire_stale_requests', 'generate_badge']
  for (const rpc of rpcs) {
      const { error } = await adminSupabase.rpc(rpc, {})
      if (error && error.message.includes('does not exist')) {
          console.log(`RPC ${rpc}: MISSING`)
      } else {
          console.log(`RPC ${rpc}: EXISTS (or param issue)`)
      }
  }

  const { data: pullerStatus } = await adminSupabase.from('pullers').select('status')
  const statusCounts = pullerStatus?.reduce((acc: any, p: any) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
  }, {})
  console.log('Puller Status:', statusCounts)

  const { data: rideStatus } = await adminSupabase.from('ride_requests').select('status')
  const rideCounts = rideStatus?.reduce((acc: any, r: any) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
  }, {})
  console.log('Ride Status:', rideCounts)

  const { count: activeSubs } = await adminSupabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active')
  console.log('Active Subscriptions:', activeSubs)
}

checkDatabase().catch(console.error)
