import type { SupabaseClient } from '@supabase/supabase-js'
import { RIDE_TTL_SECONDS } from './constants'

// ─── createRideRequest ────────────────────────────────────────────────────────

export async function createRideRequest(
  supabase: SupabaseClient,
  passenger_id: string,
  zone_id: string,
  sub_zone_id: string | null,
  lat: number | null,
  lng: number | null,
): Promise<string> {
  // Guard: no concurrent active ride
  const { data: existing } = await supabase
    .from('ride_requests')
    .select('id')
    .eq('passenger_id', passenger_id)
    .in('status', ['requested', 'accepted', 'active'])
    .maybeSingle()

  if (existing) throw new Error('Already has active ride')

  const { data, error } = await supabase
    .from('ride_requests')
    .insert({
      passenger_id,
      zone_id,
      sub_zone_id:   sub_zone_id ?? null,
      status:        'requested',
      passenger_lat: lat,
      passenger_lng: lng,
      expires_at:    new Date(Date.now() + RIDE_TTL_SECONDS * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

// ─── cancelRideRequest ────────────────────────────────────────────────────────

export async function cancelRideRequest(
  supabase: SupabaseClient,
  ride_id: string,
  passenger_id: string,
): Promise<void> {
  const { error } = await supabase
    .from('ride_requests')
    .update({ status: 'cancelled' })
    .eq('id', ride_id)
    .eq('passenger_id', passenger_id)
    .in('status', ['requested', 'accepted'])

  if (error) throw new Error(error.message)
}

// ─── acceptRide ───────────────────────────────────────────────────────────────
// Calls the atomic DB-side RPC so two pullers can't accept the same ride.
// Returns false if the race was lost (RPC errors or returns null).
//
// Required SQL (add to migration):
//   CREATE OR REPLACE FUNCTION accept_ride(ride_id uuid, puller_id uuid)
//   RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
//     UPDATE ride_requests
//     SET status='accepted', accepted_by=puller_id, accepted_at=now()
//     WHERE id=ride_id AND status='requested'
//     RETURNING id;
//   $$;

export async function acceptRide(
  supabase: SupabaseClient,
  ride_id: string,
  puller_id: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_ride', { ride_id, puller_id })
  if (error || data == null) return false
  return true
}

// ─── startRide ────────────────────────────────────────────────────────────────

export async function startRide(
  supabase: SupabaseClient,
  ride_id: string,
  puller_id: string,
): Promise<void> {
  const { error } = await supabase
    .from('ride_requests')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', ride_id)
    .eq('accepted_by', puller_id)

  if (error) throw new Error(error.message)
}

// ─── endRide ──────────────────────────────────────────────────────────────────

export async function endRide(
  supabase: SupabaseClient,
  ride_id: string,
  puller_id: string,
): Promise<void> {
  const { error } = await supabase
    .from('ride_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', ride_id)
    .eq('accepted_by', puller_id)

  if (error) throw new Error(error.message)
}

// ─── markNoShow ───────────────────────────────────────────────────────────────

export async function markNoShow(
  supabase: SupabaseClient,
  ride_id: string,
  puller_id: string,
): Promise<void> {
  const { error } = await supabase
    .from('ride_requests')
    .update({ status: 'no_show' })
    .eq('id', ride_id)
    .eq('accepted_by', puller_id)

  if (error) throw new Error(error.message)
}
