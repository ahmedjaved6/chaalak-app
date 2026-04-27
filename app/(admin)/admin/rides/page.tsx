'use client'

import { useState, useEffect, Suspense } from 'react'
import { Clock, MapPin, ChevronRight, RefreshCw } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'completed': return { bg: '#DCFCE7', text: '#16A34A', label: 'Done' }
    case 'active':    return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Live' }
    case 'requested': return { bg: '#FEF3C7', text: '#D97706', label: 'New' }
    case 'cancelled': return { bg: '#FEE2E2', text: '#DC2626', label: 'Miss' }
    default:          return { bg: '#F4F4F5', text: '#64748B', label: status }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdminRidesPage() {
  const [rides, setRides] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const sb = createClient()

  const load = async () => {
    setLoading(true)
    const { data } = await sb
      .from('ride_requests')
      .select('*, zones(name_as, zone_number), pullers(user_id)')
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (data) setRides(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  return (
    <main className="min-h-screen bg-[#FAFAFA] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#E4E4E7] px-5 pt-12 pb-5 flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-[#0F172A] font-display uppercase tracking-tight">Ride Logs</h1>
        <button onClick={load} className="h-9 w-9 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#64748B]">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Simple Filter Strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['All', 'Live', 'Completed', 'Cancelled'].map((f, i) => (
            <button key={f} className={`px-4 py-1.5 rounded-full text-[12px] font-bold border transition-colors whitespace-nowrap ${i === 0 ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white' : 'bg-white border-[#E4E4E7] text-[#64748B]'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] overflow-hidden shadow-sm">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(rides as any[]).map((ride) => {
            const ss = getStatusStyle(ride.status)
            const zc = ZONE_COLORS[ride.zones?.zone_number] || { hex: '#1D4ED8' }
            return (
              <div key={ride.id} className="flex items-center gap-4 px-5 py-4 border-b border-[#F4F4F5] last:border-0 active:bg-[#FAFAFA] transition-colors">
                <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white text-[14px] font-black" style={{ background: zc.hex }}>
                  {ride.zones?.zone_number || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-bold text-[#0F172A] font-body">Ride #{ride.id.slice(0, 4)}</span>
                    <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: ss.bg, color: ss.text }}>
                      {ss.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#94A3B8] font-body uppercase">
                    <Clock size={10} /> {formatTime(ride.created_at)}
                    <span>·</span>
                    <MapPin size={10} /> {ride.zones?.name_as}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#E4E4E7]" />
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#FAFAFA]" />}>
      <AdminRidesPage />
    </Suspense>
  )
}
