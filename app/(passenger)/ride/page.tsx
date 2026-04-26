'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Phone, ShieldAlert, X, Bell, AlertTriangle, Clock, MapPin, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { cancelRideRequest } from '@/lib/ride'
import { ZONE_COLORS } from '@/lib/constants'
import type { RideStatus } from '@/lib/types'
import type { RideMapProps } from '../_components/RideMap'
import { useT } from '@/lib/i18n'



const RideMap = dynamic<RideMapProps>(
  () => import('../_components/RideMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center" style={{ background: '#0f1117' }}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    ),
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PullerInfo {
  id:          string
  badgeCode:   string
  badgeNumber: number
  thumbsUp:    number
  name:        string
  phone:       string | null
  zoneNumber:  number
  zoneNameAs:  string
}

// ─── Status label helper ──────────────────────────────────────────────────────

function statusLabel(s: RideStatus, tr: ReturnType<typeof useT>): string {

  if (s === 'requested') return tr.searching
  if (s === 'accepted')  return tr.puller_found
  if (s === 'active')    return '🚀 যাত্ৰা আৰম্ভ হ\'ল'
  return ''
}


function ReportOption({ label, icon, onClick, variant = 'default' }: { label: string; icon: React.ReactNode; onClick: () => void, variant?: 'default' | 'danger' }) {

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl p-4 transition-all active:scale-[0.98]"
      style={{
        background: variant === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
        border: variant === 'danger' ? '1.5px solid rgba(239,68,68,0.3)' : '1.5px solid rgba(255,255,255,0.08)',
        color: variant === 'danger' ? '#EF4444' : '#fff'
      }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
        {icon}
      </div>
      <span className="text-base font-bold">{label}</span>
    </button>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PassengerRidePage() {
  const router = useRouter()

  const [rideId,       setRideId]       = useState<string | null>(null)
  const [passengerId,  setPassengerId]  = useState<string | null>(null)
  const [rideStatus,   setRideStatus]   = useState<RideStatus>('requested')
  const [puller,       setPuller]       = useState<PullerInfo | null>(null)
  const [passengerPos, setPassengerPos] = useState<[number, number] | null>(null)
  const [pullerPos,    setPullerPos]    = useState<[number, number] | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [cancelling,   setCancelling]   = useState(false)
  const [showReport,   setShowReport]   = useState(false)
  const [showToast,    setShowToast]    = useState(false)

  const tr = useT()




  const sbRef       = useRef(createClient())
  const pullerIdRef = useRef<string | null>(null)

  // ── Geolocation ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setPassengerPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  // ── Navigate when completed ───────────────────────────────────────────────────

  useEffect(() => {
    if ((rideStatus === 'completed' || rideStatus === 'no_show') && rideId) {
      localStorage.removeItem('chaalak_ride_id')
      router.replace(`/complete?ride_id=${rideId}`)
    }
    if (rideStatus === 'cancelled') {
      localStorage.removeItem('chaalak_ride_id')
      router.replace('/')
    }
  }, [rideStatus, rideId, router])

  // ── Load puller details (called on accept and on initial load) ────────────────

  const loadPullerInfo = useCallback(async (pid: string) => {
    const sb = sbRef.current
    const { data: p } = await sb
      .from('pullers')
      .select('id, badge_code, badge_number, thumbs_up, lat, lng, zone_id, user_id')
      .eq('id', pid)
      .maybeSingle()
    if (!p) return

    const [userRes, zoneRes] = await Promise.all([
      sb.from('users').select('name, phone').eq('id', p.user_id).maybeSingle(),
      sb.from('zones').select('zone_number, name_as').eq('id', p.zone_id).maybeSingle(),
    ])

    pullerIdRef.current = p.id
    setPuller({
      id:          p.id,
      badgeCode:   p.badge_code,
      badgeNumber: p.badge_number,
      thumbsUp:    p.thumbs_up ?? 0,
      name:        userRes.data?.name  ?? 'Puller',
      phone:       userRes.data?.phone ?? null,
      zoneNumber:  zoneRes.data?.zone_number ?? 1,
      zoneNameAs:  zoneRes.data?.name_as     ?? '',
    })
    if (p.lat != null && p.lng != null) setPullerPos([p.lat, p.lng])
  }, [])

  // ── Refresh puller GPS every 10 s ─────────────────────────────────────────────

  const refreshPullerPos = useCallback(async () => {
    if (!pullerIdRef.current) return
    const { data } = await sbRef.current
      .from('pullers')
      .select('lat, lng')
      .eq('id', pullerIdRef.current)
      .maybeSingle()
    if (data?.lat != null && data?.lng != null)
      setPullerPos([data.lat as number, data.lng as number])
  }, [])

  const logIssue = async (event: string, details: Record<string, unknown>) => {

    const { data: { user } } = await sbRef.current.auth.getUser()
    await fetch('/api/admin/log', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user?.id,
        ride_id: rideId,
        role: 'passenger',
        event,
        details
      })
    })
    setShowReport(false)
  }


  const handleSOS = () => {
    const confirm = window.confirm('Emergency contact কৰিবনে? (Contact emergency?)')
    if (confirm) {
      window.open(sosUrl, '_blank')
    }
  }

  const handleShare = async () => {
    if (!rideId) return
    const shareUrl = `${window.location.origin}/share/${rideId}`
    const text = `Track my Chaalak ride live — Puller Badge: ${puller?.badgeCode || ''}${puller?.badgeNumber || ''}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Track my Chaalak ride',
          text,
          url: shareUrl
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    }
  }


  // ── Initial load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const sb = sbRef.current

    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: passenger } = await sb
        .from('passengers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!passenger) { router.replace('/'); return }
      setPassengerId(passenger.id)

      // Resolve ride_id: localStorage → DB fallback
      let rid: string | null = localStorage.getItem('chaalak_ride_id')
      if (!rid) {
        const { data: active } = await sb
          .from('ride_requests')
          .select('id')
          .eq('passenger_id', passenger.id)
          .in('status', ['requested', 'accepted', 'active'])
          .maybeSingle()
        if (!active) { router.replace('/'); return }
        rid = active.id as string
        localStorage.setItem('chaalak_ride_id', rid)
      }
      setRideId(rid)

      const { data: ride } = await sb
        .from('ride_requests')
        .select('status, accepted_by')
        .eq('id', rid)
        .maybeSingle()
      if (!ride) { router.replace('/'); return }
      setRideStatus(ride.status as RideStatus)

      if (ride.accepted_by) {
        await loadPullerInfo(ride.accepted_by)
        await refreshPullerPos()
      }

      setLoading(false)
    }

    load()
  }, [router, loadPullerInfo, refreshPullerPos])

  // ── Realtime subscription + 10 s position poll ────────────────────────────────

  useEffect(() => {
    if (!rideId) return
    const sb = sbRef.current

    const channel = sb
      .channel(`passenger-ride-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideId}` },
        async (payload) => {
          const newStatus = payload.new.status as RideStatus
          setRideStatus(newStatus)
          if (
            (newStatus === 'accepted' || newStatus === 'active') &&
            payload.new.accepted_by &&
            payload.new.accepted_by !== pullerIdRef.current
          ) {
            await loadPullerInfo(payload.new.accepted_by)
          }
        }
      )
      .subscribe()

    const interval = setInterval(refreshPullerPos, 10_000)

    return () => {
      sb.removeChannel(channel)
      clearInterval(interval)
    }
  }, [rideId, loadPullerInfo, refreshPullerPos])

  // ── Cancel ride ───────────────────────────────────────────────────────────────

  async function handleCancel() {
    if (!rideId || !passengerId || cancelling) return
    setCancelling(true)
    try {
      await cancelRideRequest(sbRef.current, rideId, passengerId)
      localStorage.removeItem('chaalak_ride_id')
      router.replace('/')
    } catch {
      setCancelling(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

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

  // ── Derived ───────────────────────────────────────────────────────────────────

  const zoneColor  = puller ? ZONE_COLORS[puller.zoneNumber] : null
  const canCancel  = rideStatus === 'requested' || rideStatus === 'accepted'
  const sosText    = encodeURIComponent(
    `SOS ${rideId ?? ''} ${puller?.badgeCode ?? ''} ${new Date().toLocaleTimeString('en-IN')}`
  )
  const sosUrl = `https://wa.me/${process.env.NEXT_PUBLIC_SOS_NUMBER || '919999999999'}?text=${sosText}`

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="relative shrink-0" style={{ height: '46dvh', minHeight: 220 }}>
        <RideMap passengerPos={passengerPos} pullerPos={pullerPos} />

        {/* Status pill */}
        <div
          className="absolute left-3 top-3 z-[1000] rounded-xl px-3 py-1.5 text-sm font-bold text-white"
          style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)' }}
        >
          {statusLabel(rideStatus, tr)}
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="absolute right-3 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-xl text-white transition-all active:scale-90"
          style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Share2 size={18} />
        </button>

        {/* Toast */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 10, x: '-50%' }}
              className="fixed left-1/2 top-16 z-[2000] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg"
            >
              Link copied!
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── Bottom sheet ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-4 pb-safe">

        {/* ETA */}
        <p
          className="mb-4 text-center text-sm font-semibold"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          সাধাৰণতে ৩–৭ মিনিটত আহে
        </p>

        {/* Puller card */}
        <AnimatePresence mode="wait">
          {puller ? (
            <motion.div
              key="puller-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-3xl p-4"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1.5px solid rgba(255,255,255,0.09)',
              }}
            >
              <p
                className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                তোমাৰ ৰিক্সাৱালা
              </p>

              <div className="flex items-center gap-3">
                {/* Badge in zone color */}
                <div
                  className="flex h-[56px] w-[56px] shrink-0 flex-col items-center justify-center rounded-2xl"
                  style={{
                    background: zoneColor ? `${zoneColor.hex}1A` : 'rgba(255,255,255,0.08)',
                    border: `2px solid ${zoneColor?.hex ?? 'rgba(255,255,255,0.2)'}`,
                  }}
                >
                  <span
                    className="text-[9px] font-bold leading-none"
                    style={{ color: zoneColor?.hex ?? '#fff' }}
                  >
                    {puller.badgeCode.slice(0, 2)}
                  </span>
                  <span
                    className="text-[22px] font-black leading-tight"
                    style={{ color: zoneColor?.hex ?? '#fff' }}
                  >
                    {puller.badgeNumber}
                  </span>
                </div>

                {/* Name + stats */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white">{puller.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      👍 {puller.thumbsUp}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {puller.zoneNameAs}
                    </span>
                  </div>
                </div>

                {/* Call button */}
                {puller.phone && (
                  <a
                    href={`tel:${puller.phone.replace(/\D/g, '')}`}
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl active:opacity-70"
                    style={{ background: '#10B981' }}
                  >
                    <Phone size={20} color="#fff" strokeWidth={2.5} />
                    <span className="mt-0.5 text-[8px] font-black text-white">{tr.call_puller.split(' ')[2] || 'CALL'}</span>
                  </a>
                )}


              </div>
            </motion.div>
          ) : (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-center justify-center gap-3 rounded-3xl p-6"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1.5px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {tr.searching}
              </p>

            </motion.div>
          )}
        </AnimatePresence>

        {/* SOS + Alert + Cancel */}
        <div className="mt-auto flex flex-col gap-3 pb-6">
          <button
            onClick={handleSOS}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-black"
            style={{
              background: '#EF4444',
              boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
              color: '#fff',
            }}
          >
            <ShieldAlert size={20} strokeWidth={2.5} />
            {tr.sos}
          </button>


          <div className="flex gap-3">
            <button
              onClick={() => setShowReport(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black"
              style={{
                background: '#F59E0B',
                color: '#1A1A1E',
              }}
            >
              <Bell size={17} strokeWidth={2.5} />
              {tr.report_issue}
            </button>


            <button
              type="button"
              onClick={handleCancel}
              disabled={!canCancel || cancelling}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black disabled:opacity-35"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1.5px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              <X size={17} />
              {cancelling ? '…' : tr.cancel}
            </button>

          </div>
        </div>

        {/* Report Modal */}
        <AnimatePresence>
          {showReport && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowReport(false)}
                className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="fixed bottom-0 left-0 right-0 z-[2001] rounded-t-[32px] bg-[#1A1A1E] px-6 pb-10 pt-8 shadow-2xl"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white font-nunito">{tr.report_issue}</h3>
                  <button onClick={() => setShowReport(false)} className="rounded-full bg-white/5 p-2">

                    <X size={20} className="text-white/40" />
                  </button>
                </div>

                <div className="space-y-3">
                  <ReportOption 
                    label="Puller not arriving" 
                    icon={<Clock size={18} />} 
                    onClick={() => logIssue('puller_not_arriving', { status: 'waiting' })}
                  />
                  <ReportOption 
                    label="Wrong route" 
                    icon={<MapPin size={18} />} 
                    onClick={() => logIssue('wrong_route', { lat: pullerPos?.[0], lng: pullerPos?.[1] })}
                  />
                  <ReportOption 
                    label="Feeling unsafe" 
                    variant="danger"
                    icon={<AlertTriangle size={18} />} 
                    onClick={() => { logIssue('unsafe_passenger', {}); handleSOS(); }}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
