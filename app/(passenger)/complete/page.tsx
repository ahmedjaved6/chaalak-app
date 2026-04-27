'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ThumbsUp } from 'lucide-react'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import BackButton from '@/components/BackButton'
import { ZONE_COLORS } from '@/lib/constants'

// ─── Main Content ─────────────────────────────────────────────────────────────

function CompletePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlRideId = searchParams.get('ride_id')
  const savedRideId = localStorage.getItem('chaalak_active_ride')
  const rideId = urlRideId || savedRideId

  const [rated, setRated] = useState(false)
  const [ride, setRide] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rideId) { router.replace('/'); return }
    const sb = createClient()
    sb.from('ride_requests')
      .select('*, zones(name_as, zone_number), pullers(badge_code, badge_number, id)')
      .eq('id', rideId)
      .single()
      .then(({ data }) => {
        if (data) setRide(data)
        setLoading(false)
      })
  }, [rideId, router])

  const handleRate = async () => {
    if (!rideId || rated || !ride) return
    setRated(true)
    const sb = createClient()
    
    // Updates
    await Promise.all([
      sb.from('ride_requests').update({ thumbs_up: true }).eq('id', rideId),
      sb.rpc('increment_puller_thumbs', { puller_id: ride.accepted_by }),
      sb.rpc('increment_passenger_thumbs', { passenger_id: ride.passenger_id })
    ])
  }

  const handleHome = () => {
    localStorage.removeItem('chaalak_active_ride')
    localStorage.removeItem('chaalak_active_zone')
    router.push('/')
  }

  if (loading) return <div className="h-screen bg-white" />

  const duration = ride?.completed_at && ride?.started_at 
    ? Math.floor((new Date(ride.completed_at).getTime() - new Date(ride.started_at).getTime()) / 60000)
    : 0

  const zoneColor = ride?.zones ? ZONE_COLORS[ride.zones.zone_number] : { hex: '#1D4ED8' }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-8 bg-white relative">
      <div className="absolute top-6 left-6">
        <BackButton onBack={handleHome} />
      </div>
      
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="h-20 w-20 rounded-full bg-[#DCFCE7] border border-[#16A34A] flex items-center justify-center text-[#16A34A]"
      >
        <Check size={36} strokeWidth={3} />
      </motion.div>

      <h1 className="mt-8 text-[32px] font-black text-[#0F172A] font-display uppercase tracking-tight">
        Ride Complete
      </h1>
      
      <div className="mt-4 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px] font-medium text-[#64748B] font-body">Rode to</span>
          <span className="text-[14px] font-bold text-[#0F172A] font-body uppercase">{ride?.zones?.name_as}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded text-[11px] font-bold text-white uppercase" style={{ backgroundColor: zoneColor.hex }}>
            {ride?.pullers?.badge_code}-{ride?.pullers?.badge_number}
          </div>
          <span className="text-[12px] font-medium text-[#94A3B8] font-body">• {duration} mins</span>
        </div>
      </div>

      <div className="mt-12 w-full max-w-[320px] bg-white border border-[#E4E4E7] rounded-[24px] p-8 flex flex-col items-center shadow-sm">
        <p className="text-[14px] font-bold text-[#0F172A] font-body uppercase tracking-tight">
          Thumbs up?
        </p>
        
        <button
          onClick={handleRate}
          className={`mt-6 h-[72px] w-[72px] rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 ${
            rated 
              ? 'bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/40 scale-110' 
              : 'bg-[#EFF6FF] border border-[#1D4ED8] text-[#1D4ED8]'
          }`}
        >
          <ThumbsUp size={32} fill={rated ? 'currentColor' : 'none'} strokeWidth={rated ? 0 : 2.5} />
        </button>

        {rated && (
          <motion.p 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-[12px] font-bold text-[#1D4ED8] font-body uppercase"
          >
            Feedback Recorded
          </motion.p>
        )}
      </div>

      <button 
        onClick={handleHome}
        className="mt-12 w-full max-w-[320px] py-4 rounded-[12px] bg-[#F4F4F5] border border-[#E4E4E7] text-[#64748B] text-[16px] font-bold font-display uppercase tracking-tight active:scale-[0.98] transition-transform"
      >
        Back to Home
      </button>
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompletePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <CompletePageContent />
    </Suspense>
  )
}
