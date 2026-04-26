'use server'

import { adminSupabase } from '@/lib/supabase/admin'

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface Metrics {
  activeRides:     number
  onlinePullers:   number
  openRequests:    number
  expiredLastHour: number
}

// ─── Map data ─────────────────────────────────────────────────────────────────

export interface PullerDot {
  id:         string
  lat:        number
  lng:        number
  zoneNumber: number
}

export interface PassengerDot {
  id:  string
  lat: number
  lng: number
}

// ─── Zone health ──────────────────────────────────────────────────────────────

export interface ZoneHealth {
  zoneId:     string
  zoneNumber: number
  nameAs:     string
  online:     number
  total:      number
}

// ─── Stale requests ───────────────────────────────────────────────────────────

export interface StaleRequest {
  id:         string
  zoneName:   string
  ageSeconds: number
}

// ─── Combined payload ─────────────────────────────────────────────────────────

export interface DashboardData {
  metrics:       Metrics
  pullers:       PullerDot[]
  passengers:    PassengerDot[]
  zoneHealth:    ZoneHealth[]
  staleRequests: StaleRequest[]
  fetchedAt:     string
}

// ─── Main action (all parallel) ───────────────────────────────────────────────

export async function fetchDashboardData(): Promise<DashboardData> {
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const twoMinAgo  = new Date(Date.now() -   120_000).toISOString()

  const [
    activeRes,
    onlineCountRes,
    openRes,
    expiredRes,
    pullersGeoRes,
    ridesGeoRes,
    zonesRes,
    allPullersRes,
    staleRes,
  ] = await Promise.all([
    // Metrics
    adminSupabase.from('ride_requests').select('*', { count: 'exact', head: true }).in('status', ['accepted', 'active']),
    adminSupabase.from('pullers').select('*', { count: 'exact', head: true }).eq('is_online', true),
    adminSupabase.from('ride_requests').select('*', { count: 'exact', head: true }).eq('status', 'requested'),
    adminSupabase.from('ride_requests').select('*', { count: 'exact', head: true }).eq('status', 'expired').gte('created_at', oneHourAgo),

    // Map — online pullers with position
    adminSupabase.from('pullers').select('id, lat, lng, zone_id').eq('is_online', true).not('lat', 'is', null).not('lng', 'is', null),

    // Map — active rides with passenger position
    adminSupabase.from('ride_requests').select('id, passenger_lat, passenger_lng').in('status', ['accepted', 'active']).not('passenger_lat', 'is', null).not('passenger_lng', 'is', null),

    // Zone health — all zones ordered
    adminSupabase.from('zones').select('id, zone_number, name_as').order('zone_number'),

    // Zone health — all active-status pullers with online flag
    adminSupabase.from('pullers').select('zone_id, is_online').eq('status', 'active'),

    // Stale — requested rides older than 2 min
    adminSupabase.from('ride_requests').select('id, created_at, zone_id').eq('status', 'requested').lt('created_at', twoMinAgo),
  ])

  // ── Build zone map (id → zone_number) for puller dots ─────────────────────

  const zones     = zonesRes.data  ?? []
  const zoneById  = Object.fromEntries(zones.map((z) => [z.id, z.zone_number as number]))
  const nameById  = Object.fromEntries(zones.map((z) => [z.id, z.name_as  as string]))

  // ── Puller dots ───────────────────────────────────────────────────────────

  const pullers: PullerDot[] = (pullersGeoRes.data ?? []).map((p) => ({
    id:         p.id,
    lat:        p.lat  as number,
    lng:        p.lng  as number,
    zoneNumber: zoneById[p.zone_id] ?? 1,
  }))

  // ── Passenger dots ────────────────────────────────────────────────────────

  const passengers: PassengerDot[] = (ridesGeoRes.data ?? []).map((r) => ({
    id:  r.id,
    lat: r.passenger_lat as number,
    lng: r.passenger_lng as number,
  }))

  // ── Zone health ───────────────────────────────────────────────────────────

  const allPullers = allPullersRes.data ?? []
  const zoneHealth: ZoneHealth[] = zones.map((z) => {
    const zp = allPullers.filter((p) => p.zone_id === z.id)
    return {
      zoneId:     z.id,
      zoneNumber: z.zone_number,
      nameAs:     z.name_as,
      online:     zp.filter((p) => p.is_online).length,
      total:      zp.length,
    }
  })

  // ── Stale requests ────────────────────────────────────────────────────────

  const now = Date.now()
  const staleRequests: StaleRequest[] = (staleRes.data ?? []).map((r) => ({
    id:         r.id,
    zoneName:   nameById[r.zone_id] ?? 'Unknown',
    ageSeconds: Math.floor((now - new Date(r.created_at).getTime()) / 1_000),
  }))

  return {
    metrics: {
      activeRides:     activeRes.count     ?? 0,
      onlinePullers:   onlineCountRes.count ?? 0,
      openRequests:    openRes.count        ?? 0,
      expiredLastHour: expiredRes.count     ?? 0,
    },
    pullers,
    passengers,
    zoneHealth,
    staleRequests,
    fetchedAt: new Date().toISOString(),
  }
}
