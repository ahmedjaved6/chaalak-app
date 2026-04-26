'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Clock, ThumbsUp, Calendar, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { RideRequest, Zone } from '@/lib/types'


interface EnrichedRide extends RideRequest {
  zone: Zone | null
  duration_mins: number
}

export default function RideHistoryPage() {
  const router = useRouter()
  const [rides, setRides] = useState<EnrichedRide[]>([])
  const [loading, setLoading] = useState(true)
  const sbRef = useRef(createClient())

  useEffect(() => {
    const supabase = sbRef.current

    async function loadHistory() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: puller } = await supabase
        .from('pullers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!puller) { router.replace('/onboarding'); return }

      const { data: rideData, error } = await supabase
        .from('ride_requests')
        .select('*, zones(*)')
        .eq('accepted_by', puller.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching history:', error)
        setLoading(false)
        return
      }

      const enriched = (rideData || []).map((r) => {
        const start = r.started_at ? new Date(r.started_at).getTime() : 0
        const end = r.completed_at ? new Date(r.completed_at).getTime() : 0
        const duration = start && end ? Math.round((end - start) / 60000) : 0
        
        return {
          ...r,
          zone: r.zones as unknown as Zone,
          duration_mins: duration
        }
      })


      setRides(enriched)
      setLoading(false)
    }

    loadHistory()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1A1A1E]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E] text-white pb-20">
      {/* Header */}
      <div className="px-6 pt-14 pb-6 bg-gradient-to-b from-[#047857] to-[#10B981]">
        <h1 className="text-2xl font-black">যাত্ৰাৰ ইতিহাস</h1>
        <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Ride History</p>
      </div>

      <div className="px-5 mt-6">
        {rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Clock size={48} className="opacity-20 mb-4" />
            <p className="font-bold">কোনো যাত্ৰা পোৱা নগ’ল</p>
            <p className="text-sm">No completed rides yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map((ride, idx) => {
              const zoneColor = ride.zone ? ZONE_COLORS[ride.zone.zone_number] : null
              const date = ride.completed_at ? new Date(ride.completed_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short'
              }) : 'N/A'

              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-white/10 rounded-lg p-2 text-gray-400">
                        <Calendar size={16} />
                      </div>
                      <span className="font-black text-lg">{date}</span>
                      {ride.thumbs_up && (
                        <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full">
                          <ThumbsUp size={12} fill="currentColor" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {ride.zone && (
                        <span 
                          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter"
                          style={{ backgroundColor: zoneColor?.bg, color: zoneColor?.text }}
                        >
                          {ride.zone.name_as}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                        <Clock size={10} /> {ride.duration_mins} mins
                      </span>
                    </div>
                  </div>

                  <div className="text-gray-600">
                    <ChevronRight size={20} />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
