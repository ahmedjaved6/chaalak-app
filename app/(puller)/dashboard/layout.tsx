import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard — Chaalak',
  description: 'Puller dashboard for Chaalak ride network'
}

export default function PullerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
