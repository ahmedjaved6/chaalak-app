'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Clock, User, AlertCircle, CheckCircle2, BarChart2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { HEARTBEAT_INTERVAL_MS, ZONE_COLORS } from '@/lib/constants'
import type { Zone, Puller, Subscription } from '@/lib/types'
import LogoutButton from '@/components/LogoutButton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  puller:       Puller
  user:         { name: string }
  zone:         Zone | null
  subscription: Subscription | null
  todayRides:   number
  monthRides:   number
  zoneRank:     number
  totalRequests: number
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSubState(sub: Subscription | null): {
  color: string; bg: string; border: string; label: string; daysLeft: number
} {
  if (!sub) return { color: '#64748B', bg: '#F4F4F5', border: '#E4E4E7', label: 'No subscription', daysLeft: 0 }
  const now      = Date.now()
  const till     = new Date(sub.valid_till).getTime()
  const daysLeft = Math.ceil((till - now) / 86_400_000)

  if (daysLeft < 0 || sub.status === 'expired')
    return { color: '#DC2626', bg: '#FEE2E2', border: '#DC2626', label: `Subscription Expired`, daysLeft }
  if (daysLeft <= 7)
    return { color: '#D97706', bg: '#FEF3C7', border: '#D97706', label: `Expiring in ${daysLeft} days`, daysLeft }
  return { color: '#16A34A', bg: '#DCFCE7', border: '#16A34A', label: `Subscription Active`, daysLeft }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color = '#0F172A' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-4 flex flex-col items-start gap-1">
      <span className="text-[28px] font-bold font-display leading-none" style={{ color }}>{value}</span>
      <span className="text-[11px] font-semibold text-[#64748B] font-body uppercase tracking-wider">{label}</span>
    </div>
  )
}

function RecentRideRow({ ride }: { ride: RecentRidePuller }) {
  const zc = ZONE_COLORS[ride.zone.zone_number] || { hex: '#1D4ED8' }
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-[12px] p-3 flex items-center gap-3">
      <div 
        className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-[14px] font-black text-white"
        style={{ background: zc.hex }}
      >
        {ride.zone.zone_number}
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-[#0F172A] font-body">{ride.passenger_phone}</p>
        <p className="text-[11px] font-medium text-[#94A3B8] font-body uppercase">{new Date(ride.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      {ride.thumbs_up && (
        <div className="bg-[#DCFCE7] rounded-full px-2 py-0.5 text-[10px]">👍</div>
      )}
    </div>
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
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-[#E4E4E7] flex items-center justify-around px-4 pb-safe z-50">
      {tabs.map(({ key, icon: Icon, label, href }) => {
        const isActive = key === active
        return (
          <button
            key={key}
            onClick={() => router.push(href)}
            className="flex flex-col items-center gap-1 py-1"
          >
            <Icon size={22} className={isActive ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-[10px] font-semibold font-body ${isActive ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PullerDashboardPage() {
  const router = useRouter()
  const sbRef = useRef(createClient())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pullerIdRef = useRef<string>('')

  const [data, setData]       = useState<DashboardData | null>(null)
  const [online, setOnline]   = useState(false)
  const [toggling, setToggling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState<{ msg: string; type: ToastType } | null>(null)
  const [recentRides, setRecentRides] = useState<RecentRidePuller[]>([])

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

  // Data Loading
  useEffect(() => {
    const supabase = sbRef.current
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: puller } = await supabase.from('pullers').select('*').eq('user_id', user.id).maybeSingle()
      if (!puller) { router.replace('/onboarding'); return }
      pullerIdRef.current = puller.id
      setOnline(puller.is_online ?? false)

      const [userRes, zoneRes, subRes, statsRes, weekRes] = await Promise.all([
        supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
        supabase.from('zones').select('*').eq('id', puller.zone_id).maybeSingle(),
        supabase.from('subscriptions').select('*').eq('puller_id', puller.id).eq('status', 'active').gte('valid_till', new Date().toISOString()).maybeSingle(),
        supabase.from('ride_requests').select('status, created_at, thumbs_up').eq('accepted_by', puller.id).gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('ride_requests').select('id', { count: 'exact', head: true }).eq('accepted_by', puller.id).eq('status', 'completed').gte('completed_at', new Date(Date.now() - 7*24*60*60*1000).toISOString()),
      ])

      const today = statsRes.data || []
      const monthCount = 15 // Mocked for design
      
      setData({
        puller: puller as Puller,
        user: { name: userRes.data?.name || 'Puller' },
        zone: zoneRes.data as Zone | null,
        subscription: subRes.data as Subscription | null,
        todayRides: today.length,
        monthRides: monthCount,
        zoneRank: 1,
        totalRequests: 20,
        weekRides: weekRes.count || 0
      })

      // Fetch Recent
      const { data: rides } = await supabase
        .from('ride_requests')
        .select('id, completed_at, thumbs_up, zones(name_as, zone_number), passengers(users(phone))')
        .eq('accepted_by', puller.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3)
      
      if (rides) {
        setRecentRides(rides.map(r => ({
          id: r.id,
          completed_at: r.completed_at!,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          passenger_phone: (r.passengers as any)?.users?.phone || '**********',
          zone: r.zones as unknown as { name_as: string, zone_number: number },
          thumbs_up: !!r.thumbs_up,
          duration_mins: 10
        })))
      }

      setLoading(false)
    }
    load()
  }, [router])

  // Toggle Handlers
  async function handleToggle() {
    if (toggling || !pullerIdRef.current) return
    setToggling(true)
    const sb = sbRef.current

    if (!online) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        await sb.from('pullers').update({ is_online: true, lat, lng, last_active_at: new Date().toISOString() }).eq('id', pullerIdRef.current)
        setOnline(true)
        setToggling(false)
        intervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(p => {
            sb.rpc('puller_heartbeat', { puller_id: pullerIdRef.current, lat: p.coords.latitude, lng: p.coords.longitude })
          })
        }, HEARTBEAT_INTERVAL_MS)
      }, () => {
        setToggling(false)
        setToast({ msg: 'GPS Required', type: 'error' })
      })
    } else {
      goOffline()
      setToggling(false)
    }
  }

  if (loading || !data) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  const zc = data.zone ? ZONE_COLORS[data.zone.zone_number] : { hex: '#1D4ED8' }
  const ss = getSubState(data.subscription)

  return (
    <main className="min-h-screen bg-[#FAFAFA] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-[#E4E4E7] px-5 pt-12 pb-6 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium text-[#64748B] font-body uppercase">নমস্কাৰ</p>
          <h1 className="text-[26px] font-bold text-[#0F172A] font-display uppercase tracking-tight leading-none mt-1">
            {data.user.name}
          </h1>
          <p className="text-[12px] font-medium text-[#64748B] font-body mt-1">
            Zone: {data.zone?.name_as}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div 
            className="rounded-[10px] px-3 py-2 border-[1.5px] flex flex-col items-center"
            style={{ borderColor: zc.hex, background: `${zc.hex}10` }}
          >
            <span className="text-[20px] font-black font-display leading-none" style={{ color: zc.hex }}>
              {data.puller.badge_number}
            </span>
            <span className="text-[9px] font-bold uppercase" style={{ color: `${zc.hex}B0` }}>
              {data.puller.badge_code}
            </span>
          </div>
          <LogoutButton />
        </div>
      </div>

      <div className="px-5 mt-6">
        {/* ONLINE TOGGLE */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`w-full h-16 rounded-[14px] flex items-center px-5 transition-all duration-300 relative overflow-hidden ${
            online ? 'bg-[#1D4ED8] shadow-lg shadow-blue-500/30' : 'bg-[#F4F4F5] border-[1.5px] border-[#E4E4E7]'
          }`}
        >
          <div className={`h-2.5 w-2.5 rounded-full mr-4 ${online ? 'bg-white opacity-60' : 'bg-[#D1D5DB]'}`} />
          <div className="flex-1 text-left">
            <span className={`text-[22px] font-bold font-display uppercase leading-none block ${online ? 'text-white' : 'text-[#64748B]'}`}>
              {toggling ? '...' : online ? 'ONLINE' : 'OFFLINE'}
            </span>
            {online && (
              <span className="text-[11px] font-medium text-white/70 font-body uppercase tracking-tight">
                Accepting rides · GPS active
              </span>
            )}
          </div>
          {online && <div className="h-2 w-2 rounded-full bg-white animate-ping" />}
        </button>

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatCard label="Today Rides" value={data.todayRides} color="#1D4ED8" />
          <StatCard label="Total Likes" value={data.puller.thumbs_up} color="#16A34A" />
          <StatCard label="This Month" value={data.monthRides} />
          <StatCard label="Acceptance" value="92%" />
        </div>

        {/* Subscription Bar */}
        <div 
          className="mt-4 rounded-[14px] px-4 py-3 border-[1.5px] flex items-center justify-between"
          style={{ borderColor: ss.border, background: ss.bg }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} style={{ color: ss.color }} />
            <span className="text-[13px] font-bold font-body" style={{ color: ss.color }}>{ss.label}</span>
          </div>
          <span className="text-[20px] font-bold font-display" style={{ color: ss.color }}>
            {ss.daysLeft}d
          </span>
        </div>

        {/* Recent Section */}
        <div className="mt-8">
          <p className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-wider mb-3">
            Recent Rides
          </p>
          <div className="space-y-2">
            {recentRides.map(r => <RecentRideRow key={r.id} ride={r} />)}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-5 right-5 bg-[#0F172A] text-white px-5 py-3 rounded-[12px] flex items-center gap-3 shadow-xl z-50"
          >
            <AlertCircle size={18} className="text-[#DC2626]" />
            <span className="text-[13px] font-semibold">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <TabBar active="home" />
    </main>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#FAFAFA]" />}>
      <PullerDashboardPage />
    </Suspense>
  )
}
