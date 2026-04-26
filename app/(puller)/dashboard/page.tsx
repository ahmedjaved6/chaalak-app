'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Clock, User, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS, HEARTBEAT_INTERVAL_MS } from '@/lib/constants'
import type { Zone, Puller, Subscription } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  puller:       Puller
  user:         { name: string }
  zone:         Zone | null
  subscription: Subscription | null
  todayRides:   number
  monthRides:   number
  zoneRank:     number
}

type ToastType = 'error' | 'success' | 'info'

// ─── Subscription helpers ─────────────────────────────────────────────────────

function getSubState(sub: Subscription | null): {
  color: string; bg: string; label: string; daysLeft: number
} {
  if (!sub) return { color: '#6B7280', bg: 'rgba(107,114,128,0.15)', label: 'No subscription', daysLeft: 0 }

  const now      = Date.now()
  const till     = new Date(sub.valid_till).getTime()
  const daysLeft = Math.ceil((till - now) / 86_400_000)

  if (daysLeft < 0 || sub.status === 'expired')
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: `Expired`, daysLeft }
  if (daysLeft <= 7)
    return { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: `${daysLeft}d remaining`, daysLeft }
  return { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: `${daysLeft}d remaining`, daysLeft }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BadgeTag({ puller, zone }: { puller: Puller; zone: Zone | null }) {
  const c    = zone ? ZONE_COLORS[zone.zone_number] : null
  const code = puller.badge_code?.startsWith('PENDING')
    ? `Z${zone?.zone_number ?? '?'}`
    : puller.badge_code

  return (
    <div
      className="rounded-full px-3 py-1.5 text-xs font-black tracking-wide"
      style={{
        background: c ? `${c.hex}22` : 'rgba(255,255,255,0.08)',
        border: `1.5px solid ${c ? c.hex : 'rgba(255,255,255,0.18)'}`,
        color: c ? c.hex : 'rgba(255,255,255,0.6)',
      }}
    >
      {code}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.08)' }}
    >
      <span className="text-[28px] font-black leading-none text-white">{value}</span>
      <span className="text-[11px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.42)' }}>
        {label}
      </span>
      {sub && (
        <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.28)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function SubBar({ sub }: { sub: Subscription | null }) {
  const s = getSubState(sub)
  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-3"
      style={{ background: s.bg, border: `1.5px solid ${s.color}40` }}
    >
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
        <span className="text-sm font-bold" style={{ color: s.color }}>
          Subscription
        </span>
      </div>
      <span className="text-sm font-black" style={{ color: s.color }}>
        {s.label}
      </span>
    </div>
  )
}

function Toast({ msg, type, onDismiss }: { msg: string; type: ToastType; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colors: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
    error:   { bg: '#7F1D1D', border: '#EF4444', icon: <AlertCircle size={16} /> },
    success: { bg: '#064E3B', border: '#10B981', icon: <CheckCircle2 size={16} /> },
    info:    { bg: '#1E3A5F', border: '#3B82F6', icon: <MapPin size={16} /> },
  }
  const c = colors[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
      style={{ background: c.bg, border: `1.5px solid ${c.border}`, maxWidth: 320, width: 'max-content' }}
    >
      {c.icon}
      {msg}
    </motion.div>
  )
}

function TabBar({ active }: { active: 'home' | 'history' | 'profile' }) {
  const router = useRouter()
  const tabs = [
    { key: 'home',    icon: Home,  label: 'Home',    href: '/dashboard' },
    { key: 'history', icon: Clock, label: 'History', href: '/history'   },
    { key: 'profile', icon: User,  label: 'Profile', href: '/profile'   },
  ] as const

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t px-2 pb-safe pt-2"
      style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.08)', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {tabs.map(({ key, icon: Icon, label, href }) => {
        const isActive = key === active
        return (
          <button
            key={key}
            type="button"
            onClick={() => router.push(href)}
            className="flex flex-1 flex-col items-center gap-1 py-1 transition-opacity"
            style={{ opacity: isActive ? 1 : 0.4 }}
          >
            <Icon size={22} color={isActive ? '#F59E0B' : '#FFFFFF'} strokeWidth={isActive ? 2.5 : 2} />
            <span
              className="text-[10px] font-bold"
              style={{ color: isActive ? '#F59E0B' : 'rgba(255,255,255,0.5)' }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PullerDashboardPage() {
  const router = useRouter()

  const [data, setData]       = useState<DashboardData | null>(null)
  const [online, setOnline]   = useState(false)
  const [toggling, setToggling] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)
  const [toast, setToast]     = useState<{ msg: string; type: ToastType } | null>(null)

  // Stable refs — persist across renders, safe in closures
  const sbRef       = useRef(createClient())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pullerIdRef = useRef<string>('')
  const dataRef     = useRef<DashboardData | null>(null)

  // ── Toast helpers ────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string, type: ToastType = 'info') => {
    setToast({ msg, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  // ── Heartbeat sender ─────────────────────────────────────────────────────

  const sendHeartbeat = useCallback(
    (lat: number, lng: number) => {
      const id = pullerIdRef.current
      if (!id) return
      // Try RPC first; fall back to direct UPDATE so it works before RPC is created
      sbRef.current
        .rpc('puller_heartbeat', { puller_id: id, lat, lng })
        .then(({ error }) => {
          if (error) {
            sbRef.current
              .from('pullers')
              .update({ lat, lng, last_active_at: new Date().toISOString() })
              .eq('id', id)
          }
        })
    },
    []
  )

  // ── Go offline (extracted for reuse in cleanup) ──────────────────────────

  const goOffline = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const id = pullerIdRef.current
    if (id) {
      sbRef.current.from('pullers').update({ is_online: false }).eq('id', id)
    }
    setOnline(false)
  }, [])

  // ── Page-unload cleanup ───────────────────────────────────────────────────

  useEffect(() => {
    const handleUnload = () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
      const id = pullerIdRef.current
      if (id) {
        // Best-effort — browser may not wait for this promise
        sbRef.current.from('pullers').update({ is_online: false }).eq('id', id)
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleUnload()
    }

    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
      handleUnload()
    }
  }, [])

  // ── Data load ────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = sbRef.current

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      // Puller row
      const { data: puller } = await supabase
        .from('pullers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!puller) { router.replace('/onboarding'); return }

      pullerIdRef.current = puller.id
      setOnline(puller.is_online ?? false)

      // Parallel: user name, zone, subscription, ride counts, zone rank
      const [userRes, zoneRes, subRes, todayRes, monthRes, rankRes] = await Promise.all([
        supabase.from('users').select('name').eq('id', user.id).maybeSingle(),

        puller.zone_id
          ? supabase.from('zones').select('*').eq('id', puller.zone_id).maybeSingle()
          : Promise.resolve({ data: null }),

        supabase
          .from('subscriptions')
          .select('*')
          .eq('puller_id', puller.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('ride_requests')
          .select('*', { count: 'exact', head: true })
          .eq('accepted_by', puller.id)
          .gte('created_at', (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() })()),

        supabase
          .from('ride_requests')
          .select('*', { count: 'exact', head: true })
          .eq('accepted_by', puller.id)
          .gte('created_at', (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString() })()),

        supabase
          .from('pullers')
          .select('*', { count: 'exact', head: true })
          .eq('zone_id', puller.zone_id)
          .eq('status', 'active')
          .gt('total_rides', puller.total_rides),
      ])

      const nextData: DashboardData = {
        puller:       puller as Puller,
        user:         { name: userRes.data?.name ?? 'Puller' },
        zone:         zoneRes.data as Zone | null,
        subscription: subRes.data as Subscription | null,
        todayRides:   todayRes.count ?? 0,
        monthRides:   monthRes.count ?? 0,
        zoneRank:     (rankRes.count ?? 0) + 1,
      }
      dataRef.current = nextData
      setData(nextData)
      setLoadingPage(false)

    }

    load()
  }, [router])

  // ── Toggle online / offline ──────────────────────────────────────────────

  async function handleToggle() {
    if (toggling || !pullerIdRef.current) return
    setToggling(true)

    if (!online) {
      // ── Go ONLINE ──────────────────────────────────────────────────────
      if (!('geolocation' in navigator)) {
        showToast('Geolocation not supported on this device', 'error')
        setToggling(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords

          await sbRef.current
            .from('pullers')
            .update({ is_online: true, lat, lng, last_active_at: new Date().toISOString() })
            .eq('id', pullerIdRef.current)

          setOnline(true)
          showToast('You are now online', 'success')

          // ── Push subscription + notify online zone peers ────────────────
          ;(async () => {
            try {
              // 1. Register this puller's device for push
              const { registerPushSubscription } = await import('@/lib/push')
              await registerPushSubscription()

              // 2. Notify all online pullers in same zone about waiting rides
              const currentData = dataRef.current
              if (currentData?.puller?.zone_id) {
                const { data: onlinePullers } = await sbRef.current
                  .from('pullers')
                  .select('user_id')
                  .eq('zone_id', currentData.puller.zone_id)
                  .eq('is_online', true)
                  .neq('id', pullerIdRef.current)   // exclude self

                if (onlinePullers?.length) {
                  await Promise.allSettled(
                    onlinePullers.map(({ user_id }: { user_id: string }) =>
                      fetch('/api/push/send', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({
                          user_id,
                          title: 'নতুন যাত্ৰা',
                          body:  'আপোনাৰ জোনত যাত্ৰী আছে',
                          url:   '/incoming',
                        }),
                      })
                    )
                  )
                }
              }
            } catch {
              // non-critical — push failures must not block the UX
            }
          })()
          // ────────────────────────────────────────────────────────────────

          // Start heartbeat interval
          intervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
              (p) => sendHeartbeat(p.coords.latitude, p.coords.longitude),
              () => { /* silent fail on interval */ },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
            )
          }, HEARTBEAT_INTERVAL_MS)

          setToggling(false)
        },
        () => {
          showToast('GPS required to go online', 'error')
          setToggling(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      // ── Go OFFLINE ─────────────────────────────────────────────────────
      goOffline()
      showToast('You are now offline', 'info')
      setToggling(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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

  if (!data) return null

  const { puller, user, zone, subscription, todayRides, monthRides, zoneRank } = data

  return (
    <div
      className="min-h-screen pb-24"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      <div className="mx-auto max-w-[420px] px-5 pt-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
              নমস্কাৰ
            </p>
            <h1 className="mt-0.5 text-[28px] font-black leading-tight text-white" style={{ letterSpacing: '-0.02em' }}>
              {user.name}
            </h1>
          </div>
          <BadgeTag puller={puller} zone={zone} />
        </div>

        {/* ── Online/Offline toggle ───────────────────────────────────────── */}
        <motion.button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          className="mt-6 flex w-full items-center justify-between rounded-2xl px-5 py-5 transition-all"
          style={{
            background: online ? '#10B981' : '#F2F0EB',
            border: `2px solid ${online ? '#10B981' : '#E8E5DE'}`,
            boxShadow: online ? '0 4px 32px rgba(16,185,129,0.35)' : 'none',
            cursor: toggling ? 'wait' : 'pointer',
          }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="flex flex-col items-start">
            <span
              className="text-[18px] font-black leading-tight"
              style={{ color: online ? '#FFFFFF' : '#374151' }}
            >
              {toggling ? '…' : online ? 'ONLINE' : 'OFFLINE'}
            </span>
            <span
              className="mt-0.5 text-xs font-semibold"
              style={{ color: online ? 'rgba(255,255,255,0.7)' : '#6B7280' }}
            >
              {online ? 'Accepting rides · GPS active' : 'Tap to start accepting rides'}
            </span>
          </div>

          {/* Toggle pill indicator */}
          <div
            className="relative flex h-8 w-14 items-center rounded-full transition-colors"
            style={{ background: online ? 'rgba(255,255,255,0.25)' : '#D1D5DB' }}
          >
            <motion.div
              className="absolute h-6 w-6 rounded-full shadow-md"
              style={{ background: online ? '#FFFFFF' : '#FFFFFF' }}
              animate={{ left: online ? 28 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          </div>
        </motion.button>

        {/* ── Stats 2×2 grid ──────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard label="আজিৰ যাত্ৰা · Today" value={todayRides} />
          <StatCard label="এই মাহ · This month"  value={monthRides} />
          <StatCard
            label="👍 Thumbs up"
            value={puller.thumbs_up}
          />
          <StatCard
            label="Zone rank"
            value={`#${zoneRank}`}
            sub={zone ? `in ${zone.name_as}` : undefined}
          />
        </div>

        {/* ── Subscription bar ────────────────────────────────────────────── */}
        <div className="mt-4">
          <SubBar sub={subscription} />
        </div>

        {/* ── Zone info chip ───────────────────────────────────────────────── */}
        {zone && (
          <div
            className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
              style={{ background: ZONE_COLORS[zone.zone_number]?.hex ?? '#888' }}
            >
              {zone.zone_number}
            </div>
            <div>
              <span className="text-sm font-bold text-white">{zone.name_as}</span>
              <span className="ml-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {zone.name}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: online ? '#10B981' : '#6B7280' }}
              />
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {online ? 'live' : 'offline'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <Toast key="toast" msg={toast.msg} type={toast.type} onDismiss={dismissToast} />
        )}
      </AnimatePresence>

      {/* ── Bottom tab bar ────────────────────────────────────────────────── */}
      <TabBar active="home" />
    </div>
  )
}
