'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Check, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'

import { createClient } from '@/lib/supabase/client'
import { acceptRide } from '@/lib/ride'
import type { Zone, SubZone, Puller } from '@/lib/types'

// ─── Dynamic Map (Puller View) ───────────────────────────────────────────────

const PullerIncomingMap = dynamic(
  () => import('../../(passenger)/_components/RideMap'),
  { ssr: false, loading: () => <div className="h-full bg-[#F4F4F5] animate-pulse" /> }
)

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTDOWN_SECS = 15

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncomingRide {
  id:            string
  zone_id:       string
  sub_zone_id:   string | null
  passenger_lat: number | null
  passenger_lng: number | null
  expires_at:    string | null
  created_at:    string
}

interface EnrichedRide extends IncomingRide {
  zone:     Zone | null
  subZone:  SubZone | null
  distKm:   number | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncomingRidesPage() {
  const router = useRouter()
  const sbRef = useRef(createClient())

  const [puller,      setPuller]      = useState<Puller | null>(null)
  const [zone,        setZone]        = useState<Zone | null>(null)
  const [overlay,     setOverlay]     = useState<EnrichedRide | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [accepting,   setAccepting]   = useState(false)
  const [timeLeft,    setTimeLeft]    = useState(COUNTDOWN_SECS)
  const [toast,       setToast]       = useState<string | null>(null)

  // Initialization
  useEffect(() => {
    const sb = sbRef.current
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: pullerRow } = await sb.from('pullers').select('*').eq('user_id', user.id).maybeSingle()
      if (!pullerRow || pullerRow.status !== 'active') { router.replace('/onboarding'); return }

      setPuller(pullerRow as Puller)
      if (pullerRow.zone_id) {
        const { data: zoneRow } = await sb.from('zones').select('*').eq('id', pullerRow.zone_id).maybeSingle()
        setZone(zoneRow as Zone | null)
        
        // Check for existing ride
        const { data: existing } = await sb.from('ride_requests').select('*').eq('zone_id', pullerRow.zone_id).eq('status', 'requested').gt('expires_at', new Date().toISOString()).limit(1)
        if (existing?.length) handleIncoming(existing[0] as IncomingRide, pullerRow as Puller)
      }
      setLoading(false)
    }
    init()
  }, [router])

  // Realtime
  useEffect(() => {
    if (!puller || !puller.zone_id) return
    const sb = sbRef.current
    const channel = sb
      .channel('incoming-rides')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_requests',
          filter: `zone_id=eq.${puller.zone_id}`
        },
        (payload) => {
          const ride = payload.new as IncomingRide & { status: string }
          if (ride.status === 'requested') {
            handleIncoming(ride, puller)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
          filter: `zone_id=eq.${puller.zone_id}`
        },
        (payload) => {
          const ride = payload.new as IncomingRide & { status: string }
          if (ride.status === 'cancelled' || ride.status === 'expired') {
            setOverlay(prev => prev?.id === ride.id ? null : prev)
          }
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [puller])

  const handleIncoming = async (raw: IncomingRide, p: Puller) => {
    if (raw.zone_id !== p.zone_id) return
    const sb = sbRef.current
    const [zRes, szRes] = await Promise.all([
      sb.from('zones').select('*').eq('id', raw.zone_id).maybeSingle(),
      raw.sub_zone_id ? sb.from('sub_zones').select('*').eq('id', raw.sub_zone_id).maybeSingle() : Promise.resolve({ data: null })
    ])
    setOverlay({ ...raw, zone: zRes.data as Zone, subZone: szRes.data as SubZone, distKm: 0.5 }) // Mock dist
    setTimeLeft(COUNTDOWN_SECS)
  }

  // Timer
  useEffect(() => {
    if (!overlay) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setOverlay(null); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [overlay])

  async function handleAccept() {
    if (!overlay || !puller || accepting) return
    setAccepting(true)
    const success = await acceptRide(sbRef.current, overlay.id, puller.id)
    if (!success) {
      setToast('Ride taken by another puller')
      setOverlay(null)
      setAccepting(false)
      setTimeout(() => setToast(null), 3000)
      return
    }
    localStorage.setItem('chaalak_current_ride', overlay.id)
    router.push(`/active?ride_id=${overlay.id}`)
  }

  if (loading) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  return (
    <main className="h-[100dvh] flex flex-col bg-white overflow-hidden select-none">
      <AnimatePresence>
        {overlay ? (
          <motion.div 
            key="overlay"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[100] bg-white flex flex-col"
          >
            {/* URGENCY BAR */}
            <div className="bg-[#0F172A] px-5 py-3 flex items-center justify-between text-white">
              <span className="text-[16px] font-bold font-display uppercase tracking-widest">NEW RIDE</span>
              <span className="text-[32px] font-black font-display text-[#1D4ED8] tabular-nums">
                {timeLeft}
              </span>
            </div>

            {/* MAP SECTION */}
            <div className="h-[160px] bg-[#F4F4F5] relative overflow-hidden">
              <PullerIncomingMap pullerPos={[puller?.lat || 26.1, puller?.lng || 91.7]} passengerPos={[overlay.passenger_lat || 26.1, overlay.passenger_lng || 91.7]} />
            </div>

            {/* CONTENT */}
            <div className="flex-1 p-5 flex flex-col gap-4">
              <div className="bg-[#EFF6FF] border border-[#1D4ED8] rounded-[16px] p-4 flex items-center gap-4">
                <div className="h-11 w-11 rounded-[12px] bg-[#1D4ED8] flex items-center justify-center text-white">
                  <MapPin size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-[24px] font-black text-[#1D4ED8] font-display uppercase leading-tight">
                    {overlay.zone?.name_as}
                  </h2>
                  <p className="text-[12px] font-medium text-[#64748B] font-body uppercase">
                    {overlay.subZone?.name_as || 'Near you'}
                  </p>
                </div>
                <div className="bg-white rounded-[12px] px-3 py-2 border border-[#E4E4E7] text-center">
                  <p className="text-[18px] font-black text-[#0F172A] font-display">0.5</p>
                  <p className="text-[10px] font-medium text-[#64748B] font-body uppercase">km</p>
                </div>
              </div>

              {/* TIMER PROGRESS */}
              <div className="w-full h-1 bg-[#E4E4E7] rounded-full mt-4">
                <motion.div 
                  className="h-full bg-[#1D4ED8]"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(timeLeft / COUNTDOWN_SECS) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full h-[60px] rounded-[14px] bg-[#1D4ED8] text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/30"
                >
                  <Check size={28} strokeWidth={3} />
                  <span className="text-[22px] font-black font-display uppercase">
                    {accepting ? '...' : 'ACCEPT'}
                  </span>
                </button>
                <button 
                  onClick={() => setOverlay(null)}
                  className="py-3 text-[12px] font-semibold text-[#94A3B8] font-body uppercase tracking-wider"
                >
                  Skip
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            {/* Waiting State */}
            <div className="relative mb-8">
              <div className="h-20 w-20 rounded-full bg-blue-500/10 animate-pulse-ring" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 rounded-full bg-[#1D4ED8] shadow-[0_0_12px_#1D4ED8]" />
              </div>
            </div>
            <h1 className="text-[20px] font-bold text-[#0F172A] font-display uppercase tracking-tight">
              Waiting for rides
            </h1>
            <p className="mt-2 text-[14px] font-medium text-[#64748B] font-body uppercase">
              Searching in {zone?.name_as}
            </p>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-10 left-5 right-5 bg-[#DC2626] text-white px-5 py-3 rounded-[12px] flex items-center gap-3 shadow-xl z-[200]"
          >
            <AlertCircle size={18} />
            <span className="text-[13px] font-semibold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
