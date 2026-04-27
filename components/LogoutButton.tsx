'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'

interface LogoutButtonProps {
  color?: string
  className?: string
}

export default function LogoutButton({ className = '' }: LogoutButtonProps) {
  const router = useRouter()
  const sb = createClient()
  const tr = useT()

  async function handleLogout() {
    await sb.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.clear()
    }
    router.replace('/auth')
  }

  return (
    <button
      onClick={handleLogout}
      className={`h-9 w-9 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#64748B] border border-[#E4E4E7] active:scale-90 transition-all shadow-sm ${className}`}
      title={tr.logout}
    >
      <LogOut size={16} strokeWidth={2.5} />
    </button>
  )
}
