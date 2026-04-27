'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, User, AlertCircle } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { startRide, endRide, markNoShow } from '@/lib/ride'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageData {
  rideId:     string
  acceptedAt: string | null
  phone:      string | null
  pullerId:   string
  totalRides: number
  status:     string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ActiveRidePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [data,       setData]       = useState<PageData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [elapsed,    setElapsed]    = useState(0)
  const [busy,       setBusy]       = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)

  const sbRef    = useRef(createClient())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialization
  useEffect(() => {
    const urlRideId = searchParams.get('ride_id')
    const savedRideId = localStorage.getItem('chaalak_current_ride')
    const finalRideId = urlRideId || savedRideId

    if (!finalRideId) { router.replace('/dashboard'); return }
    const sb = sbRef.current

    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: puller } = await sb.from('pullers').select('id, total_rides').eq('user_id', user.id).maybeSingle()
      if (!puller) { router.replace('/dashboard'); return }

      const { data: ride } = await sb.from('ride_requests').select('id, status, accepted_at, passenger_id').eq('id', finalRideId).maybeSingle()
      if (!ride) { router.replace('/dashboard'); return }

      const { data: pax } = await sb.from('passengers').select('user_id').eq('id', ride.passenger_id).maybeSingle()
      let phone: string | null = null
      if (pax?.user_id) {
        const { data: u } = await sb.from('users').select('phone').eq('id', pax.user_id).maybeSingle()
        phone = u?.phone || null
      }

      setData({
        rideId: ride.id,
        acceptedAt: ride.accepted_at,
        phone,
        pullerId: puller.id,
        totalRides: puller.total_rides,
        status: ride.status
      })

      const base = ride.accepted_at ? new Date(ride.accepted_at).getTime() : Date.now()
      const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000))
      tick()
      timerRef.current = setInterval(tick, 1000)
      setLoading(false)
    }
    load()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [searchParams, router])

  async function handleStart() {
    if (busy || !data) return
    setBusy(true)
    try {
      await startRide(sbRef.current, data.rideId, data.pullerId)
      setData({ ...data, status: 'active' })
    } catch {
      setToast('Failed to start')
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    if (busy || !data) return
    setBusy(true)
    try {
      await endRide(sbRef.current, data.rideId, data.pullerId)
      router.replace(`/complete?ride_id=${data.rideId}`)
    } catch {
      setToast('Failed to end')
      setBusy(false)
    }
  }

  async function handleNoShow() {
    if (busy || !data) return
    setBusy(true)
    try {
      await markNoShow(sbRef.current, data.rideId, data.pullerId)
      router.replace('/dashboard')
    } catch {
      setBusy(false)
    }
  }

  if (loading || !data) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  const isActive = data.status === 'active'

  return (
    <main className="min-h-screen bg-white">
      {/* Active Header */}
      <div className="bg-[#16A34A] px-5 pt-14 pb-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-[14px] font-bold font-body uppercase tracking-tight">
            {isActive ? 'Ride Active' : 'Go to Passenger'}
          </span>
        </div>
        <span className="text-[24px] font-black font-display tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      </div>

      <div className="p-5">
        {/* Passenger Card */}
        <div className="bg-white border border-[#E4E4E7] rounded-[16px] p-4 flex items-center gap-4 mb-4">
          <div className="h-11 w-11 rounded-[12px] bg-[#EFF6FF] flex items-center justify-center text-[#1D4ED8]">
            <User size={24} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[#0F172A] font-body">
              {data.phone || 'Passenger'}
            </p>
            <p className="text-[12px] font-medium text-[#64748B] font-body uppercase">
              Current Trip
            </p>
          </div>
          {data.phone && (
            <a 
              href={`tel:${data.phone}`}
              className="h-11 w-11 rounded-full bg-[#DCFCE7] border border-[#16A34A] flex items-center justify-center text-[#16A34A] active:scale-90 transition-transform"
            >
              <Phone size={18} />
            </a>
          )}
        </div>

        {/* Ride Number */}
        <div className="bg-[#EFF6FF] border border-[#1D4ED8] rounded-[12px] p-4 flex items-center justify-between mb-8">
          <span className="text-[12px] font-bold text-[#64748B] font-body uppercase">Ride Identity</span>
          <span className="text-[28px] font-black text-[#1D4ED8] font-display">#{data.totalRides + 1}</span>
        </div>

        {/* Buttons */}
        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={isActive ? handleEnd : handleStart}
            disabled={busy}
            className={`w-full h-14 rounded-[14px] flex items-center justify-center text-[20px] font-bold font-display uppercase transition-all active:scale-[0.98] ${
              isActive ? 'bg-[#0F172A] text-white' : 'bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {busy ? '...' : isActive ? 'END RIDE' : 'START RIDE'}
          </button>
          
          {!isActive && (
            <button
              onClick={handleNoShow}
              disabled={busy}
              className="w-full h-11 rounded-[12px] border-[1.5px] border-[#DC2626] text-[#DC2626] text-[13px] font-bold font-body uppercase active:bg-red-50 transition-colors"
            >
              Passenger No-Show
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-10 left-5 right-5 bg-[#DC2626] text-white px-5 py-3 rounded-[12px] flex items-center gap-3 shadow-xl z-50"
          >
            <AlertCircle size={18} />
            <span className="text-[13px] font-semibold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <ActiveRidePage />
    </Suspense>
  )
}
