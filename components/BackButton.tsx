'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  fallback?: string
  label?: string
  onBack?: () => void
}

export default function BackButton({
  fallback = '/',
  label,
  onBack,
}: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button
      onClick={handleBack}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: '#F4F4F5',
        border: '1px solid #E4E4E7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      aria-label={label ?? 'Go back'}
    >
      <ChevronLeft size={20} color="#0F172A" strokeWidth={2.5} />
    </button>
  )
}
