'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Flame, TrendingUp, TrendingDown, Award, Calendar, BarChart2, Home, Clock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BackButton from '@/components/BackButton'
// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ active }: { active: 'home' | 'history' | 'summary' | 'profile' }) {
  const router = useRouter()
  const tabs = [
    { key: 'home',    icon: Home,      label: 'Home',    href: '/dashboard' },
    { key: 'history', icon: Clock,     label: 'History', href: '/history'   },
    { key: 'summary', icon: BarChart2, label: 'Summary', href: '/summary'   },
    { key: 'profile', icon: User,      label: 'Profile', href: '/profile'   },
  ] as const

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t px-2 pb-safe pt-2 z-50"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WeeklySummaryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    thisWeekRides: { completed_at: string; thumbs_up: boolean }[]
    lastWeekRides: { id: string }[]
    allRides: { completed_at: string }[]
    sub: { valid_till: string } | null
  } | null>(null)
  
  const sbRef = useRef(createClient())

  useEffect(() => {
    async function fetchStats() {
      const sb = sbRef.current
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: puller } = await sb.from('pullers').select('id').eq('user_id', user.id).single()
      if (!puller) return

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const lastWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

      const [thisWeekRides, lastWeekRides, allRides, sub] = await Promise.all([
        sb.from('ride_requests').select('id,completed_at,thumbs_up').eq('accepted_by', puller.id).eq('status','completed').gte('completed_at', weekAgo),
        sb.from('ride_requests').select('id').eq('accepted_by', puller.id).eq('status','completed').gte('completed_at', lastWeekStart).lt('completed_at', weekAgo),
        sb.from('ride_requests').select('completed_at').eq('accepted_by', puller.id).eq('status','completed').order('completed_at', {ascending:false}),
        sb.from('subscriptions').select('valid_till').eq('puller_id', puller.id).eq('status','active').maybeSingle()
      ])

      setData({
        thisWeekRides: thisWeekRides.data || [],
        lastWeekRides: lastWeekRides.data || [],
        allRides: allRides.data || [],
        sub: sub.data
      })
      setLoading(false)
    }

    fetchStats()
  }, [router])

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1A1A1E]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  // ── Logic ──────────────────────────────────────────────────────────

  // Streak logic
  const uniqueDays = new Set(data.allRides.map(r => new Date(r.completed_at).toISOString().split('T')[0]))
  let streak = 0
  const sortedDays = Array.from(uniqueDays).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  
  if (sortedDays.length > 0) {
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    
    // Check if streak is still active (ride today or yesterday)
    if (sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr) {
      streak = 1
      for (let i = 0; i < sortedDays.length - 1; i++) {
        const d1 = new Date(sortedDays[i])
        const d2 = new Date(sortedDays[i+1])
        const diff = (d1.getTime() - d2.getTime()) / 86400000
        if (diff === 1) streak++
        else break
      }
    }
  }

  // Stats
  const thisWeekCount = data.thisWeekRides.length
  const lastWeekCount = data.lastWeekRides.length
  const diffCount = thisWeekCount - lastWeekCount
  const diffPct = lastWeekCount > 0 ? Math.round((diffCount / lastWeekCount) * 100) : thisWeekCount * 100

  const dayCounts: Record<string, number> = {}
  data.thisWeekRides.forEach(r => {
    const day = new Date(r.completed_at).toLocaleDateString('en-IN', { weekday: 'long' })
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })
  const bestDay = Object.keys(dayCounts).length > 0 
    ? Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]
    : 'N/A'

  const thumbsThisWeek = data.thisWeekRides.filter(r => r.thumbs_up).length
  const daysOnline = new Set(data.thisWeekRides.map(r => new Date(r.completed_at).toISOString().split('T')[0])).size
  const avgRides = (thisWeekCount / 7).toFixed(1)

  const weekStart = new Date(Date.now() - 6 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const weekEnd = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  // Subscription state
  const subDaysLeft = data.sub ? Math.ceil((new Date(data.sub.valid_till).getTime() - Date.now()) / 86400000) : 0

  return (
    <div className="min-h-screen bg-[#1A1A1E] pb-32">
      <div className="mx-auto max-w-[420px] px-6 pt-12">
        
        {/* Header */}
        <header className="flex items-center gap-4">
          <BackButton fallback="/dashboard" />
          <div>
            <h1 className="text-[28px] font-black text-white font-nunito">সাপ্তাহিক সাৰাংশ</h1>
            <p className="mt-1 text-sm font-bold text-white/40">{weekStart} — {weekEnd}</p>
          </div>
        </header>

        {/* Hero Stat */}
        <div className="mt-12 flex flex-col items-center text-center">
          <motion.span 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[90px] font-black text-amber-500 leading-none font-nunito"
          >
            {thisWeekCount}
          </motion.span>
          <span className="mt-2 text-sm font-bold text-white/40 uppercase tracking-widest">যাত্ৰা এই সপ্তাহত</span>
        </div>

        {/* Stats Grid */}
        <div className="mt-12 grid grid-cols-2 gap-3">
          <StatBox label="Best Day" value={bestDay} color="text-emerald-500" />
          <StatBox label="Likes 👍" value={thumbsThisWeek} color="text-amber-500" />
          <StatBox label="Days Online" value={`${daysOnline}/7`} color="text-blue-500" />
          <StatBox label="Avg Rides" value={avgRides} color="text-white" />
        </div>

        {/* Streak Card */}
        <div 
          className={`mt-6 rounded-2xl p-5 bg-[#2A2A2E] border-2 transition-all duration-500 ${
            streak > 30 ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' :
            streak > 14 ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' :
            streak > 7  ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
            'border-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${streak > 0 ? 'bg-orange-500/20 text-orange-500' : 'bg-white/5 text-white/20'}`}>
                <Flame size={24} fill={streak > 0 ? 'currentColor' : 'none'} />
              </div>
              <div>
                <p className="text-xl font-black text-white leading-tight">{streak} day streak</p>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Keep it up!</p>
              </div>
            </div>
            {streak > 30 && (
              <div className="bg-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                Legend
              </div>
            )}
          </div>
        </div>

        {/* Comparison Bar */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">vs last week</p>
            <div className={`flex items-center gap-1 text-xs font-black ${diffPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {diffPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {diffPct >= 0 ? '+' : ''}{diffPct}%
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold text-white/60">
                <span>This Week</span>
                <span>{thisWeekCount}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (thisWeekCount / Math.max(thisWeekCount, lastWeekCount, 1)) * 100)}%` }}
                  className="h-full bg-amber-500 rounded-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold text-white/30">
                <span>Last Week</span>
                <span>{lastWeekCount}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (lastWeekCount / Math.max(thisWeekCount, lastWeekCount, 1)) * 100)}%` }}
                  className="h-full bg-white/20 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Reminder */}
        <div className="mt-12">
          {subDaysLeft < 7 ? (
            <div className="rounded-2xl p-5 bg-amber-500/10 border-2 border-amber-500/30">
              <div className="flex items-center gap-3">
                <Calendar className="text-amber-500" size={24} />
                <div>
                  <p className="font-black text-white leading-tight">
                    {subDaysLeft <= 0 ? 'Subscription expired' : `Expires in ${subDaysLeft} days`}
                  </p>
                  <p className="mt-1 text-xs font-bold text-amber-500/60 uppercase">₹100 renew karo to keep earning</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 bg-emerald-500/10 border-2 border-emerald-500/30">
              <div className="flex items-center gap-3">
                <Award className="text-emerald-500" size={24} />
                <div>
                  <p className="font-black text-white leading-tight">Subscription active</p>
                  <p className="mt-1 text-xs font-bold text-emerald-500/60 uppercase">আপুনি সকলো উপাৰ্জন ৰাখে</p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <TabBar active="summary" />
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#2A2A2E] border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
      <span className={`text-lg font-black truncate ${color}`}>{value}</span>
      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{label}</span>
    </div>
  )
}
