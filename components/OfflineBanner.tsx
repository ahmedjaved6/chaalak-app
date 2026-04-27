'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    setOffline(!navigator.onLine)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#DC2626] text-white px-5 py-3 flex items-center justify-center gap-3 shadow-[0_-4px_20px_rgba(220,38,38,0.3)]"
        >
          <WifiOff size={18} strokeWidth={2.5} />
          <span className="text-[13px] font-bold font-body uppercase tracking-tight">
            ইণ্টাৰনেট নাই — Reconnecting...
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
