'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { ZONE_COLORS } from '@/lib/constants'
import type { Zone } from '@/lib/types'


// ─── Animation variant ────────────────────────────────────────────────────────

const SLIDE: Variants = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -28, transition: { duration: 0.16, ease: 'easeIn' } },
}

// ─── Zone card ────────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  selected,
  onSelect,
}: {
  zone: Zone
  selected: boolean
  onSelect: () => void
}) {
  const c = ZONE_COLORS[zone.zone_number] ?? { hex: '#888', label: '', bg: '#222', text: '#fff' }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col gap-3 rounded-2xl p-4 text-left transition-all duration-150 active:scale-[0.96]"
      style={{
        background: selected ? `${c.hex}18` : 'rgba(255,255,255,0.05)',
        border: `2px solid ${selected ? c.hex : 'rgba(255,255,255,0.09)'}`,
        boxShadow: selected ? `0 0 0 1px ${c.hex}40, 0 4px 20px ${c.hex}20` : 'none',
      }}
    >
      {/* Numbered circle */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-black text-white"
        style={{ background: c.hex, boxShadow: `0 2px 10px ${c.hex}50` }}
      >
        {zone.zone_number}
      </div>

      {/* Names */}
      <div>
        <p className="text-[15px] font-black leading-tight text-white">{zone.name_as}</p>
        <p className="mt-0.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
          {zone.name}
        </p>
      </div>
    </button>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i + 1 === current ? 20 : 6,
            height: 6,
            background: i + 1 === current ? '#F59E0B' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep]               = useState<1 | 2 | 3>(1)
  const [name, setName]               = useState('')
  const [zones, setZones]             = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [userId, setUserId]           = useState<string>('')

  // ── Auth guard + load zones ───────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/auth'); return }
      setUserId(user.id)
    })

    supabase
      .from('zones')
      .select('id, name, name_as, name_hi, color_hex, color_label, zone_number, is_active')
      .eq('is_active', true)
      .order('zone_number')
      .then(({ data }) => {
        if (data && data.length > 0) setZones(data as Zone[])
      })
  }, [router])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const selectedZone = zones.find((z) => z.id === selectedZoneId)

  async function handleSubmit() {
    if (!userId || !selectedZoneId) return
    setLoading(true)
    setError('')

    const supabase = createClient()

    // Temp badge_code (NOT NULL constraint) — admin replaces on approval
    const tempBadgeCode = `PENDING-${userId.replace(/-/g, '').substring(0, 16).toUpperCase()}`

    const { error: pullerErr } = await supabase.from('pullers').insert({
      user_id:      userId,
      badge_code:   tempBadgeCode,
      badge_number: 0,           // placeholder; admin assigns real number
      zone_id:      selectedZoneId,
      status:       'pending',
      vehicle_type: 'rickshaw',
    })

    if (pullerErr) {
      // If already submitted (duplicate badge_code), treat as success
      if (!pullerErr.message.includes('duplicate')) {
        setError(pullerErr.message)
        setLoading(false)
        return
      }
    }

    // Update the users row with real name + puller role
    const { error: userErr } = await supabase
      .from('users')
      .update({ name: name.trim(), role: 'puller' })
      .eq('id', userId)

    if (userErr) {
      setError(userErr.message)
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('chaalak_role', 'puller')
    }

    setLoading(false)
    setStep(3)
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#1A1A1E' }}
    >
      <div className="flex min-h-screen flex-col px-5 py-10">
        <div className="mx-auto w-full max-w-[360px] flex flex-col flex-1">

          {/* Step dots — hidden on confirmation */}
          {step < 3 && (
            <div className="mb-8">
              <StepDots current={step} total={2} />
            </div>
          )}

          <div className="flex-1">
            <AnimatePresence mode="wait">

              {/* ── STEP 1: Name ─────────────────────────────────────────── */}
              {step === 1 && (
                <motion.div key="step1" {...SLIDE} className="flex flex-col gap-6">
                  <div>
                    <h1
                      className="text-[32px] font-black leading-tight text-white"
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      আপোনাৰ নাম
                    </h1>
                    <p className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Your name
                    </p>
                  </div>

                  <div
                    className="overflow-hidden rounded-2xl transition-all"
                    style={{ border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
                    onFocusCapture={(e) => (e.currentTarget.style.borderColor = '#F59E0B')}
                    onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  >
                    <input
                      type="text"
                      autoFocus
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError('') }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(2) }}
                      placeholder="নাম দিয়ক…"
                      className="w-full bg-transparent px-5 py-4 text-[18px] font-bold text-white outline-none placeholder:font-semibold"
                      style={{ caretColor: '#F59E0B', color: 'white' }}
                    />
                  </div>

                  {error && (
                    <p className="text-sm font-semibold" style={{ color: '#F87171' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={() => setStep(2)}
                    className="w-full rounded-2xl py-4 text-[17px] font-black transition-all active:scale-[0.97]"
                    style={{
                      background: name.trim() ? '#F59E0B' : 'rgba(245,158,11,0.25)',
                      color: name.trim() ? '#1A1A1E' : 'rgba(0,0,0,0.35)',
                      boxShadow: name.trim() ? '0 4px 24px rgba(245,158,11,0.28)' : 'none',
                      cursor: name.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    পৰৱৰ্তী →
                  </button>
                </motion.div>
              )}

              {/* ── STEP 2: Zone select ───────────────────────────────────── */}
              {step === 2 && (
                <motion.div key="step2" {...SLIDE} className="flex flex-col gap-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 self-start text-sm font-semibold transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)')}
                  >
                    ← পিছলৈ
                  </button>

                  <div>
                    <h1
                      className="text-[28px] font-black leading-tight text-white"
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      আপোনাৰ জ&apos;ন বাছক
                    </h1>
                    <p className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Select your zone
                    </p>
                  </div>

                  {/* 2×2 zone grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {zones.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        selected={selectedZoneId === zone.id}
                        onSelect={() => { setSelectedZoneId(zone.id); setError('') }}
                      />
                    ))}
                  </div>

                  {error && (
                    <p className="text-sm font-semibold" style={{ color: '#F87171' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!selectedZoneId || loading}
                    onClick={handleSubmit}
                    className="w-full rounded-2xl py-4 text-[17px] font-black transition-all active:scale-[0.97]"
                    style={{
                      background: selectedZoneId && !loading ? '#F59E0B' : 'rgba(245,158,11,0.25)',
                      color: selectedZoneId && !loading ? '#1A1A1E' : 'rgba(0,0,0,0.35)',
                      boxShadow: selectedZoneId && !loading ? '0 4px 24px rgba(245,158,11,0.28)' : 'none',
                      cursor: selectedZoneId && !loading ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {loading ? (
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      'জমা দিয়ক'
                    )}
                  </button>
                </motion.div>
              )}

              {/* ── STEP 3: Confirmation ──────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  variants={SLIDE}
                  initial="initial"
                  animate="animate"
                  className="flex flex-col items-center gap-7 pt-8 text-center"
                >
                  {/* Success icon */}
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full"
                    style={{
                      background: 'rgba(245,158,11,0.12)',
                      border: '2px solid rgba(245,158,11,0.35)',
                      boxShadow: '0 0 40px rgba(245,158,11,0.15)',
                    }}
                  >
                    <span className="text-5xl">✅</span>
                  </div>

                  {/* Assamese confirmation message */}
                  <div className="flex flex-col gap-2">
                    <h1 className="text-[24px] font-black leading-tight text-white">
                      আবেদন জমা দিয়া হৈছে
                    </h1>
                    <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Application submitted for approval
                    </p>
                  </div>

                  {/* Summary card */}
                  <div
                    className="w-full rounded-2xl p-5 text-left"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.09)' }}
                  >
                    <Row label="নাম" value={name.trim()} />
                    <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    {selectedZone && (
                      <ZoneRow zone={selectedZone} />
                    )}
                    <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    <Row
                      label="বেজ নম্বৰ"
                      value="এডমিনে নিযুক্ত কৰিব"
                      valueStyle={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}
                    />
                  </div>

                  {/* Badge info note */}
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    আপোনাৰ অনুমোদনৰ পিছত এডমিনে বেজ নম্বৰ নিযুক্ত কৰিব।
                    <br />
                    Badge number will be assigned after admin approval.
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Confirmation row helpers ─────────────────────────────────────────────────

function Row({
  label,
  value,
  valueStyle,
}: {
  label: string
  value: string
  valueStyle?: React.CSSProperties
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}
      </span>
      <span className="text-right text-sm font-bold text-white" style={valueStyle}>
        {value}
      </span>
    </div>
  )
}

function ZoneRow({ zone }: { zone: Zone }) {
  const c = ZONE_COLORS[zone.zone_number] ?? { hex: '#888' }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
        জ&apos;ন
      </span>
      <div className="flex items-center gap-2">
        <div
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
          style={{ background: c.hex }}
        >
          {zone.zone_number}
        </div>
        <span className="text-sm font-bold text-white">
          {zone.name_as} · {zone.name}
        </span>
      </div>
    </div>
  )
}
