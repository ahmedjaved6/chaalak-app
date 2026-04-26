import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book a Ride — Chaalak | চালক',
  description: 'Book a rickshaw instantly in Guwahati'
}

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
