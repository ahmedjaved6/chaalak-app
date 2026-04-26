'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, User, Phone, MapPin, Award, Calendar, ChevronRight, Star } from 'lucide-react'

interface ProfileData {
  puller: Puller
  user: AppUser
  zone: Zone | null
}

export default function PullerProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const sbRef = useRef(createClient())

  useEffect(() => {
    const supabase = sbRef.current

    async function loadProfile() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.replace('/auth'); return }

      const { data: puller, error: pErr } = await supabase
        .from('pullers')
        .select('*, users(*), zones(*)')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (pErr || !puller) {
        console.error('Error fetching profile:', pErr)
        router.replace('/onboarding')
        return
      }

      setData({
        puller: puller as Puller,
        user: puller.users as unknown as AppUser,
        zone: puller.zones as Zone | null
      })
      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function handleLogout() {
    await sbRef.current.auth.signOut()
    router.replace('/auth')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1A1A1E]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    )
  }

  if (!data) return null

  const { puller, user, zone } = data
  const zoneColor = zone ? ZONE_COLORS[zone.zone_number] : null
  const joinDate = new Date(user.created_at).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric'
  })

  return (
    <div className="min-h-screen bg-[#1A1A1E] text-white pb-24">
      {/* Header Profile Section */}
      <div className="px-6 pt-16 pb-10 bg-gradient-to-b from-[#1F2937] to-[#111827] relative overflow-hidden">
        {/* Background Accent */}
        <div 
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: zoneColor?.hex ?? '#10B981' }}
        />
        
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-3xl bg-emerald-500 flex items-center justify-center border-4 border-white/10 shadow-2xl overflow-hidden">
              {puller.photo_url ? (
                <img src={puller.photo_url} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <User size={48} className="text-white" />
              )}
            </div>
            {/* Badge Floating */}
            <div 
              className="absolute -bottom-2 -right-2 px-3 py-1 rounded-xl text-[10px] font-black border-2 border-[#111827] shadow-lg"
              style={{ backgroundColor: zoneColor?.hex ?? '#10B981', color: 'white' }}
            >
              {puller.badge_code}{puller.badge_number}
            </div>
          </div>
          
          <h2 className="mt-5 text-2xl font-black">{user.name}</h2>
          <div className="flex items-center gap-2 mt-1 opacity-60">
            <MapPin size={14} />
            <span className="text-sm font-bold uppercase tracking-widest">{zone?.name_as} · {zone?.name}</span>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="bg-amber-500/10 text-amber-500 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
              <Award size={18} />
            </div>
            <div className="text-2xl font-black">{puller.total_rides}</div>
            <div className="text-[10px] font-bold uppercase opacity-40">Total Rides</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="bg-emerald-500/10 text-emerald-500 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
              <Star size={18} fill="currentColor" />
            </div>
            <div className="text-2xl font-black">{puller.thumbs_up}</div>
            <div className="text-[10px] font-bold uppercase opacity-40">Thumbs Up</div>
          </div>
        </div>

        {/* Info List */}
        <div className="mt-6 space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-gray-500"><Phone size={20} /></div>
            <div>
              <div className="text-[10px] font-bold uppercase opacity-40 leading-none mb-1">Phone Number</div>
              <div className="font-bold">{user.phone || 'Not provided'}</div>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-gray-500"><Calendar size={20} /></div>
            <div>
              <div className="text-[10px] font-bold uppercase opacity-40 leading-none mb-1">Join Date</div>
              <div className="font-bold">{joinDate}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <button 
            onClick={handleLogout}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl py-4 font-black flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            প্ৰস্থান (Logout)
          </button>
        </div>
      </div>
    </div>
  )
}
