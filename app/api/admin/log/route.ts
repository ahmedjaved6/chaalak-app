import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { user_id, ride_id, role, event, details } = await req.json()

    const { error } = await adminSupabase
      .from('admin_logs')
      .insert({
        user_id,
        ride_id,
        role,
        event,
        details
      })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Logging error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

