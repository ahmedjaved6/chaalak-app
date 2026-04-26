export const ZONE_COLORS: Record<number, { hex: string; label: string; bg: string; text: string }> = {
  1: { hex: '#F59E0B', label: 'amber',  bg: '#FEF3C7', text: '#92400E' },
  2: { hex: '#10B981', label: 'green',  bg: '#D1FAE5', text: '#065F46' },
  3: { hex: '#3B82F6', label: 'blue',   bg: '#DBEAFE', text: '#1E40AF' },
  4: { hex: '#8B5CF6', label: 'purple', bg: '#EDE9FE', text: '#5B21B6' },
}

export const ZONE_PREFIXES: Record<number, string> = {
  1: 'PB',
  2: 'CH',
  3: 'DS',
  4: 'BT',
}

export const RIDE_TTL_SECONDS = 180
export const HEARTBEAT_INTERVAL_MS = 10000
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
