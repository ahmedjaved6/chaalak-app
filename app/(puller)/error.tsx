'use client'

import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1A1A1E] px-6 text-center">
      <div className="mb-6 rounded-full bg-red-500/10 p-4 text-red-500">
        <AlertCircle size={48} />
      </div>
      <h2 className="mb-2 text-2xl font-black text-white">কিবা সমস্যা হৈছে</h2>
      <p className="mb-8 text-sm text-gray-400">চিস্টেমত কিবা এটা ভুল হ’ল। অনুগ্ৰহ কৰি আকৌ চেষ্টা কৰক।</p>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={reset}
        className="rounded-2xl bg-amber-500 px-8 py-4 text-sm font-black text-white shadow-lg shadow-amber-500/20"
      >
        Retry
      </motion.button>
    </div>
  )
}
