'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutPage() {
  const router = useRouter()
  
  useEffect(() => {
    const logout = async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      localStorage.clear()
      router.replace('/auth')
    }
    logout()
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center bg-[#1A1A1E] text-white font-nunito">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="font-bold">Logging out...</p>
      </div>
    </div>
  )
}
