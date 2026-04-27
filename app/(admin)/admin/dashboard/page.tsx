'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZONE_COLORS } from '@/lib/constants'
import LogoutButton from '@/components/LogoutButton'
import { fetchDashboardData, type DashboardData, type ZoneHealth } from './actions'

import type { AdminMapProps } from './AdminMap'

const AdminMap = dynamic<AdminMapProps>(
  () => import('./AdminMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#F4F4F5]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
      </div>
    ),
  }
)

const REFRESH_MS = 30_000

// ─── Metric card ──────────────────────────────────────────────────────────────

interface CardDef { label: string; sub: string; hex: string }

const CARDS: (CardDef & { key: keyof DashboardData['metrics'] })[] = [
  { key: 'activeRides',     label: 'Active Rides',   sub: 'accepted + active',     hex: '#1D4ED8' },
  { key: 'onlinePullers',   label: 'Online Pullers', sub: 'is_online = true',       hex: '#16A34A' },
  { key: 'openRequests',    label: 'Open Requests',  sub: 'status = requested',     hex: '#7C3AED' },
  { key: 'expiredLastHour', label: 'Expired (1h)',   sub: 'missed opportunities', hex: '#DC2626' },
]

function MetricCard({ def, value, spinning }: { def: CardDef; value: number; spinning: boolean }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-[20px] p-5 flex flex-col gap-1 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#64748B] font-body uppercase tracking-wider">{def.label}</span>
        {spinning && <RefreshCw size={12} className="text-[#94A3B8] animate-spin" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[36px] font-black font-display leading-none" style={{ color: def.hex }}>
          {value}
        </span>
      </div>
      <p className="text-[10px] font-medium text-[#94A3B8] font-body mt-1">{def.sub}</p>
    </div>
  )
}

// ─── Zone health bars ─────────────────────────────────────────────────────────

function ZoneHealthBars({ zones }: { zones: ZoneHealth[] }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-[20px] overflow-hidden shadow-sm">
      {zones.map((z, i) => {
        const color = ZONE_COLORS[z.zoneNumber] || { hex: '#1D4ED8' }
        const pct = z.total > 0 ? (z.online / z.total) * 100 : 0
        return (
          <div key={z.zoneId} className={`flex items-center gap-4 px-5 py-4 ${i < zones.length - 1 ? 'border-b border-[#F4F4F5]' : ''}`}>
            <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-[14px] font-black" style={{ background: color.hex }}>
              {z.zoneNumber}
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[#0F172A] font-display uppercase">{z.nameAs}</span>
                <span className="text-[12px] font-bold text-[#64748B] tabular-nums">{z.online}/{z.total}</span>
              </div>
              <div className="h-1.5 w-full bg-[#F4F4F5] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full" 
                  style={{ background: color.hex }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdminDashboardPage() {
  const [data,       setData]       = useState<DashboardData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const d = await fetchDashboardData()
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(true), REFRESH_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  if (loading || !data) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  return (
    <main className="min-h-screen bg-[#FAFAFA] pb-20">
      {/* Top Header */}
      <div className="bg-white border-b border-[#E4E4E7] px-5 pt-12 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[12px] bg-[#EFF6FF] flex items-center justify-center text-[#1D4ED8]">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] font-display uppercase tracking-tight">Command Center</h1>
            <p className="text-[11px] font-medium text-[#64748B] font-body uppercase">Admin Dashboard</p>
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="p-5 space-y-6">
        {/* Alerts */}
        <AnimatePresence>
          {data.staleRequests.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#FEE2E2] border border-[#DC2626] rounded-[20px] p-4 flex items-start gap-4"
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-[#DC2626] flex items-center justify-center text-white">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#DC2626] font-body uppercase">Stale Requests Detected</p>
                <p className="text-[12px] font-medium text-[#DC2626]/80 font-body">
                  {data.staleRequests.length} requests haven&apos;t been picked up in over 3 minutes.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Map */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-wider">Fleet Coverage</span>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-[#16A34A]"/><span className="text-[10px] font-bold text-[#64748B] uppercase">Pullers</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-[#1D4ED8]"/><span className="text-[10px] font-bold text-[#64748B] uppercase">Passengers</span></div>
            </div>
          </div>
          <div className="h-[240px] rounded-[24px] border border-[#E4E4E7] overflow-hidden shadow-lg relative z-0">
            <AdminMap pullers={data.pullers} passengers={data.passengers} />
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {CARDS.map(c => <MetricCard key={c.key} def={c} value={data.metrics[c.key]} spinning={refreshing} />)}
        </div>

        {/* Zone Health */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-wider">Zone Saturation</span>
          <ZoneHealthBars zones={data.zoneHealth} />
        </div>
      </div>
    </main>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#FAFAFA]" />}>
      <AdminDashboardPage />
    </Suspense>
  )
}
