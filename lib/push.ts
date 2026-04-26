import webpush from 'web-push';
import { adminSupabase } from '@/lib/supabase/admin';

// ── Client-side ──────────────────────────────────────────────────────────────

export async function registerPushSubscription(): Promise<void> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const subscription = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  });

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
}

// ── Server-side ───────────────────────────────────────────────────────────────

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushToUser(
  user_id: string,
  title: string,
  body: string,
  url: string = '/',
): Promise<void> {
  const { data: tokens, error } = await adminSupabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', user_id);

  if (error || !tokens?.length) return;

  await Promise.allSettled(
    tokens.map(({ token }) =>
      webpush.sendNotification(JSON.parse(token), JSON.stringify({ title, body, url }))
    )
  );
}
