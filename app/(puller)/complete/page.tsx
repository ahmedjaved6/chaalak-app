'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Clock, MapPin, Star } from 'lucide-react'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'

function CompletePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rideId = searchParams.get('ride_id')

  const [ride, setRide] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    localStorage.removeItem('chaalak_current_ride')
    if (!rideId) { router.replace('/dashboard'); return }

    const sb = createClient()
    sb.from('ride_requests')
      .select('*, zones(name_as)')
      .eq('id', rideId)
      .single()
      .then(({ data }) => {
        if (data) setRide(data)
        setLoading(false)
      })
  }, [rideId, router])

  if (loading) return <div className="h-screen bg-white" />

  const duration = ride?.completed_at && ride?.started_at 
    ? Math.floor((new Date(ride.completed_at).getTime() - new Date(ride.started_at).getTime()) / 60000)
    : 0

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-8 bg-white relative">
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
      <p className="mt-1 text-[14px] font-medium text-[#64748B] font-body uppercase">
        Excellent work!
      </p>

      <div className="mt-10 w-full max-w-[340px] grid grid-cols-2 gap-4">
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-5">
          <div className="text-[#64748B] mb-2"><Clock size={20} /></div>
          <div className="text-[24px] font-bold text-[#0F172A] font-display">{duration}m</div>
          <div className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-wider">Duration</div>
        </div>
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-5">
          <div className="text-[#64748B] mb-2"><MapPin size={20} /></div>
          <div className="text-[24px] font-bold text-[#0F172A] font-display uppercase truncate">{ride?.zones?.name_as || 'Zone'}</div>
          <div className="text-[11px] font-bold text-[#94A3B8] font-body uppercase tracking-wider">Location</div>
        </div>
      </div>

      <button 
        onClick={() => router.push('/dashboard')}
        className="mt-12 w-full max-w-[340px] py-4 rounded-[12px] bg-[#1D4ED8] text-white text-[18px] font-bold font-display uppercase tracking-tight shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform"
      >
        Back to Dashboard
      </button>
    </main>
  )
}

export default function PullerCompletePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <CompletePageContent />
    </Suspense>
  )
}
