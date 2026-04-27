'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { cancelRideRequest } from '@/lib/ride'


// ─── Rickshaw Icon ────────────────────────────────────────────────────────────

function RickshawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <path d="M15 17.5h-6" />
      <path d="M5.5 14V7a2 2 0 0 1 2-2H12" />
      <path d="M18.5 14v-4a2 2 0 0 0-2-2h-3" />
      <path d="M12 5v12.5" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchingPage() {
  const router = useRouter()
  const sbRef = useRef(createClient())

  const [rideId, setRideId] = useState<string | null>(null)
  const [passengerId, setPassengerId] = useState<string | null>(null)
  const [zoneName, setZoneName] = useState('')
  const [timeLeft, setTimeLeft] = useState(180)
  const [cancelling, setCancelling] = useState(false)

  // Initialization
  useEffect(() => {
    const sb = sbRef.current
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: passenger } = await sb.from('passengers').select('id').eq('user_id', user.id).maybeSingle()
      if (!passenger) { router.replace('/'); return }
      setPassengerId(passenger.id)

      const { data: active } = await sb
        .from('ride_requests')
        .select('id, status, zones(name_as), expires_at')
        .eq('passenger_id', passenger.id)
        .eq('status', 'requested')
        .maybeSingle()

      if (!active) { router.replace('/'); return }
      
      setRideId(active.id)
      setZoneName((active.zones as unknown as Record<string, string>)?.name_as || '')
      
      const expiry = new Date(active.expires_at).getTime()
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
      setTimeLeft(diff)
    }
    load()
  }, [router])

  // Timer & Status Watcher
  useEffect(() => {
    if (!rideId) return
    const sb = sbRef.current

    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)

    const channel = sb
      .channel(`searching-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideId}` },
        (payload) => {
          if (payload.new.status === 'accepted') {
            router.push('/ride')
          } else if (payload.new.status === 'expired' || payload.new.status === 'cancelled') {
            router.replace('/')
          }
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      sb.removeChannel(channel)
    }
  }, [rideId, router])

  async function handleCancel() {
    if (!rideId || !passengerId || cancelling) return
    setCancelling(true)
    try {
      await cancelRideRequest(sbRef.current, rideId, passengerId)
      router.replace('/')
    } catch {
      setCancelling(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white p-6">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-12">
        <button onClick={handleCancel} className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#0F172A]">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[24px] font-bold text-[#0F172A] font-display uppercase tracking-tight">
          Finding your ride
        </h1>
      </div>

      {/* Pulsing Animation */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Pulse Rings */}
          <div className="absolute h-[120px] w-[120px] rounded-full bg-blue-500/10 animate-pulse-ring" />
          <div className="absolute h-[80px] w-[80px] rounded-full bg-blue-500/15" />
          <div className="relative h-[52px] w-[52px] rounded-full bg-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <RickshawIcon className="h-6 w-6 text-white" />
          </div>
        </div>

        <div className="mt-10 text-center">
          <h2 className="text-[22px] font-bold text-[#0F172A] font-display uppercase leading-tight">
            Searching for nearby pullers
          </h2>
          <p className="mt-1 text-[14px] font-medium text-[#64748B] font-body">
            Zone: {zoneName}
          </p>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-auto">
        {/* Timer Bar */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1D4ED8]">
            <Clock size={16} strokeWidth={2.5} />
            <span className="text-[14px] font-bold font-display uppercase">Time Left</span>
          </div>
          <span className="text-[16px] font-bold text-[#1D4ED8] font-display">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
        <div className="w-full h-1 bg-[#E4E4E7] rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-[#1D4ED8]"
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / 180) * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>

        {/* Nearby Chips (Static Demo for design) */}
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {['PB-47 · 0.4km', 'CH-12 · 1.2km', 'DS-05 · 0.8km'].map(chip => (
            <div key={chip} className="bg-[#EFF6FF] border border-[#1D4ED8] rounded-full px-3 py-1 animate-fade-in">
              <span className="text-[11px] font-semibold text-[#1D4ED8] font-body">{chip}</span>
            </div>
          ))}
        </div>

        <button 
          onClick={handleCancel}
          className="w-full mt-12 py-4 text-[13px] font-semibold text-[#94A3B8] underline underline-offset-4 decoration-[#E4E4E7] active:text-[#0F172A]"
        >
          Cancel Request
        </button>
      </div>
    </main>
  )
}
