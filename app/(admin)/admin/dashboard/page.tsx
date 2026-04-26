'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZONE_COLORS } from '@/lib/constants'
import { fetchDashboardData, type DashboardData, type ZoneHealth, type StaleRequest } from './actions'
import type { AdminMapProps } from './AdminMap'

const AdminMap = dynamic<AdminMapProps>(
  () => import('./AdminMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center" style={{ background: '#0f1117' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    ),
  }
)

const REFRESH_MS = 30_000

// ─── Metric card ──────────────────────────────────────────────────────────────

interface CardDef { label: string; sub: string; hex: string }

const CARDS: (CardDef & { key: keyof DashboardData['metrics'] })[] = [
  { key: 'activeRides',     label: 'Active Rides',   sub: 'accepted + active',     hex: '#F59E0B' },
  { key: 'onlinePullers',   label: 'Online Pullers', sub: 'is_online = true',       hex: '#10B981' },
  { key: 'openRequests',    label: 'Open Requests',  sub: 'status = requested',     hex: '#3B82F6' },
  { key: 'expiredLastHour', label: 'Expired (1 h)',  sub: 'expired in last 60 min', hex: '#EF4444' },
]

function MetricCard({ def, value, spinning }: { def: CardDef; value: number; spinning: boolean }) {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl p-5"
      style={{ background: `${def.hex}12`, border: `1.5px solid ${def.hex}38` }}
    >
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: def.hex, boxShadow: `0 0 8px ${def.hex}80` }} />
        {spinning && <RefreshCw size={12} style={{ color: def.hex, opacity: 0.55 }} className="animate-spin" />}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18 }}
          className="mt-4 font-black leading-none tabular-nums"
          style={{ fontSize: 46, color: def.hex, letterSpacing: '-0.03em' }}
        >
          {value}
        </motion.p>
      </AnimatePresence>
      <div className="mt-3">
        <p className="text-sm font-black text-white">{def.label}</p>
        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>{def.sub}</p>
      </div>
    </div>
  )
}

// ─── Zone health bars ─────────────────────────────────────────────────────────

function ZoneHealthBars({ zones }: { zones: ZoneHealth[] }) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}
    >
      {zones.map((z, i) => {
        const color   = ZONE_COLORS[z.zoneNumber]
        const pct     = z.total > 0 ? Math.min((z.online / z.total) * 100, 100) : 0
        const isLow   = z.online < 5
        const barHex  = isLow ? '#EF4444' : (color?.hex ?? '#888888')

        return (
          <div
            key={z.zoneId}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < zones.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            {/* Zone number badge */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
              style={{ background: color?.hex ?? '#888888' }}
            >
              {z.zoneNumber}
            </div>

            {/* Zone name */}
            <span className="w-[88px] shrink-0 truncate text-xs font-bold text-white">
              {z.nameAs}
            </span>

            {/* Proportional fill bar */}
            <div
              className="flex-1 overflow-hidden rounded-full"
              style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: barHex }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>

            {/* Count right-aligned */}
            <span
              className="w-12 shrink-0 text-right text-xs font-black tabular-nums"
              style={{ color: barHex }}
            >
              {z.online}/{z.total}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stale-request alert card ─────────────────────────────────────────────────

function StaleAlert({ requests }: { requests: StaleRequest[] }) {
  if (!requests.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl p-4"
      style={{ background: 'rgba(239,68,68,0.10)', border: '1.5px solid rgba(239,68,68,0.45)' }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={15} style={{ color: '#EF4444' }} />
        <span className="text-sm font-black" style={{ color: '#EF4444' }}>
          Stale Requests
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-black"
          style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}
        >
          {requests.length}
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1.5">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl px-3 py-2"
            style={{ background: 'rgba(239,68,68,0.08)' }}
          >
            <span className="text-xs font-bold text-white">{r.zoneName}</span>
            <span className="font-mono text-xs font-black tabular-nums" style={{ color: '#EF4444' }}>
              {r.ageSeconds}s
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [data,       setData]       = useState<DashboardData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setData(await fetchDashboardData())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
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

  // ── Topbar (always rendered) ──────────────────────────────────────────────────

  const topbar = (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ background: '#1A1A1E', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="text-xl font-black tracking-tight text-white">Chaalak</span>
      <div className="flex items-center gap-3">
        {data?.fetchedAt && (
          <span className="hidden text-[11px] font-semibold sm:block" style={{ color: 'rgba(255,255,255,0.32)' }}>
            {new Date(data.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <div
          className="rounded-full px-3 py-1 text-[11px] font-black tracking-widest"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.45)', color: '#F59E0B' }}
        >
          ADMIN
        </div>
      </div>
    </div>
  )

  // ── States ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen" style={{ backgroundColor: '#111113' }}>
      {topbar}
      <div className="mx-auto max-w-lg px-4 pt-8">
        <div className="mb-4 h-[200px] animate-pulse rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((c) => (
            <div key={c.key} className="animate-pulse rounded-2xl" style={{ background: `${c.hex}08`, minHeight: 148 }} />
          ))}
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen" style={{ backgroundColor: '#111113' }}>
      {topbar}
      <div className="flex flex-col items-center pt-24 text-center">
        <p className="text-sm font-bold" style={{ color: '#EF4444' }}>{error}</p>
        <button type="button" onClick={() => load()} className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: 'rgba(255,255,255,0.08)' }}>
          Retry
        </button>
      </div>
    </div>
  )

  // ── Main ──────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#111113' }}
    >
      {topbar}

      <div className="mx-auto max-w-lg px-4 pt-6 pb-14">

        {/* ── Stale request alert (top priority) ──────────────────────────── */}
        <AnimatePresence>
          {data!.staleRequests.length > 0 && (
            <div className="mb-5">
              <StaleAlert requests={data!.staleRequests} />
            </div>
          )}
        </AnimatePresence>

        {/* ── Live map ─────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Live Map
            </p>
            <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />
                Pullers
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#3B82F6' }} />
                Passengers
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl" style={{ height: 200, border: '1.5px solid rgba(255,255,255,0.08)' }}>
            <AdminMap pullers={data!.pullers} passengers={data!.passengers} />
          </div>
        </div>

        {/* ── Zone health bars ─────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Zone Health
          </p>
          <ZoneHealthBars zones={data!.zoneHealth} />
        </div>

        {/* ── Metrics 2×2 grid ─────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Live Metrics
          </p>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((card) => (
            <MetricCard
              key={card.key}
              def={card}
              value={data!.metrics[card.key]}
              spinning={refreshing}
            />
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Auto-refreshes every 30 s
        </p>
      </div>
    </div>
  )
}
