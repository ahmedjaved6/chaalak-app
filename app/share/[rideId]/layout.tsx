import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Live Trip — Chaalak | চালক',
  description: 'Track a live Chaalak ride'
}

export default function ShareTripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
