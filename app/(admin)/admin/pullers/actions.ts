'use server'

import { adminSupabase } from '@/lib/supabase/admin'
import { ZONE_PREFIXES } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PullerRow {
  id:           string
  userId:       string
  name:         string
  phone:        string | null
  zoneId:       string
  zoneName:     string
  zoneNameAs:   string
  zoneNumber:   number
  badgeCode:    string
  badgeNumber:  number
  status:       'pending' | 'active' | 'suspended'
  isOnline:     boolean
  totalRides:   number
  thumbsUp:     number
  lastActiveAt: string | null
  lat:          number | null
  lng:          number | null
  subValidTill: string | null   // most-recent subscription valid_till
  createdAt:    string
}

// ─── Fetch all pullers ────────────────────────────────────────────────────────

export async function fetchPullers(): Promise<PullerRow[]> {
  const [pullersRes, zonesRes, subsRes] = await Promise.all([
    adminSupabase
      .from('pullers')
      .select('id, user_id, badge_code, badge_number, zone_id, status, is_online, total_rides, thumbs_up, last_active_at, lat, lng, created_at')
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('zones')
      .select('id, zone_number, name, name_as'),
    adminSupabase
      .from('subscriptions')
      .select('puller_id, valid_till')
      .order('created_at', { ascending: false }),
  ])

  const pullers = pullersRes.data ?? []
  const zones   = zonesRes.data   ?? []
  const subs    = subsRes.data    ?? []

  if (!pullers.length) return []

  // Latest subscription per puller (already sorted desc, take first seen)
  const subMap: Record<string, string> = {}
  for (const s of subs) {
    if (!subMap[s.puller_id]) subMap[s.puller_id] = s.valid_till
  }

  const userIds = Array.from(new Set(pullers.map((p) => p.user_id)))
  const { data: users } = await adminSupabase
    .from('users')
    .select('id, name, phone')
    .in('id', userIds)

  const userMap: Record<string, { name: string; phone: string | null }> =
    Object.fromEntries((users ?? []).map((u) => [u.id, { name: u.name, phone: u.phone ?? null }]))
  const zoneMap: Record<string, typeof zones[number]> =
    Object.fromEntries(zones.map((z) => [z.id, z]))

  return pullers.map((p) => {
    const zone = zoneMap[p.zone_id]
    const user = userMap[p.user_id] ?? { name: 'Unknown', phone: null }
    return {
      id:           p.id,
      userId:       p.user_id,
      name:         user.name,
      phone:        user.phone,
      zoneId:       p.zone_id,
      zoneName:     zone?.name       ?? '—',
      zoneNameAs:   zone?.name_as    ?? '—',
      zoneNumber:   zone?.zone_number ?? 0,
      badgeCode:    p.badge_code,
      badgeNumber:  p.badge_number,
      status:       p.status as PullerRow['status'],
      isOnline:     p.is_online   ?? false,
      totalRides:   p.total_rides ?? 0,
      thumbsUp:     p.thumbs_up  ?? 0,
      lastActiveAt: p.last_active_at ?? null,
      lat:          p.lat ?? null,
      lng:          p.lng ?? null,
      subValidTill: subMap[p.id] ?? null,
      createdAt:    p.created_at,
    }
  })
}

// ─── Approve pending puller ───────────────────────────────────────────────────

export async function approvePuller(pullerId: string, zoneId: string): Promise<void> {
  let badgeCode: string
  let badgeNumber: number

  const { data: rpcData, error: rpcErr } = await adminSupabase
    .rpc('generate_badge', { p_zone_id: zoneId })

  if (!rpcErr && rpcData) {
    badgeCode   = (rpcData as { badge_code: string; badge_number: number }).badge_code
    badgeNumber = (rpcData as { badge_code: string; badge_number: number }).badge_number
  } else {
    const { data: zone } = await adminSupabase
      .from('zones').select('zone_number').eq('id', zoneId).maybeSingle()
    const { data: maxRow } = await adminSupabase
      .from('pullers').select('badge_number').eq('zone_id', zoneId)
      .order('badge_number', { ascending: false }).limit(1).maybeSingle()
    const prefix = ZONE_PREFIXES[zone?.zone_number ?? 0] ?? 'ZZ'
    badgeNumber  = (maxRow?.badge_number ?? 0) + 1
    badgeCode    = `${prefix}-${String(badgeNumber).padStart(3, '0')}`
  }

  const { error: updateErr } = await adminSupabase
    .from('pullers')
    .update({ status: 'active', badge_code: badgeCode, badge_number: badgeNumber })
    .eq('id', pullerId)
  if (updateErr) throw new Error(updateErr.message)

  const now = new Date()
  const validTill = new Date(now)
  validTill.setDate(validTill.getDate() + 30)

  const { error: subErr } = await adminSupabase
    .from('subscriptions')
    .insert({ puller_id: pullerId, status: 'active', valid_from: now.toISOString(), valid_till: validTill.toISOString(), amount: 500 })
  if (subErr) throw new Error(subErr.message)

  revalidatePath('/admin/pullers')
}

// ─── Reject / delete pending puller ──────────────────────────────────────────

export async function rejectPuller(pullerId: string): Promise<void> {
  const { error } = await adminSupabase.from('pullers').delete().eq('id', pullerId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/pullers')
}

// ─── Suspend active puller ────────────────────────────────────────────────────

export async function suspendPuller(pullerId: string): Promise<void> {
  // Force offline first so they drop from the map immediately
  const { error } = await adminSupabase
    .from('pullers')
    .update({ status: 'suspended', is_online: false })
    .eq('id', pullerId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/pullers')
}

// ─── Renew subscription (+30 days from today) ─────────────────────────────────

export async function renewSubscription(pullerId: string): Promise<void> {
  const now = new Date()
  const validTill = new Date(now)
  validTill.setDate(validTill.getDate() + 30)

  const { error } = await adminSupabase
    .from('subscriptions')
    .insert({ puller_id: pullerId, status: 'active', valid_from: now.toISOString(), valid_till: validTill.toISOString(), amount: 500 })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/pullers')
}
