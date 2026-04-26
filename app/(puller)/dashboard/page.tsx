'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Clock, User, MapPin, AlertCircle, CheckCircle2, BarChart2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { HEARTBEAT_INTERVAL_MS, ZONE_COLORS } from '@/lib/constants'
import type { Zone, Puller, Subscription } from '@/lib/types'
import LogoutButton from '@/components/LogoutButton'
import { useT } from '@/lib/i18n'
import { SkeletonBox } from '@/components/Skeleton'
import { Suspense } from 'react'




// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  puller:       Puller
  user:         { name: string }
  zone:         Zone | null
  subscription: Subscription | null
  todayRides:   number
  monthRides:   number
  zoneRank:     number
  totalRequests: number // for acceptance rate
  weekRides:    number
}

interface RecentRidePuller {
  id: string
  completed_at: string
  passenger_phone: string
  zone: { name_as: string, zone_number: number }
  thumbs_up: boolean
  duration_mins: number
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
    { key: 'home',    icon: Home,      label: 'Home',    href: '/dashboard' },
    { key: 'history', icon: Clock,     label: 'History', href: '/history'   },
    { key: 'summary', icon: BarChart2, label: 'Summary', href: '/summary'   },
    { key: 'profile', icon: User,      label: 'Profile', href: '/profile'   },
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

function SkeletonDashboard() {
  return (
    <div className="mx-auto max-w-[420px] px-5 pt-12" style={{ backgroundColor: '#1A1A1E' }}>
      <div className="flex items-start justify-between">
        <div>
          <SkeletonBox h="18px" w="80px" />
          <div className="mt-2" />
          <SkeletonBox h="32px" w="180px" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <SkeletonBox h="28px" w="60px" rounded="20px" />
          <div className="mt-2" />
          <SkeletonBox h="24px" w="70px" rounded="20px" />
        </div>
      </div>
      <div className="mt-8" />
      <SkeletonBox h="88px" rounded="20px" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SkeletonBox h="80px" rounded="16px" />
        <SkeletonBox h="80px" rounded="16px" />
        <SkeletonBox h="80px" rounded="16px" />
        <SkeletonBox h="80px" rounded="16px" />
        <SkeletonBox h="80px" rounded="16px" />
        <SkeletonBox h="80px" rounded="16px" />
      </div>
      <div className="mt-4" />
      <SkeletonBox h="60px" rounded="16px" />
      <div className="mt-4" />
      <SkeletonBox h="48px" rounded="16px" />
    </div>
  )
}

function PullerDashboardPage() {
  const router = useRouter()

  const [data, setData]       = useState<DashboardData | null>(null)
  const [online, setOnline]   = useState(false)
  const [toggling, setToggling] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)
  const [toast, setToast]     = useState<{ msg: string; type: ToastType } | null>(null)
  const [recentRides, setRecentRides] = useState<RecentRidePuller[]>([])


  const tr = useT()



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
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
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

      // Parallel: user name, zone, subscription, ride counts, zone rank, zone requests, weekly rides
      const [userRes, zoneRes, subRes, todayRes, monthRes, rankRes, zoneReqRes, weekRidesRes] = await Promise.all([

        supabase.from('users').select('name').eq('id', user.id).maybeSingle(),

        puller.zone_id
          ? supabase.from('zones').select('*').eq('id', puller.zone_id).maybeSingle()
          : Promise.resolve({ data: null }),

        supabase
          .from('subscriptions')
          .select('status, valid_till, valid_from, amount')
          .eq('puller_id', puller.id)
          .eq('status', 'active')
          .gte('valid_till', new Date().toISOString().split('T')[0])
          .order('valid_till', { ascending: false })
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
          .select('id')
          .eq('zone_id', puller.zone_id)
          .eq('status', 'active')
          .eq('is_online', true)
          .order('thumbs_up', { ascending: false }),


        // Total requests in zone (for acceptance rate)
        supabase
          .from('ride_requests')
          .select('*', { count: 'exact', head: true })
          .eq('zone_id', puller.zone_id)
          .gte('created_at', (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString() })()),

        supabase
          .from('ride_requests')
          .select('id', { count: 'exact', head: true })
          .eq('accepted_by', puller.id)
          .eq('status', 'completed')
          .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ])

      const nextData: DashboardData = {
        puller:       puller as Puller,
        user:         { name: userRes.data?.name ?? 'Puller' },
        zone:         zoneRes.data as Zone | null,
        subscription: subRes.data as Subscription | null,
        todayRides:   todayRes.count ?? 0,
        monthRides:   monthRes.count ?? 0,
        zoneRank:     1,
        totalRequests: Math.max(monthRes.count ?? 0, zoneReqRes?.count ?? 15),
        weekRides:    weekRidesRes.count ?? 0,
      }

      // Zone Rank calculation with try/catch
      try {
        const pullers = rankRes.data || []
        const rank = pullers.findIndex((p: { id: string }) => p.id === puller.id) + 1
        nextData.zoneRank = rank || 1
      } catch {
        nextData.zoneRank = 1
      }

      dataRef.current = nextData
      setData(nextData)

      // Parallel: Recent Rides
      const recentRidesPromise = supabase
        .from('ride_requests')
        .select(`
          id, completed_at, thumbs_up, started_at,
          passengers (users (phone)),
          zones (name_as, zone_number)
        `)
        .eq('accepted_by', puller.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3)

      const [{ data: rides }] = await Promise.all([recentRidesPromise])

      if (rides) {
        setRecentRides(rides.map(r => {
          const start = r.started_at ? new Date(r.started_at).getTime() : 0
          const end   = r.completed_at ? new Date(r.completed_at).getTime() : 0
          const diff  = Math.max(1, Math.round((end - start) / 60000))
          
          const passData = r.passengers as unknown as { users: { phone: string } } | null
          const rawPhone = passData?.users?.phone || '**********'
          const masked = rawPhone.length > 5 ? rawPhone.slice(0, 3) + '****' + rawPhone.slice(-3) : '**********'

          return {
            id: r.id,
            completed_at: r.completed_at!,
            passenger_phone: masked,
            zone: r.zones as unknown as RecentRidePuller['zone'],
            thumbs_up: !!r.thumbs_up,
            duration_mins: diff
          }
        }))
      }




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
              const currentData = dataRef.current
              if (currentData?.puller?.user_id) {
                const { registerPushSubscription } = await import('@/lib/push')
                await registerPushSubscription(currentData.puller.user_id)
              }

              // 2. Notify all online pullers in same zone about waiting rides
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
    return <SkeletonDashboard />
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
              {tr.hello}
            </p>
            <h1 className="mt-0.5 text-[28px] font-black leading-tight text-white" style={{ letterSpacing: '-0.02em' }}>
              {user.name}
            </h1>
          </div>

          <div className="flex flex-col items-end gap-2">
            <BadgeTag puller={puller} zone={zone} />
            <LogoutButton color={zone ? ZONE_COLORS[zone.zone_number].hex : '#F59E0B'} />
          </div>

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
              className="text-lg font-black"
              style={{ color: online ? '#fff' : '#1A1A1E' }}
            >
              {toggling ? '…' : online ? tr.online : tr.offline}
            </span>

            <span
              className="mt-0.5 text-xs font-semibold"
              style={{ color: online ? 'rgba(255,255,255,0.7)' : '#6B7280' }}
            >
              {online ? tr.accepting_rides : 'Tap to start accepting rides'}
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

        {/* ── Stats 3×2 grid ──────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={tr.today} value={todayRides} />
          <StatCard label={tr.this_month}  value={monthRides} />
          <StatCard
            label={tr.thumbs_up}
            value={puller.thumbs_up}
          />
          <StatCard
            label={tr.zone_rank}
            value={`#${zoneRank}`}
            sub={zone ? `in ${zone.name_as}` : undefined}
          />
          <StatCard 
            label={tr.acceptance} 
            value={`${Math.min(100, Math.round((monthRides / (data.totalRequests || 1)) * 100))}%`} 
          />
          <StatCard 
            label={tr.avg_rating} 
            value={puller.thumbs_up} 
            sub="Total Likes 👍"
          />
        </div>


        {/* Earnings Strip */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-amber-500 font-nunito">{tr.this_month}: {monthRides} যাত্ৰা</span>
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <p className="mt-0.5 text-[10px] font-bold text-amber-500/60 uppercase tracking-tight">
            Subscription: ₹100/month — আপুনি সকলো উপাৰ্জন ৰাখে
          </p>

        </div>



        {/* ── Weekly Summary Card ────────────────────────────────────────── */}
        <button
          onClick={() => router.push('/summary')}
          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[#2A2A2E] p-4 border border-white/5 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <BarChart2 size={20} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">📊 এই সপ্তাহ</p>
              <p className="text-xl font-black text-amber-500 leading-tight mt-0.5">{data.weekRides} যাত্ৰা</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-white/20" />
        </button>

        {/* ── Subscription bar ────────────────────────────────────────────── */}
        <div className="mt-4">
          <SubBar sub={subscription} />
        </div>

        {/* ── Recent Rides ─────────────────────────────────────────────────── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/30">
              {tr.recent_rides}
            </p>
            <Clock size={14} className="text-white/20" />
          </div>

          
          <div className="flex flex-col gap-2">
            {recentRides.length > 0 ? (
              recentRides.map((ride) => (
                <div 
                  key={ride.id} 
                  className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-black text-white"
                      style={{ background: ZONE_COLORS[ride.zone.zone_number]?.hex ?? '#888' }}
                    >
                      {ride.zone.zone_number}
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{ride.passenger_phone}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{ride.duration_mins} mins</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ride.thumbs_up && <CheckCircle2 size={14} className="text-emerald-500" />}
                    <span className="text-[10px] font-bold text-gray-600">
                      {new Date(ride.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs font-bold text-white/10 border-2 border-dashed border-white/5 rounded-2xl">
                {tr.no_rides}
              </p>
            )}

          </div>
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
export default function PullerDashboardSuspense() {
  return (
    <Suspense fallback={<SkeletonDashboard />}>
      <PullerDashboardPage />
    </Suspense>
  )
}
