'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Phone, ShieldAlert, Share2, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { cancelRideRequest } from '@/lib/ride'
import { ZONE_COLORS } from '@/lib/constants'
import type { RideStatus } from '@/lib/types'
import type { RideMapProps } from '../_components/RideMap'


// ─── Dynamic Map ─────────────────────────────────────────────────────────────

const RideMap = dynamic<RideMapProps>(
  () => import('../_components/RideMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#F4F4F5]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
      </div>
    ),
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PullerInfo {
  id:          string
  badgeCode:   string
  badgeNumber: number
  thumbsUp:    number
  name:        string
  phone:       string | null
  zoneNumber:  number
  zoneNameAs:  string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PassengerRidePage() {
  const router = useRouter()
  const sbRef = useRef(createClient())

  const [rideId,       setRideId]       = useState<string | null>(null)
  const [passengerId,  setPassengerId]  = useState<string | null>(null)
  const [rideStatus,   setRideStatus]   = useState<RideStatus>('requested')
  const [puller,       setPuller]       = useState<PullerInfo | null>(null)
  const [passengerPos, setPassengerPos] = useState<[number, number] | null>(null)
  const [pullerPos,    setPullerPos]    = useState<[number, number] | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [showToast,    setShowToast]    = useState(false)

  // Initialization & Auth
  useEffect(() => {
    const sb = sbRef.current
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: passenger } = await sb.from('passengers').select('id').eq('user_id', user.id).maybeSingle()
      if (!passenger) { router.replace('/'); return }
      setPassengerId(passenger.id)

      const savedRideId = localStorage.getItem('chaalak_active_ride')
      if (!savedRideId) { router.replace('/'); return }

      const { data: active } = await sb
        .from('ride_requests')
        .select('id, status, accepted_by')
        .eq('id', savedRideId)
        .maybeSingle()

      if (!active) { 
        localStorage.removeItem('chaalak_active_ride')
        router.replace('/'); 
        return 
      }
      if (active.status === 'requested') { router.replace('/book'); return }

      setRideId(active.id)
      setRideStatus(active.status as RideStatus)

      if (active.accepted_by) {
        await loadPullerInfo(active.accepted_by)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const loadPullerInfo = useCallback(async (pid: string) => {
    const sb = sbRef.current
    const { data: p } = await sb.from('pullers').select('*').eq('id', pid).maybeSingle()
    if (!p) return

    const [userRes, zoneRes] = await Promise.all([
      sb.from('users').select('name, phone').eq('id', p.user_id).maybeSingle(),
      sb.from('zones').select('zone_number, name_as').eq('id', p.zone_id).maybeSingle(),
    ])

    setPuller({
      id:          p.id,
      badgeCode:   p.badge_code,
      badgeNumber: p.badge_number,
      thumbsUp:    p.thumbs_up ?? 0,
      name:        userRes.data?.name  ?? 'Puller',
      phone:       userRes.data?.phone ?? null,
      zoneNumber:  zoneRes.data?.zone_number ?? 1,
      zoneNameAs:  zoneRes.data?.name_as     ?? '',
    })
    if (p.lat != null && p.lng != null) setPullerPos([p.lat, p.lng])
  }, [])

  // Geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setPassengerPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  // Status Redirects
  useEffect(() => {
    if ((rideStatus === 'completed' || rideStatus === 'no_show') && rideId) {
      router.replace(`/complete?ride_id=${rideId}`)
    }
    if (rideStatus === 'cancelled' || rideStatus === 'expired') {
      localStorage.removeItem('chaalak_active_ride')
      localStorage.removeItem('chaalak_active_zone')
      router.replace('/')
    }
  }, [rideStatus, rideId, router])

  // Realtime
  useEffect(() => {
    if (!rideId) return
    const sb = sbRef.current
    const channel = sb
      .channel(`ride-tracking-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideId}` },
        async (payload) => {
          const s = payload.new.status as RideStatus
          setRideStatus(s)
          if (s === 'accepted' && payload.new.accepted_by && !puller) {
            await loadPullerInfo(payload.new.accepted_by)
          }
          if (s === 'completed') {
            router.push(`/complete?ride_id=${rideId}`)
          }
          if (s === 'cancelled' || s === 'expired') {
            localStorage.removeItem('chaalak_active_ride')
            localStorage.removeItem('chaalak_active_zone')
            router.push('/')
          }
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [rideId, puller, loadPullerInfo, router])

  // Poll Puller GPS
  useEffect(() => {
    if (!puller?.id || rideStatus !== 'active') return
    const interval = setInterval(async () => {
      const { data } = await sbRef.current
        .from('pullers')
        .select('lat, lng')
        .eq('id', puller.id)
        .single()
      if (data && data.lat && data.lng) setPullerPos([data.lat, data.lng])
    }, 10000)
    return () => clearInterval(interval)
  }, [puller?.id, rideStatus])

  const handleShare = async () => {
    if (!rideId) return
    const url = `${window.location.origin}/share/${rideId}`
    if (navigator.share) {
      await navigator.share({ title: 'Track my Chaalak ride', url })
    } else {
      await navigator.clipboard.writeText(url)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    }
  }

  if (loading || !rideId) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
    </div>
  )

  const zoneColor = puller ? ZONE_COLORS[puller.zoneNumber] : { hex: '#1D4ED8' }

  return (
    <main className="flex h-[100dvh] flex-col bg-white overflow-hidden">
      {/* Status Bar Top */}
      <div className="bg-[#EFF6FF] px-5 py-3 flex items-center justify-between border-b border-blue-100">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#1D4ED8] animate-pulse" />
          <span className="text-[13px] font-bold text-[#1D4ED8] font-body uppercase tracking-tight">
            {rideStatus === 'accepted' ? 'Puller Found' : 'Ride Active'}
          </span>
        </div>
        <div className="text-[16px] font-bold text-[#1D4ED8] font-display">
          {rideStatus === 'accepted' ? 'ETA 4 min' : '0.8 km'}
        </div>
      </div>

      {/* Map Section */}
      <div className="h-[200px] relative shrink-0">
        <RideMap passengerPos={passengerPos} pullerPos={pullerPos} />
        
        {/* Distance Badge */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-1.5 shadow-sm border border-[#E4E4E7] z-[1000]">
          <span className="text-[12px] font-bold text-[#0F172A] font-body uppercase">
            Puller is nearby
          </span>
        </div>

        {/* Share Button */}
        <button 
          onClick={handleShare}
          className="absolute top-4 right-4 h-9 w-9 bg-white rounded-full flex items-center justify-center shadow-md border border-[#E4E4E7] z-[1000] active:scale-90"
        >
          <Share2 size={18} className="text-[#64748B]" />
        </button>
      </div>

      {/* Bottom Sheet */}
      <div className="flex-1 bg-white px-5 pt-4 pb-8 overflow-y-auto animate-slide-up">
        <div className="w-8 h-1 bg-[#E4E4E7] rounded-full mx-auto mb-6" />

        {/* Puller Card */}
        {puller && (
          <div className="bg-white border border-[#E4E4E7] rounded-[16px] p-4 flex items-center gap-3 mb-4">
            {/* Badge */}
            <div 
              className="h-[52px] w-[52px] shrink-0 rounded-[12px] flex flex-col items-center justify-center"
              style={{ background: `${zoneColor.hex}10`, border: `1.5px solid ${zoneColor.hex}` }}
            >
              <span className="text-[10px] font-bold uppercase opacity-70" style={{ color: zoneColor.hex }}>
                {puller.badgeCode}
              </span>
              <span className="text-[22px] font-black leading-none" style={{ color: zoneColor.hex }}>
                {puller.badgeNumber}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1">
              <p className="text-[14px] font-bold text-[#0F172A] font-body">{puller.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[12px] font-medium text-[#64748B] font-body">{puller.zoneNameAs}</span>
                <span className="text-[12px] text-[#E4E4E7]">|</span>
                <span className="text-[11px] font-semibold text-[#94A3B8] font-body">👍 {puller.thumbsUp}</span>
              </div>
            </div>

            {/* Call */}
            {puller.phone && (
              <a 
                href={`tel:${puller.phone}`}
                className="h-11 w-11 flex items-center justify-center rounded-full bg-[#DCFCE7] border border-[#16A34A] text-[#16A34A] active:scale-90 transition-transform"
              >
                <Phone size={18} />
              </a>
            )}
          </div>
        )}

        {/* ETA Strip */}
        <div className="bg-[#EFF6FF] rounded-[12px] p-3 flex items-center gap-3 mb-6">
          <Clock size={18} className="text-[#1D4ED8]" />
          <p className="text-[12px] font-semibold text-[#1D4ED8] font-body uppercase tracking-tight">
            সাধাৰণতে ৩–৭ মিনিটত আহে
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <button 
            className="h-12 flex items-center justify-center gap-2 bg-[#FEE2E2] border border-[#DC2626] rounded-[12px] text-[#DC2626] text-[12px] font-bold font-body uppercase"
          >
            <ShieldAlert size={18} />
            SOS
          </button>
          <button 
            onClick={() => cancelRideRequest(sbRef.current, rideId!, passengerId!)}
            className="h-12 bg-[#F4F4F5] border border-[#E4E4E7] rounded-[12px] text-[#64748B] text-[12px] font-bold font-body uppercase"
          >
            Cancel
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white px-4 py-2 rounded-full text-[12px] font-bold shadow-xl z-[2000]"
          >
            Link Copied to Clipboard
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
