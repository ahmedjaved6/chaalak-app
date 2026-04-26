'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import { acceptRide } from '@/lib/ride'
import type { Zone, SubZone, Puller } from '@/lib/types'
import { useT } from '@/lib/i18n'





// ─── Haversine distance (km) ──────────────────────────────────────────────────

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

type ToastType = 'error' | 'success' | 'info'

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  msg, type, onDismiss,
}: {
  msg: string; type: ToastType; onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const palette: Record<ToastType, { bg: string; border: string }> = {
    error:   { bg: '#7F1D1D', border: '#EF4444' },
    success: { bg: '#064E3B', border: '#10B981' },
    info:    { bg: '#1C2A3A', border: '#3B82F6' },
  }
  const c = palette[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      className="fixed bottom-10 left-1/2 z-[200] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
      style={{
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        maxWidth: 320,
        width: 'max-content',
      }}
    >
      {msg}
    </motion.div>
  )
}

// ─── Animated countdown ring ──────────────────────────────────────────────────

function CountdownRing({ secs, total }: { secs: number; total: number }) {
  const R          = 36
  const circumference = 2 * Math.PI * R
  const progress   = secs / total
  const dash       = circumference * progress

  return (
    <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      {/* Track */}
      <svg width={96} height={96} className="absolute inset-0 -rotate-90">
        <circle
          cx={48} cy={48} r={R}
          fill="none"
          stroke="rgba(245,158,11,0.18)"
          strokeWidth={6}
        />
        <circle
          cx={48} cy={48} r={R}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>
      {/* Number */}
      <span className="relative text-[32px] font-black tabular-nums text-amber-400">
        {secs}
      </span>
    </div>
  )
}

// ─── Incoming Ride Overlay ────────────────────────────────────────────────────

function RideOverlay({
  ride,
  onAccept,
  onSkip,
}: {
  ride:     EnrichedRide
  onAccept: (rideId: string) => Promise<void>
  onSkip:   () => void
}) {
  const [secs,      setSecs]      = useState(COUNTDOWN_SECS)
  const [accepting, setAccepting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          onSkip()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [onSkip])

  const tr = useT()


  async function handleAccept() {
    if (accepting) return
    clearInterval(timerRef.current!)
    setAccepting(true)
    await onAccept(ride.id)
    // parent will unmount overlay on success; on failure it resets
    setAccepting(false)
  }

  const zoneNum   = ride.zone?.zone_number ?? 1
  const zoneColor = ZONE_COLORS[zoneNum] ?? ZONE_COLORS[1]

  return (
    <motion.div
      key="overlay"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 py-12"
      style={{ background: '#0F1117' }}
    >
      {/* ── Top: zone + sub-zone ───────────────────────────────────────────── */}
      <div className="flex w-full max-w-[360px] flex-col items-center gap-2 text-center">
        {/* "New Ride" label */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{
            background: `${zoneColor.hex}1A`,
            border: `1.5px solid ${zoneColor.hex}50`,
            color: zoneColor.hex,
          }}
        >
          নতুন যাত্ৰা · New Ride
        </motion.div>


        {/* Zone name — large, zone-colored */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-2 font-black leading-tight"
          style={{
            fontSize: 'clamp(2.4rem, 10vw, 3.4rem)',
            color: zoneColor.hex,
            textShadow: `0 0 40px ${zoneColor.hex}55`,
            letterSpacing: '-0.02em',
          }}
        >
          {ride.zone?.name_as ?? 'Zone'}
        </motion.h1>

        {/* English zone name */}
        <p
          className="text-base font-bold"
          style={{ color: 'rgba(255,255,255,0.38)' }}
        >
          {ride.zone?.name ?? ''}
        </p>

        {/* Sub-zone chip */}
        {ride.subZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="mt-1 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <MapPin size={12} />
            {ride.subZone.name_as}
          </motion.div>
        )}

        {/* Distance chip */}
        {ride.distKm != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="mt-1 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            <Navigation size={12} />
            {ride.distKm < 0.1
              ? '< 100 m'
              : `${ride.distKm.toFixed(1)} km away`}
          </motion.div>
        )}
      </div>

      {/* ── Middle: countdown ring ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <CountdownRing secs={secs} total={COUNTDOWN_SECS} />
        <p
          className="text-xs font-semibold"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Auto-skip in {secs}s
        </p>
      </div>

      {/* ── Bottom: countdown bar + buttons ───────────────────────────────── */}
      <div className="flex w-full max-w-[360px] flex-col gap-3">

        {/* Progress bar */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(245,158,11,0.15)' }}
        >
          <motion.div
            className="h-full rounded-full bg-amber-400"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: COUNTDOWN_SECS, ease: 'linear' }}
          />
        </div>

        {/* ACCEPT button */}
        <motion.button
          type="button"
          onClick={handleAccept}
          disabled={accepting}
          whileTap={{ scale: 0.97 }}
          className="w-full rounded-2xl py-5 text-[20px] font-black tracking-wide text-white disabled:opacity-60"
          style={{
            background: accepting
              ? 'rgba(16,185,129,0.5)'
              : 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            boxShadow: accepting ? 'none' : '0 6px 36px rgba(16,185,129,0.45)',
          }}
        >
          {accepting ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>গ্ৰহণ কৰা হৈছে…</span>
            </span>
          ) : (
            '✓ ' + tr.puller_found.split('!')[0] || '✓ ACCEPT'
          )}
        </motion.button>


        <button
          type="button"
          onClick={() => { clearInterval(timerRef.current!); onSkip() }}
          className="py-2 text-sm font-semibold transition-colors"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          {tr.cancel}
        </button>


      </div>
    </motion.div>
  )
}

// ─── Idle background state ────────────────────────────────────────────────────

function WaitingState({ zone, tr }: { zone: Zone | null, tr: ReturnType<typeof useT> }) {


  const zoneNum   = zone?.zone_number ?? 1
  const zoneColor = ZONE_COLORS[zoneNum] ?? ZONE_COLORS[1]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      {/* Pulsing amber dot */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `${zoneColor.hex}22` }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0.2, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-3 rounded-full"
          style={{ background: `${zoneColor.hex}44` }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.9, 0.4, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />
        <div
          className="relative h-5 w-5 rounded-full"
          style={{ background: zoneColor.hex, boxShadow: `0 0 18px ${zoneColor.hex}` }}
        />
      </div>

      <div className="text-center">
        <p
          className="text-[17px] font-black text-white"
          style={{ letterSpacing: '-0.01em' }}
        >
          {tr.searching}
        </p>

        <p
          className="mt-1.5 text-sm font-semibold"
          style={{ color: 'rgba(255,255,255,0.38)' }}
        >
          Waiting for rides
          {zone && (
            <> · <span style={{ color: zoneColor.hex }}>{zone.name_as}</span></>
          )}
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IncomingRidesPage() {
  const router = useRouter()

  // Core state
  const [puller,      setPuller]      = useState<Puller | null>(null)
  const [zone,        setZone]        = useState<Zone | null>(null)
  const [overlay,     setOverlay]     = useState<EnrichedRide | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const [toast,       setToast]       = useState<{ msg: string; type: ToastType } | null>(null)

  const tr = useT()


  const sbRef        = useRef(createClient())
  // Keep puller in a ref so realtime closures always see the latest value
  const pullerRef    = useRef<Puller | null>(null)

  const showToast    = useCallback((msg: string, type: ToastType = 'info') => setToast({ msg, type }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // ── Enrich a raw ride_request row ─────────────────────────────────────────

  const enrichRide = useCallback(async (raw: IncomingRide): Promise<EnrichedRide> => {
    const sb = sbRef.current
    const p  = pullerRef.current

    const [zoneRes, subRes] = await Promise.all([
      raw.zone_id
        ? sb.from('zones').select('*').eq('id', raw.zone_id).maybeSingle()
        : Promise.resolve({ data: null }),
      raw.sub_zone_id
        ? sb.from('sub_zones').select('*').eq('id', raw.sub_zone_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const rideZone = zoneRes.data as Zone | null
    const subZone  = subRes.data as SubZone | null

    let distKm: number | null = null
    if (
      p?.lat != null && p?.lng != null &&
      raw.passenger_lat != null && raw.passenger_lng != null
    ) {
      distKm = haversineKm(p.lat, p.lng, raw.passenger_lat, raw.passenger_lng)
    }

    return { ...raw, zone: rideZone, subZone, distKm }
  }, [])

  // ── Handle incoming realtime event ────────────────────────────────────────

  const handleIncoming = useCallback(async (raw: IncomingRide) => {
    const p = pullerRef.current
    if (!p) return

    // Only show rides in puller's own zone
    if (raw.zone_id !== p.zone_id) return

    // Don't overlay if already showing one
    setOverlay((prev) => {
      if (prev) return prev   // already showing — drop the new one (it'll be re-broadcast)
      return null
    })

    const enriched = await enrichRide(raw)
    setOverlay(enriched)
  }, [enrichRide])

  // ── Auth + initial load ───────────────────────────────────────────────────

  useEffect(() => {
    const supabase = sbRef.current

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: pullerRow } = await supabase
        .from('pullers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!pullerRow) { router.replace('/onboarding'); return }
      if (pullerRow.status !== 'active') { router.replace('/onboarding'); return }

      pullerRef.current = pullerRow as Puller
      setPuller(pullerRow as Puller)

      // Load zone info
      if (pullerRow.zone_id) {
        const { data: zoneRow } = await supabase
          .from('zones')
          .select('*')
          .eq('id', pullerRow.zone_id)
          .maybeSingle()
        setZone(zoneRow as Zone | null)
      }

      setLoadingPage(false)

      // ── Check for existing rides in zone ──────────────────────────────────
      if (pullerRow.zone_id) {
        const { data: existingRides } = await supabase
          .from('ride_requests')
          .select('*')
          .eq('zone_id', pullerRow.zone_id)
          .eq('status', 'requested')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (existingRides?.length) {
          handleIncoming(existingRides[0] as IncomingRide)
        }
      }
    }

    load()
  }, [router])

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!puller) return
    const supabase = sbRef.current

    const channel = supabase
      .channel('incoming-rides-puller')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'ride_requests',
          filter: `status=eq.requested`,
        },
        (payload) => {
          const raw = payload.new as IncomingRide
          handleIncoming(raw)
        }
      )
      // Also catch status flips to 'requested' (e.g., re-queued rides)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'ride_requests',
          filter: `status=eq.requested`,
        },
        (payload) => {
          const raw = payload.new as IncomingRide
          if (!payload.old || payload.old.status !== 'requested') {
            handleIncoming(raw)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [puller, handleIncoming])

  // ── Accept handler ────────────────────────────────────────────────────────

  const handleAccept = useCallback(async (rideId: string) => {
    const p = pullerRef.current
    if (!p) return

    const result = await acceptRide(sbRef.current, rideId, p.id)

    if (!result) {
      showToast('Ride taken by another puller', 'error')
      setOverlay(null)
      return
    }

    // Fire push notification to passenger (best-effort — don't await)
    ;(async () => {
      try {
        // Get passenger user_id via ride → passengers → user_id
        const { data: rideRow } = await sbRef.current
          .from('ride_requests')
          .select('passenger_id')
          .eq('id', rideId)
          .maybeSingle()

        if (rideRow?.passenger_id) {
          const { data: passengerRow } = await sbRef.current
            .from('passengers')
            .select('user_id')
            .eq('id', rideRow.passenger_id)
            .maybeSingle()

          if (passengerRow?.user_id) {
            await fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: passengerRow.user_id,
                title:   'চালক আহি আছে',
                body:    'আপোনাৰ ৰিক্সা গ্ৰহণ কৰা হৈছে',
                url:     '/ride',
              }),
            })
          }
        }
      } catch {
        // silent — push is non-critical
      }
    })()

    setOverlay(null)
    router.push(`/active?ride_id=${rideId}`)
  }, [showToast, router])

  // ── Skip / dismiss overlay ────────────────────────────────────────────────

  const handleSkip = useCallback(() => setOverlay(null), [])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadingPage) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: '#1A1A1E' }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  const zoneNum   = zone?.zone_number ?? 1
  const zoneColor = ZONE_COLORS[zoneNum] ?? ZONE_COLORS[1]

  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-5 pt-14 pb-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="mx-auto flex max-w-[420px] items-center justify-between">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Incoming Rides
            </p>

            <h1
              className="mt-0.5 text-xl font-black text-white"
              style={{ letterSpacing: '-0.01em' }}
            >
              {tr.recent_rides.split(' · ')[0]}
            </h1>

          </div>

          {/* Zone chip */}
          {zone && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{
                background: `${zoneColor.hex}18`,
                border: `1.5px solid ${zoneColor.hex}45`,
                color: zoneColor.hex,
              }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: zoneColor.hex }}
              />
              {zone.name_as}
            </div>
          )}
        </div>
      </div>

      {/* ── Waiting state ──────────────────────────────────────────────────── */}
      <WaitingState zone={zone} tr={tr} />


      {/* ── Incoming ride overlay ──────────────────────────────────────────── */}
      <AnimatePresence>
        {overlay && (
          <RideOverlay
            key={overlay.id}
            ride={overlay}
            onAccept={handleAccept}
            onSkip={handleSkip}
          />

        )}
      </AnimatePresence>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            msg={toast.msg}
            type={toast.type}
            onDismiss={dismissToast}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
