'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Search, Check, X, RefreshCw, ChevronDown, User, AlertCircle, Phone } from 'lucide-react'
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
  if (s < 60)    return `${s}s`
  if (s < 3600)  return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PendingCard({ puller, onApprove, onReject, busy }: { puller: PullerRow, onApprove: (id: string, zid: string) => void, onReject: (id: string) => void, busy: boolean }) {
  const zc = ZONE_COLORS[puller.zoneNumber] || { hex: '#1D4ED8' }
  return (
    <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-[16px] p-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: zc.hex }}>
        {puller.name.charAt(0)}
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-bold text-[#0F172A] font-body">{puller.name}</p>
        <p className="text-[11px] font-bold text-[#D97706] font-body uppercase">{puller.zoneNameAs}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onApprove(puller.id, puller.zoneId)} disabled={busy} className="h-9 w-9 rounded-full bg-white border border-[#16A34A] flex items-center justify-center text-[#16A34A] active:scale-90 transition-transform shadow-sm">
          <Check size={18} strokeWidth={3} />
        </button>
        <button onClick={() => onReject(puller.id)} disabled={busy} className="h-9 w-9 rounded-full bg-white border border-[#DC2626] flex items-center justify-center text-[#DC2626] active:scale-90 transition-transform shadow-sm">
          <X size={18} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

function PullerRow({ puller, onSuspend, onRenew, busy }: { puller: PullerRow, onSuspend: (id: string) => void, onRenew: (id: string) => void, busy: boolean }) {
  const [open, setOpen] = useState(false)
  const zc = ZONE_COLORS[puller.zoneNumber] || { hex: '#1D4ED8' }
  const days = daysUntil(puller.subValidTill)
  const isExpiring = days !== null && days < 3

  return (
    <div className="bg-white border-b border-[#F4F4F5] last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <div className="h-10 w-10 rounded-[10px] flex flex-col items-center justify-center border" style={{ borderColor: zc.hex, background: `${zc.hex}10` }}>
          <span className="text-[8px] font-bold" style={{ color: zc.hex }}>{puller.badgeCode.split('-')[0]}</span>
          <span className="text-[16px] font-black leading-none" style={{ color: zc.hex }}>{puller.badgeCode.split('-')[1]}</span>
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold text-[#0F172A] font-body">{puller.name}</p>
          <p className="text-[11px] font-medium text-[#64748B] font-body uppercase">{puller.zoneNameAs}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`text-[12px] font-bold tabular-nums ${isExpiring ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
              {days ?? 0}d
            </p>
            <p className="text-[9px] font-medium text-[#94A3B8] font-body uppercase">Valid</p>
          </div>
          <div className={`h-2 w-2 rounded-full ${puller.isOnline ? 'bg-[#16A34A] shadow-[0_0_8px_#16A34A]' : 'bg-[#E4E4E7]'}`} />
          <motion.div animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={14} className="text-[#94A3B8]" /></motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-[#FAFAFA] border-t border-[#F4F4F5]">
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded-[12px] border border-[#E4E4E7]">
                  <p className="text-[16px] font-black text-[#0F172A]">{puller.totalRides}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Rides</p>
                </div>
                <div className="bg-white p-3 rounded-[12px] border border-[#E4E4E7]">
                  <p className="text-[16px] font-black text-[#0F172A]">{puller.thumbsUp}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Likes</p>
                </div>
                <div className="bg-white p-3 rounded-[12px] border border-[#E4E4E7]">
                  <p className="text-[16px] font-black text-[#0F172A]">{timeAgo(puller.lastActiveAt)}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Seen</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-[12px] font-medium text-[#64748B]">
                <Phone size={14} /> <span>{puller.phone || 'No phone'}</span>
              </div>

              <div className="flex gap-2">
                <button onClick={() => onRenew(puller.id)} disabled={busy} className="flex-1 h-10 rounded-[10px] bg-[#1D4ED8] text-white text-[12px] font-bold uppercase active:scale-[0.98] transition-transform">
                  Renew +30d
                </button>
                <button onClick={() => onSuspend(puller.id)} disabled={busy} className="flex-1 h-10 rounded-[10px] bg-white border border-[#DC2626] text-[#DC2626] text-[12px] font-bold uppercase active:scale-[0.98] transition-transform">
                  Suspend
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPullersPage() {
  const [all,        setAll]        = useState<PullerRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [query,      setQuery]      = useState('')
  const [toast,      setToast]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try { setAll(await fetchPullers()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const q = query.toLowerCase()
  const filtered = all.filter(p => !q || p.name.toLowerCase().includes(q) || p.badgeCode.toLowerCase().includes(q))
  const pending = filtered.filter(p => p.status === 'pending')
  const active = filtered.filter(p => p.status === 'active')

  const handleAction = (fn: () => Promise<unknown>, msg: string) => {
    startTransition(async () => {
      try {
        await fn()
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
        load()
      } catch (e: unknown) {
        setToast(e instanceof Error ? e.message : 'Action failed')
      }
    })
  }

  if (loading) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  return (
    <main className="min-h-screen bg-[#FAFAFA] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#E4E4E7] px-5 pt-12 pb-5 flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-[#0F172A] font-display uppercase tracking-tight">Pullers</h1>
        <button onClick={load} className="h-9 w-9 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#64748B]">
          <RefreshCw size={18} className={isPending ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Search */}
        <div className="bg-white border border-[#E4E4E7] rounded-[14px] px-4 py-3 flex items-center gap-3 focus-within:border-[#1D4ED8] transition-colors">
          <Search size={18} className="text-[#94A3B8]" />
          <input 
            type="text" 
            placeholder="Search pullers..." 
            className="flex-1 bg-transparent text-[14px] font-medium outline-none"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Pending Section */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#D97706] font-body uppercase tracking-wider">Pending Approval</span>
              <span className="h-4 w-4 bg-[#D97706] text-white rounded-full flex items-center justify-center text-[9px] font-bold">{pending.length}</span>
            </div>
            {pending.map(p => (
              <PendingCard 
                key={p.id} 
                puller={p} 
                onApprove={(id: string, zid: string) => handleAction(() => approvePuller(id, zid), 'Approved')}
                onReject={(id: string) => handleAction(() => rejectPuller(id), 'Rejected')}
                busy={isPending}
              />
            ))}
          </div>
        )}

        {/* List Section */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-wider">Registry</span>
          <div className="bg-white border border-[#E4E4E7] rounded-[20px] overflow-hidden shadow-sm">
            {active.map(p => (
              <PullerRow 
                key={p.id} 
                puller={p} 
                onRenew={(id: string) => handleAction(() => renewSubscription(id), 'Renewed')}
                onSuspend={(id: string) => handleAction(() => suspendPuller(id), 'Suspended')}
                busy={isPending}
              />
            ))}
            {active.length === 0 && (
              <div className="p-8 text-center">
                <User size={32} className="mx-auto text-[#E4E4E7] mb-2" />
                <p className="text-[13px] font-medium text-[#94A3B8]">No pullers found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="fixed bottom-10 left-5 right-5 bg-[#0F172A] text-white px-5 py-3 rounded-[12px] flex items-center gap-3 shadow-xl z-50">
            <AlertCircle size={18} className="text-[#1D4ED8]" />
            <span className="text-[13px] font-semibold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
