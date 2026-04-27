'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LogOut } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { Zone } from '@/lib/types'
import type { OnlinePuller, PassengerMapProps } from './_components/PassengerMap'

// ─── Dynamic Map ─────────────────────────────────────────────────────────────

const PassengerMap = dynamic<PassengerMapProps>(
  () => import('./_components/PassengerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#F4F4F5]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
      </div>
    ),
  }
)

// ─── Constants ───────────────────────────────────────────────────────────────

const FALLBACK_ZONES: Zone[] = [
  { id: '__1', name: 'Pan Bazar',  name_as: 'পান বজাৰ',  name_hi: 'পান বাज़ार', color_hex: '#1D4ED8', color_label: 'blue',   zone_number: 1, is_active: true },
  { id: '__2', name: 'Chandmari', name_as: 'চান্দমাৰী', name_hi: 'चांदमारी',   color_hex: '#16A34A', color_label: 'green',  zone_number: 2, is_active: true },
  { id: '__3', name: 'Dispur',    name_as: 'দিছপুৰ',    name_hi: 'दिसपुर',     color_hex: '#7C3AED', color_label: 'purple', zone_number: 3, is_active: true },
  { id: '__4', name: 'Beltola',   name_as: 'বেলটোলা',   name_hi: 'বেলতোला',    color_hex: '#DC2626', color_label: 'red',    zone_number: 4, is_active: true },
]

// ─── Components ──────────────────────────────────────────────────────────────

function Header({ profile }: { profile: { name?: string; total_rides?: number; thumbs_given?: number } | null }) {
  const router = useRouter()
  const sb = createClient()
  
  const handleLogout = async () => {
    await sb.auth.signOut()
    router.replace('/auth')
  }

  return (
    <div className="bg-white px-5 pt-12 pb-4 border-b border-[#E4E4E7]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-[#64748B] font-body">Hello</p>
          <h1 className="text-[22px] font-bold text-[#0F172A] font-display uppercase tracking-tight">
            {profile?.name || '...'}
          </h1>
        </div>
        <button 
          onClick={handleLogout}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#64748B] active:scale-90 transition-transform"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <StatPill label="Rides" value={profile?.total_rides || 0} />
        <StatPill label="Thumbs" value={profile?.thumbs_given || 0} />
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#EFF6FF] rounded-full px-3 py-1 flex items-center gap-1.5 border border-blue-100">
      <span className="text-[14px] font-bold text-[#1D4ED8] font-display">{value}</span>
      <span className="text-[10px] font-medium text-[#64748B] font-body uppercase">{label}</span>
    </div>
  )
}

function ZoneCard({ zone, selected, onSelect }: { zone: Zone; selected: boolean; onSelect: () => void }) {
  const c = ZONE_COLORS[zone.zone_number] ?? { hex: '#1D4ED8' }
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-[12px] p-3 border-[1.5px] bg-white transition-all active:scale-[0.98] ${
        selected ? 'bg-[#EFF6FF]' : 'border-[#E4E4E7]'
      }`}
      style={{ borderColor: selected ? c.hex : undefined }}
    >
      <div 
        className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-[16px] font-black text-white"
        style={{ background: c.hex }}
      >
        {zone.zone_number}
      </div>
      <div className="flex-1 text-left">
        <p className="text-[16px] font-bold text-[#0F172A] font-display uppercase leading-tight">{zone.name_as}</p>
        <p className="text-[11px] font-medium text-[#64748B] font-body">{zone.name}</p>
      </div>
      {selected && <div className="h-2 w-2 rounded-full" style={{ background: c.hex }} />}
    </button>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function PassengerHomePage() {
  const router = useRouter()
  const sbRef = useRef(createClient())

  const [passengerPos, setPassengerPos]     = useState<[number, number] | null>(null)
  const [onlinePullers, setOnlinePullers]   = useState<OnlinePuller[]>([])
  const [zones, setZones]                   = useState<Zone[]>(FALLBACK_ZONES)
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')
  const [passengerId, setPassengerId]       = useState<string>('')
  const [loading, setLoading]               = useState(true)
  const [booking, setBooking]               = useState(false)
  const [profile, setProfile]               = useState<{ name?: string; total_rides?: number; thumbs_given?: number } | null>(null)
  const [showMap, setShowMap]               = useState(false)

  // Initialization
  useEffect(() => {
    const t = setTimeout(() => setShowMap(true), 800)
    
    async function init() {
      const { data: { user } } = await sbRef.current.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      // LocalStorage check for active ride
      const savedRide = localStorage.getItem('chaalak_active_ride')
      if (savedRide) {
        router.replace('/ride')
        return
      }

      const [zonesRes, passengerRes, userRes] = await Promise.all([
        sbRef.current.from('zones').select('*').eq('is_active', true).order('zone_number'),
        sbRef.current.from('passengers').select('id, total_rides, thumbs_given').eq('user_id', user.id).maybeSingle(),
        sbRef.current.from('users').select('name, created_at').eq('id', user.id).single(),
      ])

      if (zonesRes.data) setZones(zonesRes.data as Zone[])
      
      let finalPassengerId = ''
      if (!passengerRes.data) {
        const { data: newPassenger } = await sbRef.current
          .from('passengers')
          .insert({ user_id: user.id, total_rides: 0, thumbs_given: 0, no_show_count: 0 })
          .select('id, total_rides, thumbs_given')
          .single()
        if (newPassenger) {
          finalPassengerId = newPassenger.id
          setPassengerId(newPassenger.id)
          if (userRes.data) setProfile({ ...userRes.data, ...newPassenger })
        }
      } else {
        finalPassengerId = passengerRes.data.id
        setPassengerId(passengerRes.data.id)
        if (userRes.data) setProfile({ ...userRes.data, ...passengerRes.data })
      }

      // Check for active ride
      if (finalPassengerId) {
        const { data: active } = await sbRef.current
          .from('ride_requests')
          .select('id, status')
          .eq('passenger_id', finalPassengerId)
          .in('status', ['requested', 'accepted', 'active'])
          .maybeSingle()
        if (active) {
          if (active.status === 'requested') router.replace('/book')
          else router.replace('/ride')
        }
      }

      setLoading(false)
    }
    init()
    return () => clearTimeout(t)
  }, [router])

  const fetchOnlinePullers = async () => {
    const { data: pullers } = await sbRef.current
      .from('pullers')
      .select('id, badge_code, badge_number, lat, lng, zone_id, zones(zone_number, color_hex)')
      .eq('is_online', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
    
    if (pullers) setOnlinePullers(pullers as OnlinePuller[])
  }

  // Realtime & Polling
  useEffect(() => {
    fetchOnlinePullers()
    
    const channel = sbRef.current
      .channel('online-pullers')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pullers',
        filter: 'is_online=eq.true'
      }, () => {
        fetchOnlinePullers()
      })
      .subscribe()

    const interval = setInterval(fetchOnlinePullers, 15000)

    return () => {
      sbRef.current.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  // Geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (pos) => setPassengerPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Booking
  async function handleBook() {
    if (!selectedZoneId || !passengerId || booking) return
    setBooking(true)
    const { data: rideData, error } = await sbRef.current.from('ride_requests').insert({
      passenger_id: passengerId,
      zone_id: selectedZoneId,
      status: 'requested',
      passenger_lat: passengerPos?.[0] ?? null,
      passenger_lng: passengerPos?.[1] ?? null,
      expires_at: new Date(Date.now() + 180_000).toISOString(),
    }).select('id').single()

    if (error || !rideData) { setBooking(false); return }
    
    localStorage.setItem('chaalak_active_ride', rideData.id)
    localStorage.setItem('chaalak_active_zone', selectedZoneId)
    router.push('/book')
  }

  if (loading) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  const selectedZone = zones.find(z => z.id === selectedZoneId)

  return (
    <main className="flex h-[100dvh] flex-col bg-[#FAFAFA] overflow-hidden">
      {/* Top Header */}
      <Header profile={profile} />

      {/* Map Section */}
      <div className="flex-1 relative">
        {showMap ? (
          <PassengerMap passengerPos={passengerPos} pullers={onlinePullers} />
        ) : (
          <div className="h-full bg-[#F4F4F5] animate-pulse" />
        )}

        {/* Zone Label Overlay */}
        {selectedZone && (
          <div className="absolute top-3 left-3 z-[1000] bg-white rounded-lg px-3 py-1.5 shadow-sm border border-[#E4E4E7] animate-fade-in">
            <span className="text-[13px] font-bold text-[#0F172A] font-display uppercase">
              {selectedZone.name_as}
            </span>
          </div>
        )}

        {/* Online Count */}
        <div className="absolute top-3 right-3 z-[1000] bg-[#DCFCE7] border border-[#16A34A] rounded-full px-3 py-1 animate-fade-in">
          <span className="text-[12px] font-semibold text-[#16A34A] font-body">
            {onlinePullers.length} online
          </span>
        </div>
      </div>

      {/* Bottom Sheet Surface */}
      <div className="bg-white border-t border-[#E4E4E7] px-5 pt-2 pb-8 shadow-[0_-8px_40px_rgba(0,0,0,0.04)]">
        {/* Drag Handle */}
        <div className="w-8 h-1 bg-[#E4E4E7] rounded-full mx-auto mb-6" />

        <p className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-[0.05em] mb-3">
          Select Zone
        </p>

        {/* Zone Grid */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {zones.map(z => (
            <ZoneCard 
              key={z.id} 
              zone={z} 
              selected={selectedZoneId === z.id} 
              onSelect={() => setSelectedZoneId(z.id)} 
            />
          ))}
        </div>

        {/* Book Button */}
        <button
          onClick={handleBook}
          disabled={!selectedZoneId || booking}
          className={`w-full h-14 rounded-[12px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
            selectedZoneId ? 'bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/20' : 'bg-[#E4E4E7] text-[#94A3B8]'
          }`}
        >
          <RickshawIcon className="h-6 w-6" />
          <span className="text-[20px] font-bold font-display uppercase tracking-tight">
            {booking ? '...' : 'Book Ride'}
          </span>
        </button>
      </div>
    </main>
  )
}

function RickshawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <path d="M15 17.5h-6" />
      <path d="M5.5 14V7a2 2 0 0 1 2-2H12" />
      <path d="M18.5 14v-4a2 2 0 0 0-2-2h-3" />
      <path d="M12 5v12.5" />
    </svg>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#FAFAFA]" />}>
      <PassengerHomePage />
    </Suspense>
  )
}
