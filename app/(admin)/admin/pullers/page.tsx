'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Search, Check, X, RefreshCw, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZONE_COLORS } from '@/lib/constants'
import {
  fetchPullers, approvePuller, rejectPuller, suspendPuller, renewSubscription,
  type PullerRow,
} from './actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(isoStr: string | null): number | null {
  if (!isoStr) return null
  return Math.ceil((new Date(isoStr).getTime() - Date.now()) / 86_400_000)
}

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return '—'
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { msg: string; ok: boolean } | null

function Toast({ t, onDone }: { t: ToastState; onDone: () => void }) {
  useEffect(() => {
    if (!t) return
    const id = setTimeout(onDone, 3000)
    return () => clearTimeout(id)
  }, [t, onDone])
  return (
    <AnimatePresence>
      {t && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
          style={{
            background: t.ok ? '#064E3B' : '#7F1D1D',
            border: `1.5px solid ${t.ok ? '#10B981' : '#EF4444'}`,
            whiteSpace: 'nowrap',
          }}
        >
          {t.msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, hex }: { name: string; hex: string }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
      style={{ background: hex }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Stat mini cell ───────────────────────────────────────────────────────────

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl py-2"
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <span className="text-base font-black text-white">{value}</span>
      <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
    </div>
  )
}

// ─── Pending row ──────────────────────────────────────────────────────────────

function PendingRow({
  puller, onApprove, onReject, busy,
}: {
  puller: PullerRow
  onApprove: (id: string, zoneId: string) => void
  onReject:  (id: string) => void
  busy: boolean
}) {
  const zc = ZONE_COLORS[puller.zoneNumber]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}
    >
      <Avatar name={puller.name} hex={zc?.hex ?? '#888'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{puller.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: zc ? `${zc.hex}20` : 'rgba(255,255,255,0.07)', color: zc?.hex ?? 'rgba(255,255,255,0.5)' }}
          >
            {puller.zoneNameAs}
          </span>
          {puller.phone && (
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {puller.phone}
            </span>
          )}
        </div>
      </div>
      <button type="button" disabled={busy} onClick={() => onApprove(puller.id, puller.zoneId)}
        className="flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40"
        style={{ background: 'rgba(16,185,129,0.18)', border: '1.5px solid rgba(16,185,129,0.4)' }}>
        <Check size={16} color="#10B981" strokeWidth={2.5} />
      </button>
      <button type="button" disabled={busy} onClick={() => onReject(puller.id)}
        className="flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40"
        style={{ background: 'rgba(239,68,68,0.14)', border: '1.5px solid rgba(239,68,68,0.38)' }}>
        <X size={16} color="#EF4444" strokeWidth={2.5} />
      </button>
    </motion.div>
  )
}

// ─── Active row (expandable) ──────────────────────────────────────────────────

function ActiveRow({
  puller, onSuspend, onRenew, busy,
}: {
  puller:    PullerRow
  onSuspend: (id: string) => void
  onRenew:   (id: string) => void
  busy:      boolean
}) {
  const [open, setOpen] = useState(false)
  const zc   = ZONE_COLORS[puller.zoneNumber]
  const days = daysUntil(puller.subValidTill)
  // Red-tint when sub expires within 2 days OR no subscription
  const expiring = days === null || days < 2

  // Badge prefix + number from badgeCode (e.g. "PB-007" → prefix="PB", num="007")
  const dashIdx  = puller.badgeCode.indexOf('-')
  const badgePfx = dashIdx >= 0 ? puller.badgeCode.slice(0, dashIdx) : puller.badgeCode
  const badgeNum = dashIdx >= 0 ? puller.badgeCode.slice(dashIdx + 1) : ''

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* ── Collapsed row ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: expiring ? 'rgba(239,68,68,0.07)' : 'transparent' }}
      >
        {/* Badge pill in zone color */}
        <div
          className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-xl"
          style={{
            background: zc ? `${zc.hex}18` : 'rgba(255,255,255,0.06)',
            border: `2px solid ${zc ? `${zc.hex}45` : 'rgba(255,255,255,0.15)'}`,
          }}
        >
          <span className="text-[8px] font-black leading-none" style={{ color: zc?.hex ?? '#aaa' }}>
            {badgePfx}
          </span>
          <span className="text-[15px] font-black leading-tight tabular-nums" style={{ color: zc?.hex ?? '#aaa' }}>
            {badgeNum}
          </span>
        </div>

        {/* Name + zone */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{puller.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {puller.zoneNameAs}
          </p>
        </div>

        {/* Online dot */}
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: puller.isOnline ? '#10B981' : 'rgba(255,255,255,0.18)',
            boxShadow:  puller.isOnline ? '0 0 7px #10B981' : 'none',
          }}
        />

        {/* Days until expiry */}
        <div className="w-12 shrink-0 text-right">
          {days === null ? (
            <span className="text-[11px] font-black" style={{ color: '#EF4444' }}>No sub</span>
          ) : (
            <span
              className="text-[11px] font-black tabular-nums"
              style={{ color: days < 2 ? '#EF4444' : days < 7 ? '#F59E0B' : 'rgba(255,255,255,0.4)' }}
            >
              {days}d
            </span>
          )}
        </div>

        {/* Chevron */}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={14} color="rgba(255,255,255,0.28)" />
        </motion.div>
      </button>

      {/* ── Expanded panel ─────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-2"
              style={{ background: expiring ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)' }}
            >
              {/* Stats */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                <StatMini label="Rides" value={puller.totalRides} />
                <StatMini label="👍" value={puller.thumbsUp} />
                <StatMini label="Last seen" value={timeAgo(puller.lastActiveAt)} />
              </div>

              {/* Coordinates */}
              {puller.lat !== null && puller.lng !== null ? (
                <p className="mb-3 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  📍 {puller.lat.toFixed(5)}, {puller.lng.toFixed(5)}
                </p>
              ) : (
                <p className="mb-3 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  📍 No GPS data
                </p>
              )}

              {/* Sub expiry detail */}
              <p className="mb-3 text-[11px] font-semibold" style={{ color: expiring ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>
                🗓 Sub expires:{' '}
                {puller.subValidTill
                  ? new Date(puller.subValidTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                  : 'No subscription'}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSuspend(puller.id)}
                  className="flex-1 rounded-xl py-2.5 text-xs font-black disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.14)', border: '1.5px solid rgba(239,68,68,0.38)', color: '#EF4444' }}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRenew(puller.id)}
                  className="flex-1 rounded-xl py-2.5 text-xs font-black disabled:opacity-40"
                  style={{ background: 'rgba(16,185,129,0.14)', border: '1.5px solid rgba(16,185,129,0.38)', color: '#10B981' }}
                >
                  Renew +30d
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPullersPage() {
  const [all,        setAll]        = useState<PullerRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [query,      setQuery]      = useState('')
  const [toast,      setToast]      = useState<ToastState>(null)
  const [isPending,  startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try { setAll(await fetchPullers()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const q     = query.toLowerCase()
  const match = (p: PullerRow) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.badgeCode.toLowerCase().includes(q) ||
    p.zoneNameAs.toLowerCase().includes(q)

  const pending = all.filter((p) => p.status === 'pending'   && match(p))
  const active  = all.filter((p) => p.status === 'active'    && match(p))

  const pendingCount = all.filter((p) => p.status === 'pending').length

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleApprove(id: string, zoneId: string) {
    startTransition(async () => {
      try {
        await approvePuller(id, zoneId)
        setToast({ msg: 'Puller approved & badge assigned', ok: true })
        setTimeout(load, 400)
      } catch (e: any) {
        setToast({ msg: e.message ?? 'Approve failed', ok: false })
      }
    })
  }

  function handleReject(id: string) {
    startTransition(async () => {
      try {
        await rejectPuller(id)
        setAll((prev) => prev.filter((p) => p.id !== id))
        setToast({ msg: 'Puller removed', ok: false })
      } catch (e: any) {
        setToast({ msg: e.message ?? 'Reject failed', ok: false })
      }
    })
  }

  function handleSuspend(id: string) {
    startTransition(async () => {
      try {
        await suspendPuller(id)
        setAll((prev) => prev.map((p) => p.id === id ? { ...p, status: 'suspended' as const, isOnline: false } : p))
        setToast({ msg: 'Puller suspended', ok: false })
      } catch (e: any) {
        setToast({ msg: e.message ?? 'Suspend failed', ok: false })
      }
    })
  }

  function handleRenew(id: string) {
    startTransition(async () => {
      try {
        await renewSubscription(id)
        setToast({ msg: 'Subscription renewed +30 days', ok: true })
        setTimeout(load, 400)
      } catch (e: any) {
        setToast({ msg: e.message ?? 'Renew failed', ok: false })
      }
    })
  }

  // ── Topbar ───────────────────────────────────────────────────────────────────

  const topbar = (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ background: '#1A1A1E', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="text-xl font-black tracking-tight text-white">Pullers</span>
      <div className="flex items-center gap-2">
        {pendingCount > 0 && (
          <div
            className="rounded-full px-2.5 py-0.5 text-xs font-black"
            style={{ background: 'rgba(245,158,11,0.18)', border: '1.5px solid rgba(245,158,11,0.45)', color: '#F59E0B' }}
          >
            {pendingCount} pending
          </div>
        )}
        <button
          type="button"
          onClick={load}
          disabled={loading || isPending}
          className="flex h-8 w-8 items-center justify-center rounded-xl disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <RefreshCw size={14} color="rgba(255,255,255,0.6)" className={loading || isPending ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#111113' }}>
        {topbar}
        <div className="mx-auto max-w-lg space-y-3 px-4 pt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#111113' }}>
      {topbar}

      <div className="mx-auto max-w-lg px-4 pb-14 pt-5">

        {/* Search */}
        <div
          className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.08)' }}
        >
          <Search size={16} color="rgba(255,255,255,0.35)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, badge or zone…"
            className="flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}>
              <X size={14} color="rgba(255,255,255,0.4)" />
            </button>
          )}
        </div>

        {/* ── Pending ─────────────────────────────────────────────────────── */}
        {(pending.length > 0 || (!q && pendingCount > 0)) && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F59E0B' }}>
                Pending Approval
              </p>
              <div className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }}>
                {pending.length}
              </div>
            </div>
            <div className="rounded-3xl p-3 space-y-2" style={{ background: 'rgba(245,158,11,0.05)', border: '1.5px solid rgba(245,158,11,0.15)' }}>
              <AnimatePresence initial={false}>
                {pending.length === 0 ? (
                  <p className="py-4 text-center text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No results for &ldquo;{query}&rdquo;
                  </p>
                ) : pending.map((p) => (
                  <PendingRow key={p.id} puller={p} onApprove={handleApprove} onReject={handleReject} busy={isPending} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {pendingCount === 0 && !q && (
          <div className="mb-6 rounded-2xl px-4 py-4 text-center" style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.2)' }}>
            <p className="text-sm font-semibold" style={{ color: '#10B981' }}>No pending applications</p>
          </div>
        )}

        {/* ── Active pullers ───────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Active Pullers
            </p>
            <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>{active.length}</span>
            {/* Legend */}
            <div className="ml-auto flex items-center gap-3 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-400" />online
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />offline
              </span>
              <span className="flex items-center gap-1" style={{ color: '#EF4444' }}>
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />expiring
              </span>
            </div>
          </div>

          {active.length === 0 ? (
            <p className="py-6 text-center text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {q ? `No active pullers match "${query}"` : 'No active pullers yet'}
            </p>
          ) : (
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}
            >
              {active.map((p) => (
                <ActiveRow key={p.id} puller={p} onSuspend={handleSuspend} onRenew={handleRenew} busy={isPending} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Toast t={toast} onDone={() => setToast(null)} />
    </div>
  )
}
