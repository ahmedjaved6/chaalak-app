'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ThumbsUp } from 'lucide-react'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'

// ─── Main Content ─────────────────────────────────────────────────────────────

function CompletePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rideId = searchParams.get('ride_id')

  const [rated, setRated] = useState(false)
  const [zoneName, setZoneName] = useState('')

  useEffect(() => {
    if (!rideId) return
    const sb = createClient()
    sb.from('ride_requests')
      .select('zones(name_as)')
      .eq('id', rideId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setZoneName((data.zones as unknown as Record<string, string>)?.name_as || '')
      })
  }, [rideId])

  const handleRate = async () => {
    if (!rideId || rated) return
    setRated(true)
    const sb = createClient()
    await sb.from('ride_requests').update({ thumbs_up: true }).eq('id', rideId)
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-8 bg-white">
      {/* Checkmark Circle */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="h-20 w-20 rounded-full bg-[#DCFCE7] border border-[#16A34A] flex items-center justify-center text-[#16A34A]"
      >
        <Check size={36} strokeWidth={3} />
      </motion.div>

      {/* Title */}
      <h1 className="mt-8 text-[32px] font-black text-[#0F172A] font-display uppercase tracking-tight">
        Ride Complete
      </h1>
      <p className="mt-1 text-[14px] font-medium text-[#64748B] font-body">
        Thank you for riding to {zoneName}
      </p>

      {/* Rating Section */}
      <div className="mt-12 w-full max-w-[320px] bg-white border border-[#E4E4E7] rounded-[24px] p-8 flex flex-col items-center shadow-sm">
        <p className="text-[14px] font-bold text-[#0F172A] font-body uppercase tracking-tight">
          Rate your ride
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

      {/* Back to Home */}
      <button 
        onClick={() => router.push('/')}
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
