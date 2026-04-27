import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = await createServerSupabaseClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        
        const role = userData?.role || 'passenger'
        
        if (role === 'admin') {
          return NextResponse.redirect(`${origin}/admin/dashboard`)
        } else if (role === 'puller') {
          return NextResponse.redirect(`${origin}/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/`)
        }
      }
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change',
    })
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role, id')
          .eq('id', user.id)
          .single()

        if (!userData) {
          const pendingRole = 'passenger'
          await supabase.from('users').insert({
            id: user.id,
            role: pendingRole,
            lang: 'as'
          })
          await supabase.from('passengers').insert({
            user_id: user.id,
            total_rides: 0,
            thumbs_given: 0,
            no_show_count: 0
          })
          return NextResponse.redirect(`${origin}/`)
        }

        const role = userData.role
        if (role === 'admin') {
          return NextResponse.redirect(`${origin}/admin/dashboard`)
        } else if (role === 'puller') {
          return NextResponse.redirect(`${origin}/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
