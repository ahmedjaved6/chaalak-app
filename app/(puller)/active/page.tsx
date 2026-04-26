'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, MapPin, Bell, X, UserX, Ghost, Route } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { RideStatus } from '@/lib/types'
import { startRide, endRide, markNoShow } from '@/lib/ride'
import { useT } from '@/lib/i18n'
import { Suspense } from 'react'







// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string | null): string {
  if (!phone) return '——'
  const d = phone.replace(/\D/g, '')
  if (d.length < 5) return phone
  return d.slice(0, 2) + '×'.repeat(Math.max(d.length - 4, 2)) + d.slice(-2)
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function IssueOption({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-white/5 p-4 border border-white/10 transition-all active:scale-[0.98]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-amber-500">
        {icon}
      </div>
      <span className="text-base font-bold text-white">{label}</span>
    </button>
  )
}


// ─── Types ────────────────────────────────────────────────────────────────────

interface PageData {
  rideId:     string
  acceptedAt: string | null
  zone:       { name: string; name_as: string; zone_number: number } | null
  phone:      string | null
  pullerId:   string
  totalRides: number
}

type ToastType = 'error' | 'success' | 'info'

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: ToastType; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const palette: Record<ToastType, { bg: string; border: string }> = {
    error:   { bg: '#7F1D1D', border: '#EF4444' },
    success: { bg: '#064E3B', border: '#10B981' },
    info:    { bg: '#1E3A5F', border: '#3B82F6' },
  }
  const c = palette[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
      style={{ background: c.bg, border: `1.5px solid ${c.border}`, maxWidth: 320, width: 'max-content' }}
    >
      {msg}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ActiveRidePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const rideId       = searchParams.get('ride_id')

  const [data,       setData]       = useState<PageData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [rideStatus, setRideStatus] = useState<RideStatus>('accepted')
  const [elapsed,    setElapsed]    = useState(0)
  const [busy,       setBusy]       = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: ToastType } | null>(null)
  const [showIssue,  setShowIssue]  = useState(false)

  const tr = useT()




  const sbRef    = useRef(createClient())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const showToast    = useCallback((msg: string, type: ToastType = 'info') => setToast({ msg, type }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ── Data load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!rideId) { router.replace('/dashboard'); return }
    const supabase = sbRef.current

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: puller } = await supabase
        .from('pullers')
        .select('id, total_rides')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!puller) { router.replace('/dashboard'); return }

      const { data: ride } = await supabase
        .from('ride_requests')
        .select('id, status, accepted_at, zone_id, passenger_id')
        .eq('id', rideId)
        .maybeSingle()
      if (!ride) { router.replace('/dashboard'); return }

      const [zoneRes, passengerRes] = await Promise.all([
        ride.zone_id
          ? supabase.from('zones').select('name, name_as, zone_number').eq('id', ride.zone_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('passengers').select('user_id').eq('id', ride.passenger_id).maybeSingle(),
      ])

      let phone: string | null = null
      if (passengerRes.data?.user_id) {
        const { data: userRow } = await supabase
          .from('users')
          .select('phone')
          .eq('id', passengerRes.data.user_id)
          .maybeSingle()
        phone = userRow?.phone ?? null
      }

      setData({
        rideId:     ride.id,
        acceptedAt: ride.accepted_at,
        zone:       zoneRes.data as PageData['zone'],
        phone,
        pullerId:   puller.id,
        totalRides: puller.total_rides,
      })
      setRideStatus(ride.status as RideStatus)

      // Start elapsed timer counting up from accepted_at
      const base = ride.accepted_at ? new Date(ride.accepted_at).getTime() : Date.now()
      const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000))
      tick()
      timerRef.current = setInterval(tick, 1000)

      setLoading(false)
    }


    load()
  }, [rideId, router])

  const logIssue = async (event: string, details: Record<string, unknown>) => {

    const { data: { user } } = await sbRef.current.auth.getUser()
    await fetch('/api/admin/log', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user?.id,
        ride_id: rideId,
        role: 'puller',
        event,
        details
      })
    })
    setShowIssue(false)
    showToast('Issue reported to admin', 'success')
  }



  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleStart() {
    if (busy || !data) return
    setBusy(true)
    try {
      await startRide(sbRef.current, data.rideId, data.pullerId)
      setRideStatus('active')
      showToast('Ride started', 'success')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to start ride', 'error')
    } finally {

      setBusy(false)
    }
  }

  async function handleEnd() {
    if (busy || !data) return
    setBusy(true)
    try {
      await endRide(sbRef.current, data.rideId, data.pullerId)
      if (timerRef.current) clearInterval(timerRef.current)
      router.replace(`/complete?ride_id=${data.rideId}`)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to end ride', 'error')
      setBusy(false)
    }

  }

  async function handleNoShow() {
    if (busy || !data) return
    setBusy(true)
    try {
      await markNoShow(sbRef.current, data.rideId, data.pullerId)
      
      // Call cooldown check for the passenger
      const { data: ride } = await sbRef.current
        .from('ride_requests')
        .select('passenger_id')
        .eq('id', data.rideId)
        .maybeSingle()
      
      if (ride?.passenger_id) {
        await fetch('/api/ride/cooldown-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passenger_id: ride.passenger_id })
        })
      }

      if (timerRef.current) clearInterval(timerRef.current)
      router.replace('/dashboard')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error')
      setBusy(false)
    }

  }

  // ── Realtime status listener ──────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return
    const sb = sbRef.current

    const channel = sb
      .channel(`puller-ride-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideId}` },
        (payload) => {
          const newStatus = payload.new.status as RideStatus
          if (newStatus === 'cancelled') {
            showToast('Passenger cancelled ride', 'error')
            setTimeout(() => router.replace('/dashboard'), 2000)
          }
        }
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [rideId, router, showToast])

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: '#1A1A1E' }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
      </div>
    )
  }

  if (!data) return null

  const { zone, phone, totalRides } = data
  const rideNumber = totalRides + 1
  const zoneColor  = zone ? ZONE_COLORS[zone.zone_number] : null
  const isActive   = rideStatus === 'active'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      {/* ── Green header ──────────────────────────────────────────────────── */}
      <div
        className="px-5 pb-8 pt-14"
        style={{ background: 'linear-gradient(180deg, #047857 0%, #10B981 100%)' }}
      >
        <div className="mx-auto max-w-[420px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
            Active Ride
          </p>
          <div className="mt-2 flex items-center justify-between">
            <h1
              className="text-[26px] font-black leading-tight text-white"
              style={{ letterSpacing: '-0.01em' }}
            >
              {tr.accepting_rides.split(' · ')[0]}
            </h1>



            {/* Elapsed timer */}
            <div
              className="rounded-2xl px-4 py-2 text-center"
              style={{ background: 'rgba(0,0,0,0.22)' }}
            >
              <p className="font-mono text-[22px] font-black tabular-nums text-white">
                {formatElapsed(elapsed)}
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-200">
                elapsed
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[420px] px-5 pb-12 pt-5">

        {/* ── Ride number + zone badges ─────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5"
            style={{
              background: 'rgba(245,158,11,0.14)',
              border: '1.5px solid rgba(245,158,11,0.45)',
            }}
          >
            <span className="text-xs font-semibold text-amber-400">যাত্ৰা</span>
            <span className="text-lg font-black leading-none text-amber-400">#{rideNumber}</span>

          </div>

          {zone && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: zoneColor ? `${zoneColor.hex}18` : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${zoneColor ? `${zoneColor.hex}45` : 'rgba(255,255,255,0.12)'}`,
              }}
            >
              <MapPin size={11} color={zoneColor?.hex ?? '#aaa'} />
              <span
                className="text-xs font-bold"
                style={{ color: zoneColor?.hex ?? 'rgba(255,255,255,0.7)' }}
              >
                {zone.name_as}
              </span>
            </div>
          )}
        </div>

        {/* ── Passenger card ────────────────────────────────────────────────── */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1.5px solid rgba(255,255,255,0.09)',
          }}
        >
          <p
            className="mb-4 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            যাত্ৰী · Passenger
          </p>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[26px] font-black tabular-nums tracking-wider text-white">
                {maskPhone(phone)}
              </p>
              <p
                className="mt-1 truncate text-xs font-semibold"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {zone ? `${zone.name_as} · ${zone.name}` : 'Zone unknown'}
              </p>
            </div>

            {/* Call + Issue buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowIssue(true)}
                className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl transition-opacity active:opacity-70"
                style={{ background: '#F59E0B' }}
              >
                <Bell size={22} color="#1A1A1E" strokeWidth={2.5} />
                <span className="mt-0.5 text-[9px] font-black tracking-wide text-[#1A1A1E]">{tr.report_issue.split(' ')[0]}</span>
              </button>


              {phone && (
                <a
                  href={`tel:${phone.replace(/\D/g, '')}`}
                  className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl transition-opacity active:opacity-70"
                  style={{ background: '#10B981' }}
                >
                  <Phone size={22} color="#fff" strokeWidth={2.5} />
                  <span className="mt-0.5 text-[9px] font-black tracking-wide text-white">{tr.call_puller.split(' ')[2] || 'CALL'}</span>
                </a>

              )}
            </div>
          </div>
        </div>

        {/* Issue Modal */}
        <AnimatePresence>
          {showIssue && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowIssue(false)}
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
                  <button onClick={() => setShowIssue(false)} className="rounded-full bg-white/5 p-2">

                    <X size={20} className="text-white/40" />
                  </button>
                </div>

                <div className="space-y-3">
                  <IssueOption 
                    label="Passenger not found" 
                    icon={<Ghost size={18} />} 
                    onClick={() => logIssue('passenger_not_found', {})}
                  />
                  <IssueOption 
                    label="Passenger cancelled in person" 
                    icon={<UserX size={18} />} 
                    onClick={() => logIssue('passenger_cancelled_verbal', {})}
                  />
                  <IssueOption 
                    label="Route issue" 
                    icon={<Route size={18} />} 
                    onClick={() => logIssue('route_issue_puller', {})}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>


        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-col gap-3">

          {/* START RIDE (dark) → END RIDE (green) */}
          <motion.button
            type="button"
            disabled={busy}
            onClick={isActive ? handleEnd : handleStart}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-2xl py-5 text-[18px] font-black tracking-wide text-white disabled:opacity-60"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #065F46 0%, #059669 100%)'
                : 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
              border: isActive
                ? '1.5px solid #10B981'
                : '1.5px solid rgba(255,255,255,0.08)',
              boxShadow: isActive
                ? '0 4px 28px rgba(16,185,129,0.35)'
                : '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            {busy ? '…' : isActive ? 'END RIDE' : 'START RIDE'}
          </motion.button>


          {/* No-Show — red outline, only before ride is started */}
          {!isActive && (
            <motion.button
              type="button"
              disabled={busy}
              onClick={handleNoShow}
              whileTap={{ scale: 0.97 }}
              className="w-full rounded-2xl py-4 text-[15px] font-black tracking-wide disabled:opacity-60"
              style={{
                background: 'transparent',
                border: '2px solid #EF4444',
                color: '#EF4444',
              }}
            >
              No-Show
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <Toast key="toast" msg={toast.msg} type={toast.type} onDismiss={dismissToast} />
        )}
      </AnimatePresence>
    </div>
  )
}
export default function ActiveRidePageSuspense() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1A1A1E]" />}>
      <ActiveRidePage />
    </Suspense>
  )
}
