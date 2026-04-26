'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { useT } from '@/lib/i18n'


interface LogoutButtonProps {
  color?: string
  className?: string
}

export default function LogoutButton({ color = '#E8E5DE', className = '' }: LogoutButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const tr = useT()

  async function handleLogout() {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chaalak_role')
      localStorage.removeItem('chaalak_lang')
      localStorage.removeItem('chaalak_active_ride')
    }
    router.push('/auth')
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${className}`}
      style={{
        borderColor: `${color}30`,
        color: color,
        background: 'transparent',
      }}
    >
      <span>{tr.logout}</span>
      <LogOut size={13} strokeWidth={2.5} />
    </button>

  )
}
