'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { Zone, FareRule } from '@/lib/types'
import type { OnlinePuller, PassengerMapProps } from './_components/PassengerMap'

// ─── Dynamic Leaflet map (SSR disabled) ───────────────────────────────────────

const PassengerMap = dynamic<PassengerMapProps>(
  () => import('./_components/PassengerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center" style={{ background: '#0f1117' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    ),
  }
)

// ─── Fallback zones (if DB not yet seeded) ────────────────────────────────────

const FALLBACK_ZONES: Zone[] = [
  { id: '__1', name: 'Pan Bazar',  name_as: 'পান বজাৰ',  name_hi: 'पान बाज़ार', color_hex: '#F59E0B', color_label: 'amber',  zone_number: 1, is_active: true },
  { id: '__2', name: 'Chandmari', name_as: 'চান্দমাৰী', name_hi: 'चांदमारी',   color_hex: '#10B981', color_label: 'green',  zone_number: 2, is_active: true },
  { id: '__3', name: 'Dispur',    name_as: 'দিছপুৰ',    name_hi: 'दिसपुर',     color_hex: '#3B82F6', color_label: 'blue',   zone_number: 3, is_active: true },
  { id: '__4', name: 'Beltola',   name_as: 'বেলটোলা',   name_hi: 'बेलतोला',    color_hex: '#8B5CF6', color_label: 'purple', zone_number: 4, is_active: true },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ZoneLabelOverlay({ zone }: { zone: Zone | null }) {
  if (!zone) return null
  const c = ZONE_COLORS[zone.zone_number]
  return (
    <div
      className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white"
      style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)', border: `1.5px solid ${c?.hex ?? '#888'}40` }}
    >
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: c?.hex ?? '#888' }}
      />
      {zone.name_as}
    </div>
  )
}

function OnlineBadge({ count }: { count: number }) {
  return (
    <div
      className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold"
      style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)', color: count > 0 ? '#10B981' : 'rgba(255,255,255,0.5)' }}
    >
      <div
        className="h-2 w-2 rounded-full"
        style={{ background: count > 0 ? '#10B981' : '#4B5563', boxShadow: count > 0 ? '0 0 6px #10B981' : 'none' }}
      />
      {count} online
    </div>
  )
}

function ZoneCard({ zone, selected, onSelect }: { zone: Zone; selected: boolean; onSelect: () => void }) {
  const c = ZONE_COLORS[zone.zone_number] ?? { hex: '#888' }
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col gap-2.5 rounded-2xl p-3.5 text-left transition-all duration-150 active:scale-[0.96]"
      style={{
        background: selected ? `${c.hex}18` : 'rgba(255,255,255,0.05)',
        border: `2px solid ${selected ? c.hex : 'rgba(255,255,255,0.09)'}`,
        boxShadow: selected ? `0 0 0 1px ${c.hex}30, 0 4px 18px ${c.hex}20` : 'none',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-base font-black text-white"
        style={{ background: c.hex, boxShadow: `0 2px 8px ${c.hex}50` }}
      >
        {zone.zone_number}
      </div>
      <div>
        <p className="text-[14px] font-black leading-tight text-white">{zone.name_as}</p>
        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {zone.name}
        </p>
      </div>
    </button>
  )
}

function FareStrip({ fare }: { fare: FareRule | null }) {
  if (!fare) return (
    <div
      className="flex items-center justify-center rounded-xl px-4 py-2.5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Select a zone to see fare
      </p>
    </div>
  )

  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-2.5"
      style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}
    >
      <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>
        💰 Fare range
      </span>
      <div className="flex items-center gap-3">
        <FarePill label="From" value={`₹${fare.fare_min}`} />
        <FarePill label="To" value={`₹${fare.fare_max}`} />
      </div>
    </div>
  )
}


function FarePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-black text-white">{value}</span>
      <span className="text-[9px] font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PassengerHomePage() {
  const router = useRouter()

  const [passengerPos, setPassengerPos]     = useState<[number, number] | null>(null)
  const [onlinePullers, setOnlinePullers]   = useState<OnlinePuller[]>([])
  const [zones, setZones]                   = useState<Zone[]>(FALLBACK_ZONES)
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')
  const [fareRule, setFareRule]             = useState<FareRule | null>(null)
  const [passengerId, setPassengerId]       = useState<string>('')
  const [loading, setLoading]               = useState(true)
  const [booking, setBooking]               = useState(false)
  const [bookError, setBookError]           = useState('')

  const sbRef = useRef(createClient())

  // ── Fetch online pullers ─────────────────────────────────────────────────

  const fetchOnlinePullers = useCallback(async () => {
    const { data } = await sbRef.current
      .from('pullers')
      .select('id, lat, lng')
      .eq('is_online', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
    setOnlinePullers((data as OnlinePuller[]) ?? [])
  }, [])

  // ── Auth + initial data load ─────────────────────────────────────────────

  useEffect(() => {
    const supabase = sbRef.current

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      // Load zones from DB (or keep fallback)
      const { data: zonesData } = await supabase
        .from('zones')
        .select('*')
        .eq('is_active', true)
        .order('zone_number')
      if (zonesData && zonesData.length > 0) setZones(zonesData as Zone[])

      // Ensure passenger record exists
      let { data: passenger } = await supabase
        .from('passengers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!passenger) {
        const { data: newP } = await supabase
          .from('passengers')
          .insert({ user_id: user.id })
          .select('id')
          .single()
        passenger = newP
      }
      if (passenger) setPassengerId(passenger.id)

      // Check for already-active ride
      if (passenger) {
        const { data: active } = await supabase
          .from('ride_requests')
          .select('id')
          .eq('passenger_id', passenger.id)
          .in('status', ['requested', 'accepted', 'active'])
          .maybeSingle()
        if (active) { router.replace('/ride'); return }
      }

      await fetchOnlinePullers()
      setLoading(false)
    }

    init()
  }, [router, fetchOnlinePullers])

  // ── Geolocation ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setPassengerPos([pos.coords.latitude, pos.coords.longitude]),
      () => { /* silent — map centers on Guwahati */ },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // ── Realtime subscription + 15s polling ──────────────────────────────────

  useEffect(() => {
    const supabase = sbRef.current

    // Realtime: any change on pullers table triggers a refresh
    const channel = supabase
      .channel('passenger-pullers-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pullers' },
        () => { fetchOnlinePullers() }
      )
      .subscribe()

    // Fallback polling every 15 s
    const interval = setInterval(fetchOnlinePullers, 15_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchOnlinePullers])

  // ── Fare rules when zone changes ─────────────────────────────────────────

  useEffect(() => {
    if (!selectedZoneId) { setFareRule(null); return }
    sbRef.current
      .from('fare_rules')
      .select('*')
      .eq('from_zone_id', selectedZoneId)
      .eq('to_zone_id', selectedZoneId)
      .maybeSingle()
      .then(({ data }) => setFareRule(data as FareRule | null))
  }, [selectedZoneId])


  // ── Book ride ────────────────────────────────────────────────────────────

  async function handleBook() {
    if (!selectedZoneId || !passengerId || booking) return
    setBooking(true)
    setBookError('')

    const { error } = await sbRef.current.from('ride_requests').insert({
      passenger_id:  passengerId,
      zone_id:       selectedZoneId,
      status:        'requested',
      passenger_lat: passengerPos?.[0] ?? null,
      passenger_lng: passengerPos?.[1] ?? null,
      expires_at:    new Date(Date.now() + 180_000).toISOString(),
    })

    setBooking(false)
    if (error) { setBookError(error.message); return }

    // Register passenger for push so they receive the 'puller accepted' notification.
    // Dynamic import keeps server-side webpush code out of the client bundle.
    import('@/lib/push').then(({ registerPushSubscription }) => {
      registerPushSubscription().catch(() => { /* non-critical */ })
    })

    router.push('/ride')
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: '#1A1A1E' }}
      >
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{ backgroundColor: '#1A1A1E' }}
    >

      {/* ── TOP HALF: Map ─────────────────────────────────────────────────── */}
      <div className="relative shrink-0" style={{ height: '45dvh', minHeight: 200 }}>
        <PassengerMap
          passengerPos={passengerPos}
          pullers={onlinePullers}
        />

        {/* Zone label overlay — top left */}
        <ZoneLabelOverlay zone={selectedZone} />

        {/* Online count overlay — top right */}
        <OnlineBadge count={onlinePullers.length} />
      </div>

      {/* ── BOTTOM HALF: Booking ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-4 pb-6">

        {/* Section label */}
        <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          জ&apos;ন বাছক · Select Zone
        </p>

        {/* 2×2 zone grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              selected={selectedZoneId === zone.id}
              onSelect={() => setSelectedZoneId(zone.id)}
            />
          ))}
        </div>

        {/* Fare hint strip */}
        <div className="mt-3">
          <FareStrip fare={fareRule} />
        </div>

        {/* Error */}
        {bookError && (
          <p className="mt-2 text-center text-xs font-semibold" style={{ color: '#F87171' }}>
            {bookError}
          </p>
        )}

        {/* BOOK button */}
        <button
          type="button"
          onClick={handleBook}
          disabled={!selectedZoneId || !passengerId || booking}
          className="mt-4 w-full rounded-2xl py-4 text-[18px] font-black transition-all active:scale-[0.97]"
          style={{
            background: selectedZoneId && passengerId && !booking
              ? '#F59E0B'
              : 'rgba(245,158,11,0.25)',
            color: selectedZoneId && passengerId && !booking
              ? '#1A1A1E'
              : 'rgba(0,0,0,0.35)',
            boxShadow: selectedZoneId && passengerId && !booking
              ? '0 4px 28px rgba(245,158,11,0.32)'
              : 'none',
            cursor: selectedZoneId && passengerId && !booking ? 'pointer' : 'not-allowed',
          }}
        >
          {booking ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>বুক হৈছে…</span>
            </span>
          ) : (
            'ৰিক্সা বুক কৰক'
          )}
        </button>

      </div>
    </div>
  )
}
