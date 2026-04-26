import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin — Chaalak',
  description: 'Chaalak admin control panel'
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
