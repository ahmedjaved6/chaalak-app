'use client'

import { motion } from 'framer-motion'
import { Bike } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1A1A1E]">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="text-amber-500"
      >
        <Bike size={64} strokeWidth={2.5} />
      </motion.div>
    </div>
  )
}
