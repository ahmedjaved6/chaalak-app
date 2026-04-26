'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { RideStatus } from '@/lib/types'
import type { RideMapProps } from '../../(passenger)/_components/RideMap'

const RideMap = dynamic<RideMapProps>(
  () => import('../../(passenger)/_components/RideMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center" style={{ background: '#0f1117' }}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    ),
  }
)

interface RideData {
  id: string
  status: RideStatus
  accepted_by: string | null
  zone: {
    name: string
    name_as: string
    zone_number: number
  } | null
  puller: {
    name: string
    badge_code: string
    badge_number: number
    lat: number | null
    lng: number | null
    thumbs_up: number
  } | null
}

export default function ShareTripPage({ params }: { params: { rideId: string } }) {
  const { rideId } = params
  const [data, setData] = useState<RideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sbRef = useRef(createClient())

  const fetchRideData = async () => {
    const sb = sbRef.current
    const { data: ride, error: rideErr } = await sb
      .from('ride_requests')
      .select('id, status, accepted_by, zone_id')
      .eq('id', rideId)
      .maybeSingle()

    if (rideErr) {
      setError(rideErr.message)
      return
    }
    if (!ride) {
      setError('Trip not found')
      return
    }

    let pullerData: RideData['puller'] = null
    let zoneData: RideData['zone'] = null

    if (ride.accepted_by) {
      const { data: p } = await sb
        .from('pullers')
        .select('badge_code, badge_number, lat, lng, thumbs_up, user_id')
        .eq('id', ride.accepted_by)
        .maybeSingle()
      
      if (p) {
        const { data: u } = await sb.from('users').select('name').eq('id', p.user_id).maybeSingle()
        pullerData = {
          name: u?.name || 'Puller',
          badge_code: p.badge_code,
          badge_number: p.badge_number,
          lat: p.lat,
          lng: p.lng,
          thumbs_up: p.thumbs_up || 0,
        }
      }
    }

    if (ride.zone_id) {
      const { data: z } = await sb.from('zones').select('name, name_as, zone_number').eq('id', ride.zone_id).maybeSingle()
      zoneData = z as RideData['zone']
    }

    setData({
      id: ride.id,
      status: ride.status as RideStatus,
      accepted_by: ride.accepted_by,
      zone: zoneData,
      puller: pullerData,
    })
    setLoading(false)
  }

  useEffect(() => {
    fetchRideData()

    const channel = sbRef.current
      .channel(`public-ride-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideId}` },
        () => fetchRideData()
      )
      .subscribe()

    const pollPuller = setInterval(async () => {
      if (data?.accepted_by) {
        const { data: p } = await sbRef.current
          .from('pullers')
          .select('lat, lng')
          .eq('id', data.accepted_by)
          .maybeSingle()
        if (p) {
          setData(prev => prev ? {
            ...prev,
            puller: prev.puller ? { ...prev.puller, lat: p.lat, lng: p.lng } : null
          } : null)
        }
      }
    }, 10000)

    return () => {
      sbRef.current.removeChannel(channel)
      clearInterval(pollPuller)
    }
  }, [rideId, data?.accepted_by])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1A1A1E]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1A1A1E] px-6 text-center">
        <h1 className="text-2xl font-black text-white">{error}</h1>
        <p className="mt-2 text-white/40">This link may have expired or is invalid.</p>
      </div>
    )
  }

  const statusMessages = {
    requested: 'Looking for puller...',
    accepted: 'Puller is on the way',
    active: 'Ride in progress',
    completed: 'Trip completed safely ✓',
    cancelled: 'Trip cancelled',
    no_show: 'Passenger no-show',
  }

  const zoneColor = data?.zone ? ZONE_COLORS[data.zone.zone_number] : null

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#1A1A1E]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <RickshawIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black text-white tracking-tight">CHAALAK</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Live Trip</span>
          <div 
            className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
          />
        </div>
      </div>

      {/* Map */}
      <div className="relative shrink-0" style={{ height: '40dvh' }}>
        <RideMap 
          passengerPos={null} // Don't show passenger pos on public link for privacy
          pullerPos={data?.puller?.lat && data?.puller?.lng ? [data.puller.lat, data.puller.lng] : null} 
        />
        
        {/* Status Pill */}
        <div 
          className="absolute left-4 top-4 z-[1000] rounded-xl px-3 py-1.5 text-sm font-bold text-white shadow-xl"
          style={{ 
            background: 'rgba(0,0,0,0.75)', 
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {statusMessages[data?.status || 'requested']}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-6 pt-8 pb-10">
        <AnimatePresence mode="wait">
          {data?.puller ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="flex items-center gap-5">
                {/* Badge */}
                <div
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl"
                  style={{
                    background: zoneColor ? `${zoneColor.hex}1A` : 'rgba(255,255,255,0.08)',
                    border: `2.5px solid ${zoneColor?.hex ?? 'rgba(255,255,255,0.2)'}`,
                    boxShadow: zoneColor ? `0 8px 32px ${zoneColor.hex}20` : 'none'
                  }}
                >
                  <span className="text-[11px] font-bold" style={{ color: zoneColor?.hex ?? '#fff' }}>
                    {data.puller.badge_code.slice(0, 2)}
                  </span>
                  <span className="text-3xl font-black leading-tight" style={{ color: zoneColor?.hex ?? '#fff' }}>
                    {data.puller.badge_number}
                  </span>
                </div>

                <div className="flex-1">
                  <h2 className="text-2xl font-black text-white">{data.puller.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-white/40">👍 {data.puller.thumbs_up}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-sm font-bold" style={{ color: zoneColor?.hex }}>{data.zone?.name_as}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-white border-t-transparent mb-4" />
              <p className="font-bold">Awaiting trip details...</p>
            </div>
          )}
        </AnimatePresence>

        <div className="mt-auto pt-8 border-t border-white/5 text-center">
          <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">
            Powered by Chaalak — চালক
          </p>
        </div>
      </div>
    </div>
  )
}

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
