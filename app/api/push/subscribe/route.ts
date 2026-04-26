import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const { subscription, user_id } = await req.json();

  const { error } = await adminSupabase
    .from('push_tokens')
    .upsert(
      {
        user_id,
        token: JSON.stringify(subscription),
        platform: 'web',
      },
      { onConflict: 'user_id,platform' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
