'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { Zone, FareRule } from '@/lib/types'
import type { OnlinePuller, PassengerMapProps } from './_components/PassengerMap'
import LogoutButton from '@/components/LogoutButton'
import { Star, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { SkeletonBox } from '@/components/Skeleton'
import { Suspense } from 'react'




// ─── Types ────────────────────────────────────────────────────────────────────

interface PassengerProfile {
  name: string
  created_at: string
  total_rides: number
  thumbs_given: number
}

interface RecentRide {
  id: string
  completed_at: string
  status: string
  thumbs_up: boolean
  zone: {
    name: string
    name_as: string
    zone_number: number
  }
}



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

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#F2F0EB] rounded-xl p-2.5 flex flex-col items-center">
      <span className="text-lg font-black text-amber-600 font-nunito leading-tight">{value}</span>
      <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mt-0.5">{label}</span>
    </div>
  )
}


// ─── Main page ────────────────────────────────────────────────────────────────

function SkeletonPassenger() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ backgroundColor: '#1A1A1E' }}>
      <div className="bg-[#1F2937] px-5 pt-12 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <SkeletonBox h="14px" w="60px" />
            <div className="mt-2" />
            <SkeletonBox h="28px" w="150px" />
          </div>
          <SkeletonBox h="32px" w="80px" rounded="20px" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <SkeletonBox h="50px" rounded="12px" />
          <SkeletonBox h="50px" rounded="12px" />
          <SkeletonBox h="50px" rounded="12px" />
        </div>
      </div>
      <div className="shrink-0" style={{ height: '35dvh' }}>
        <SkeletonBox h="100%" rounded="0px" />
      </div>
      <div className="flex-1 px-4 pt-6">
        <SkeletonBox h="14px" w="100px" />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <SkeletonBox h="80px" rounded="16px" />
          <SkeletonBox h="80px" rounded="16px" />
          <SkeletonBox h="80px" rounded="16px" />
          <SkeletonBox h="80px" rounded="16px" />
        </div>
        <div className="mt-4" />
        <SkeletonBox h="44px" rounded="12px" />
      </div>
    </div>
  )
}

function PassengerHomePage() {
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
  const [profile, setProfile]               = useState<PassengerProfile | null>(null)
  const [recentRides, setRecentRides]       = useState<RecentRide[]>([])
  const [cooldownUntil, setCooldownUntil]   = useState<string | null>(null)
  const [weeklyCancellations, setWeeklyCancellations] = useState(0)

  const tr = useT()



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

      // ── Caching Logic for Zones ──────────────────────────────────────────
      const cachedZones = localStorage.getItem('chaalak_zones')
      const cachedZonesAt = localStorage.getItem('chaalak_zones_cached_at')
      const zonesAge = Date.now() - parseInt(cachedZonesAt || '0')
      
      let initialZones = FALLBACK_ZONES
      if (cachedZones && zonesAge < 3600000) {
        initialZones = JSON.parse(cachedZones)
        setZones(initialZones)
      }

      // ── Parallel Data Fetch ──────────────────────────────────────────────
      const [zonesRes, passengerRes, userRes] = await Promise.all([
        supabase.from('zones').select('*').eq('is_active', true).order('zone_number'),
        supabase.from('passengers').select('id, total_rides, thumbs_given').eq('user_id', user.id).maybeSingle(),
        supabase.from('users').select('name, created_at').eq('id', user.id).single(),
      ])

      // 1. Zones
      if (zonesRes.data?.length) {
        setZones(zonesRes.data as Zone[])
        localStorage.setItem('chaalak_zones', JSON.stringify(zonesRes.data))
        localStorage.setItem('chaalak_zones_cached_at', Date.now().toString())
      }

      // 2. Passenger Record
      let pId = passengerRes.data?.id
      if (!pId) {
        const { data: newP } = await supabase.from('passengers').insert({ user_id: user.id }).select('id').single()
        pId = newP?.id
      }
      if (pId) setPassengerId(pId)

      // 3. Profile
      if (userRes.data && passengerRes.data) {
        setProfile({
          name: userRes.data.name,
          created_at: userRes.data.created_at,
          total_rides: passengerRes.data.total_rides,
          thumbs_given: passengerRes.data.thumbs_given
        })
      }

      // 4. Ride History & Active Check (Sequential only if pId was just created)
      if (pId) {
        const [activeRes, historyRes] = await Promise.all([
          supabase.from('ride_requests').select('id').eq('passenger_id', pId).in('status', ['requested', 'accepted', 'active']).maybeSingle(),
          supabase.from('ride_requests').select('id, completed_at, status, thumbs_up, zones (name, name_as, zone_number)').eq('passenger_id', pId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(3)
        ])

        if (activeRes.data) { router.replace('/ride'); return }
        if (historyRes.data) {
          setRecentRides(historyRes.data.map(r => ({ ...r, zone: r.zones as unknown as RecentRide['zone'] })))
        }

        // 5. Cooldown & Stats check
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const [paxRes, cancelRes] = await Promise.all([
          supabase.from('passengers').select('cooldown_until').eq('id', pId).single(),
          supabase.from('ride_requests').select('id', { count: 'exact', head: true }).eq('passenger_id', pId).in('status', ['cancelled', 'no_show']).gte('created_at', weekAgo)
        ])

        if (paxRes.data?.cooldown_until) setCooldownUntil(paxRes.data.cooldown_until)
        if (cancelRes.count !== null) setWeeklyCancellations(cancelRes.count)
      }

      fetchOnlinePullers()
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
    
    // Caching for Fares
    const cacheKey = `chaalak_fare_${selectedZoneId}`
    const cachedFare = localStorage.getItem(cacheKey)
    if (cachedFare) {
      setFareRule(JSON.parse(cachedFare))
      return
    }

    sbRef.current
      .from('fare_rules')
      .select('*')
      .eq('from_zone_id', selectedZoneId)
      .eq('to_zone_id', selectedZoneId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFareRule(data as FareRule)
          localStorage.setItem(cacheKey, JSON.stringify(data))
        }
      })
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
      registerPushSubscription(passengerId).catch(() => { /* non-critical */ })
    })


    router.push('/ride')
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <SkeletonPassenger />
  }

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      {/* ── Passenger Header ─────────────────────────────────────────────────── */}
      <div className="bg-[#1F2937] px-5 pt-12 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">{tr.hello}</p>
            <h1 className="text-2xl font-black text-white font-nunito">{profile?.name || '...'}</h1>
          </div>

          <LogoutButton />
        </div>

        {/* Stats Row */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <StatBox label="Total Rides" value={profile?.total_rides || 0} />
          <StatBox label="Thumbs Given" value={profile?.thumbs_given || 0} />
          <StatBox 
            label="Member Since" 
            value={profile ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '...'} 
          />
        </div>

        {weeklyCancellations > 0 && (
          <p className="mt-4 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
            This week: {weeklyCancellations} cancellations
          </p>
        )}
      </div>


      {/* ── TOP HALF: Map ─────────────────────────────────────────────────── */}
      <div className="relative shrink-0" style={{ height: '35dvh', minHeight: 180 }}>
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
          {tr.select_zone}
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

        {/* Recent Rides Section */}
        <div className="mt-6 mb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
              {tr.recent_rides}
            </p>
            <Clock size={14} className="text-white/20" />
          </div>

          
          <div className="flex flex-col gap-2">
            {recentRides.length > 0 ? (
              recentRides.map((ride) => (
                <div 
                  key={ride.id} 
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="rounded-lg px-2 py-0.5 text-[9px] font-black uppercase"
                      style={{ 
                        background: `${ZONE_COLORS[ride.zone.zone_number]?.hex}20`,
                        color: ZONE_COLORS[ride.zone.zone_number]?.hex 
                      }}
                    >
                      {ride.zone.name_as}
                    </div>
                    <span className="text-[11px] font-bold text-gray-500">
                      {new Date(ride.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {ride.thumbs_up && <Star size={12} className="text-amber-500 fill-amber-500" />}
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-[11px] font-bold text-white/20">{tr.no_rides}</p>
            )}

          </div>
        </div>


        {/* Cooldown / Book Button */}
        <div className="mt-auto pt-6">
          {cooldownUntil && new Date(cooldownUntil) > new Date() ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest leading-relaxed">
                  Too many recent cancellations. ⚠️ <br />
                  Please wait for the cooldown to expire.
                </p>
              </div>
              <button
                disabled
                className="w-full rounded-2xl py-5 text-lg font-black bg-white/5 text-white/20 border border-white/5"
              >
                Wait {Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 60000)}m before booking
              </button>
            </div>
          ) : (
            <button
              onClick={handleBook}
              disabled={!selectedZoneId || booking}
              className="w-full rounded-2xl bg-[#F59E0B] py-5 text-lg font-black text-[#1A1A1E] transition-all active:scale-[0.98] disabled:opacity-40 shadow-[0_4px_28px_rgba(245,158,11,0.32)]"
            >
              {booking ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>{tr.searching}</span>
                </span>
              ) : (
                tr.book_ride
              )}
            </button>
          )}

          {bookError && (
            <p className="mt-3 text-center text-xs font-bold text-red-500">{bookError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
export default function PassengerHomeSuspense() {
  return (
    <Suspense fallback={<SkeletonPassenger />}>
      <PassengerHomePage />
    </Suspense>
  )
}
