import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — Chaalak | চালক',
  description: 'Login to Chaalak rickshaw booking'
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
