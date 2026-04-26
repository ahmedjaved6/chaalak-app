import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const { passenger_id } = await req.json()

    if (!passenger_id) {
      return NextResponse.json({ error: 'passenger_id is required' }, { status: 400 })
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Count cancellations and no-shows in the last week
    const { count, error: countErr } = await adminSupabase
      .from('ride_requests')
      .select('*', { count: 'exact', head: true })
      .eq('passenger_id', passenger_id)
      .in('status', ['cancelled', 'no_show'])
      .gte('created_at', weekAgo)

    if (countErr) {
      console.error('Error counting rides:', countErr)
      return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    if (count !== null && count >= 3) {
      const cooldownUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      
      const { error: updateErr } = await adminSupabase
        .from('passengers')
        .update({ cooldown_until: cooldownUntil })
        .eq('id', passenger_id)

      if (updateErr) {
        console.error('Error updating cooldown:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ cooldown: true, cooldown_until: cooldownUntil })
    }

    return NextResponse.json({ cooldown: false })
  } catch (err: unknown) {
    console.error('Cooldown check failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
