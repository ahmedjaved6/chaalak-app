import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { adminSupabase } from '@/lib/supabase/admin';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(req: NextRequest) {
  const { user_id, title, body, url = '/' } = await req.json();

  const { data: tokens, error } = await adminSupabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tokens?.length) {
    return NextResponse.json({ sent: 0 }, { status: 200 });
  }

  const results = await Promise.allSettled(
    tokens.map(({ token }) =>
      webpush.sendNotification(JSON.parse(token), JSON.stringify({ title, body, url }))
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;

  return NextResponse.json({ sent }, { status: 200 });
}
