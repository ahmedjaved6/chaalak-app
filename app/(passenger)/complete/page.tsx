'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'

// ─── Passenger view ───────────────────────────────────────────────────────────

function PassengerComplete({
  rideId,
  pullerId,
}: {
  rideId: string
  pullerId: string | null
}) {
  const router = useRouter()
  const sbRef  = useRef(createClient())

  const [thumbed,     setThumbed]     = useState(false)
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [tapping,     setTapping]     = useState(false)

  useEffect(() => {
    if (!rideId) return
    sbRef.current
      .from('ride_requests')
      .select('thumbs_up')
      .eq('id', rideId)
      .maybeSingle()
      .then(({ data }) => { if (data?.thumbs_up) setAlreadyRated(true) })
  }, [rideId])

  async function handleThumbsUp() {
    if (!pullerId || tapping || thumbed || alreadyRated) return
    setTapping(true)

    // Mark on ride
    await sbRef.current
      .from('ride_requests')
      .update({ thumbs_up: true })
      .eq('id', rideId)

    // Increment puller thumbs_up (fetch + update)
    const { data: p } = await sbRef.current
      .from('pullers')
      .select('thumbs_up')
      .eq('id', pullerId)
      .maybeSingle()
    if (p != null) {
      await sbRef.current
        .from('pullers')
        .update({ thumbs_up: (p.thumbs_up ?? 0) + 1 })
        .eq('id', pullerId)
    }

    setThumbed(true)
    setTapping(false)
  }

  const rated = thumbed || alreadyRated

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-5 text-[72px] leading-none">🎉</div>
        <h1
          className="text-[30px] font-black text-white"
          style={{ letterSpacing: '-0.02em' }}
        >
          যাত্ৰা সম্পূৰ্ণ হ&apos;ল
        </h1>
        <p className="mt-2 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Your ride has been completed
        </p>
      </motion.div>

      {/* Thumbs up */}
      <motion.button
        type="button"
        onClick={handleThumbsUp}
        disabled={tapping || rated}
        className="mt-12 flex flex-col items-center gap-3"
        whileTap={!rated ? { scale: 0.9 } : {}}
      >
        <motion.div
          animate={rated ? { scale: [1, 1.2, 1], rotate: [0, -12, 12, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="flex h-24 w-24 items-center justify-center rounded-full text-[52px]"
          style={{
            background: rated ? '#F59E0B' : 'rgba(245,158,11,0.10)',
            border: `3px solid ${rated ? '#F59E0B' : 'rgba(245,158,11,0.25)'}`,
            boxShadow: rated ? '0 8px 36px rgba(245,158,11,0.45)' : 'none',
          }}
        >
          👍
        </motion.div>
        <p
          className="text-sm font-bold"
          style={{ color: rated ? '#F59E0B' : 'rgba(255,255,255,0.4)' }}
        >
          {rated ? 'ধন্যবাদ!' : 'ৰিক্সাৱালাক পছন্দ হ\'ল?'}
        </p>
      </motion.button>

      {/* Home */}
      <button
        type="button"
        onClick={() => router.replace('/')}
        className="mt-10 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1.5px solid rgba(255,255,255,0.10)',
        }}
      >
        <Home size={16} />
        ঘৰলৈ যাওক
      </button>
    </div>
  )
}

// ─── Puller view ──────────────────────────────────────────────────────────────

interface RideSummary {
  zoneName:    string
  zoneNumber:  number
  durationMin: number | null
  badgeCode:   string
  totalRides:  number
}

function PullerComplete({ rideId }: { rideId: string }) {
  const router = useRouter()
  const sbRef  = useRef(createClient())

  const [summary, setSummary] = useState<RideSummary | null>(null)

  useEffect(() => {
    async function load() {
      const { data: ride } = await sbRef.current
        .from('ride_requests')
        .select('zone_id, started_at, completed_at, accepted_by')
        .eq('id', rideId)
        .maybeSingle()
      if (!ride) return

      const [zoneRes, pullerRes] = await Promise.all([
        ride.zone_id
          ? sbRef.current.from('zones').select('name, zone_number').eq('id', ride.zone_id).maybeSingle()
          : Promise.resolve({ data: null }),
        ride.accepted_by
          ? sbRef.current.from('pullers').select('badge_code, total_rides').eq('id', ride.accepted_by).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      let durationMin: number | null = null
      if (ride.started_at && ride.completed_at) {
        const ms = new Date(ride.completed_at).getTime() - new Date(ride.started_at).getTime()
        durationMin = Math.round(ms / 60_000)
      }

      setSummary({
        zoneName:    zoneRes.data?.name       ?? 'Unknown Zone',
        zoneNumber:  zoneRes.data?.zone_number ?? 1,
        durationMin,
        badgeCode:   pullerRes.data?.badge_code   ?? '—',
        totalRides:  (pullerRes.data?.total_rides ?? 0) + 1,
      })
    }
    load()
  }, [rideId])

  const zoneColor = summary ? ZONE_COLORS[summary.zoneNumber] : null

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-[64px] leading-none">✅</div>
          <h1
            className="text-[26px] font-black text-white"
            style={{ letterSpacing: '-0.02em' }}
          >
            যাত্ৰা সম্পন্ন
          </h1>
          <p className="mt-1 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Ride completed successfully
          </p>
        </div>

        {/* Summary card */}
        {summary && (
          <div
            className="mb-6 rounded-3xl p-5"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.09)',
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <SummaryCell label="জ'ন · Zone" value={summary.zoneName} color={zoneColor?.hex} />
              <SummaryCell label="ব্যাজ · Badge" value={summary.badgeCode} />
              <SummaryCell
                label="সময় · Duration"
                value={summary.durationMin != null ? `${summary.durationMin} min` : '—'}
              />
              <SummaryCell label="মুঠ যাত্ৰা · Total" value={`#${summary.totalRides}`} color="#F59E0B" />
            </div>
          </div>
        )}

        {/* Back to dashboard */}
        <button
          type="button"
          onClick={() => router.replace('/dashboard')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-[16px] font-black text-white"
          style={{
            background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
            border: '1.5px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <Home size={18} />
          Dashboard লৈ যাওক
        </button>
      </motion.div>
    </div>
  )
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl p-3"
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wide"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        {label}
      </span>
      <span
        className="text-lg font-black leading-tight"
        style={{ color: color ?? '#FFFFFF' }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Root — detects puller vs passenger ───────────────────────────────────────

export default function CompletePage() {
  const searchParams = useSearchParams()
  const rideId = searchParams.get('ride_id') ?? ''

  const [role,     setRole]     = useState<'puller' | 'passenger' | null>(null)
  const [pullerId, setPullerId] = useState<string | null>(null)

  const sbRef = useRef(createClient())

  useEffect(() => {
    async function detect() {
      const { data: { user } } = await sbRef.current.auth.getUser()
      if (!user) return

      // Determine role from DB
      const [pullerRes] = await Promise.all([
        sbRef.current.from('pullers').select('id').eq('user_id', user.id).maybeSingle(),
      ])

      if (pullerRes.data) {
        setRole('puller')
      } else {
        // Get pullerId for thumbs-up update
        if (rideId) {
          const { data: ride } = await sbRef.current
            .from('ride_requests')
            .select('accepted_by')
            .eq('id', rideId)
            .maybeSingle()
          setPullerId(ride?.accepted_by ?? null)
        }
        setRole('passenger')
      }
    }
    detect()
  }, [rideId])

  if (!role) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: '#1A1A1E' }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  if (role === 'puller') return <PullerComplete rideId={rideId} />
  return <PassengerComplete rideId={rideId} pullerId={pullerId} />
}
