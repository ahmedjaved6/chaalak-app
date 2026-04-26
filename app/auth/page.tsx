'use client'

import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { LanguagePref } from '@/lib/types'


// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'ROLE_SELECT' | 'PHONE_ENTRY' | 'OTP_VERIFY' | 'PENDING'
type SelectedRole = 'passenger' | 'puller' | 'admin'

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  as: {
    subtitle: 'আপোনাৰ ৰিক্সা তৎক্ষণাৎ',
    passenger: 'যাত্ৰী',
    puller: 'চালক',
    phoneLabel: 'মোবাইল নম্বৰ',
    phonePlaceholder: '98765 43210',
    continue: 'অগ্ৰসৰ হওক',
    otpSentTo: 'OTP পঠোৱা হৈছে',
    verifyTitle: 'OTP যাচাই',
    verify: 'যাচাই কৰক',
    adminLogin: 'এডমিন লগইন',
    back: 'পিছলৈ',
    pendingTitle: 'অনুমোদনৰ বাবে অপেক্ষাৰত',
    pendingBody: 'আপোনাৰ আবেদন পৰ্যালোচনা কৰা হৈছে। অনুগ্ৰহ কৰি অপেক্ষা কৰক।',
    logout: 'লগআউট',
    errPhone: 'সঠিক ১০ সংখ্যাৰ নম্বৰ দিয়ক',
    errOtp: '৬ সংখ্যাৰ OTP দিয়ক',
  },
  hi: {
    subtitle: 'अपना रिक्शा तुरंत',
    passenger: 'यात्री',
    puller: 'चालक',
    phoneLabel: 'मोबाइल नंबर',
    phonePlaceholder: '98765 43210',
    continue: 'आगे बढ़ें',
    otpSentTo: 'OTP भेजा गया',
    verifyTitle: 'OTP सत्यापन',
    verify: 'सत्यापित करें',
    adminLogin: 'एडमिन लॉगिन',
    back: 'वापस',
    pendingTitle: 'अनुमोदन प्रतीक्षित',
    pendingBody: 'आपका आवेदन समीक्षाधीन है। कृपया प्रतीक्षा करें।',
    logout: 'लॉगआउट',
    errPhone: 'सही 10 अंकों का नंबर दर्ज करें',
    errOtp: '6 अंकों का OTP दर्ज करें',
  },
  en: {
    subtitle: 'Your rickshaw instantly',
    passenger: 'Passenger',
    puller: 'Driver',
    phoneLabel: 'Mobile number',
    phonePlaceholder: '98765 43210',
    continue: 'Continue',
    otpSentTo: 'OTP sent to',
    verifyTitle: 'Verify OTP',
    verify: 'Verify',
    adminLogin: 'Admin login',
    back: 'Back',
    pendingTitle: 'Approval Pending',
    pendingBody: 'Your application is under review. Please wait for approval.',
    logout: 'Logout',
    errPhone: 'Enter a valid 10-digit number',
    errOtp: 'Enter all 6 digits',
  },
} as const

// ─── Animation variants ───────────────────────────────────────────────────────

const SLIDE: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.16, ease: 'easeIn' } },
}

// ─── Tiny sub-components ──────────────────────────────────────────────────────

function ChaalakLogo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] shadow-xl"
        style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', boxShadow: '0 8px 32px rgba(245,158,11,0.35)' }}
      >
        <span className="text-4xl leading-none">🛺</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[28px] font-black leading-tight tracking-tight text-white">
          চালক
        </span>
        <span className="text-[11px] font-bold tracking-[0.28em] text-amber-400 uppercase">
          CHAALAK
        </span>
      </div>
    </div>
  )
}

function LangPills({ lang, onChange }: { lang: LanguagePref; onChange: (l: LanguagePref) => void }) {
  const pills: { key: LanguagePref; label: string }[] = [
    { key: 'as', label: 'অসমীয়া' },
    { key: 'hi', label: 'हिन्दी' },
    { key: 'en', label: 'EN' },
  ]
  return (
    <div className="flex gap-2">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all"
          style={
            lang === p.key
              ? { background: '#F59E0B', color: '#1A1A1E' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
      style={{ color: 'rgba(255,255,255,0.45)' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)')}
    >
      <span>←</span>
      <span>{label}</span>
    </button>
  )
}

function AmberButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-2xl py-4 text-[17px] font-black transition-all active:scale-[0.97]"
      style={{
        background: disabled || loading ? 'rgba(245,158,11,0.35)' : '#F59E0B',
        color: disabled || loading ? 'rgba(0,0,0,0.4)' : '#1A1A1E',
        boxShadow: disabled || loading ? 'none' : '0 4px 24px rgba(245,158,11,0.28)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm font-semibold"
      style={{ color: '#F87171' }}
    >
      {msg}
    </motion.p>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()

  const [step, setStep]               = useState<Step>('ROLE_SELECT')
  const [lang, setLang]               = useState<LanguagePref>('as')
  const [selectedRole, setSelectedRole] = useState<SelectedRole>('passenger')
  const [phone, setPhone]             = useState('')
  const [otp, setOtp]                 = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const tx = T[lang]

  // Redirect already-authenticated users away from /auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (!data?.role) return
      if (data.role === 'passenger') router.replace('/')
      else if (data.role === 'puller') router.replace('/dashboard')
      else if (data.role === 'admin') router.replace('/admin/dashboard')
    })
  }, [router])

  // ── Step handlers ─────────────────────────────────────────────────────────

  function goBack(to: Step) {
    setError('')
    setStep(to)
  }

  async function handleSendOtp() {
    const clean = phone.replace(/\s/g, '')
    if (clean.length !== 10) { setError(tx.errPhone); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: `+91${clean}`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('OTP_VERIFY')
  }

  function handleOtpChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[i] = val.slice(-1)
    setOtp(next)
    setError('')
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }

  function handleOtpKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = Array(6).fill('')
    digits.split('').forEach((d, i) => { next[i] = d })
    setOtp(next)
    const focusIdx = Math.min(digits.length, 5)
    otpRefs.current[focusIdx]?.focus()
  }

  async function handleVerify() {
    const token = otp.join('')
    if (token.length !== 6) { setError(tx.errOtp); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const cleanPhone = `+91${phone.replace(/\s/g, '')}`

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      phone: cleanPhone,
      token,
      type: 'sms',
    })
    if (verifyErr) { setError(verifyErr.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Authentication failed'); setLoading(false); return }

    // Check if user already exists in our users table
    const { data: existing } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!existing) {
      // First sign-in — create the row
      await supabase.from('users').insert({
        id: user.id,
        email: user.email ?? `${cleanPhone.replace('+', '')}@phone.local`,
        name: cleanPhone,
        role: selectedRole,
        language_pref: lang,
      })
      // Save role to auth metadata for middleware RBAC
      await supabase.auth.updateUser({ data: { role: selectedRole } })
    } else {
      // Ensure metadata is sync'd for existing users
      await supabase.auth.updateUser({ data: { role: existing.role } })
    }


    const role = existing?.role ?? selectedRole

    if (typeof window !== 'undefined') {
      localStorage.setItem('chaalak_role', role)
      localStorage.setItem('chaalak_lang', lang)
    }

    // Route by role
    if (role === 'passenger') {
      router.push('/')
    } else if (role === 'admin') {
      router.push('/admin/dashboard')
    } else {
      // puller — check approval status
      const { data: pullerRow } = await supabase
        .from('pullers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (pullerRow?.status === 'active') {
        router.push('/dashboard')
      } else {
        setStep('PENDING')
      }
    }

    setLoading(false)
  }

  async function handleDemoLogin(email: string) {
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password: 'test1234',
    })

    if (loginErr) {
      setError(loginErr.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Authentication failed'); setLoading(false); return }

    // Check role from users table
    const { data: existing } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = existing?.role ?? 'passenger'

    // Sync metadata just in case
    await supabase.auth.updateUser({ data: { role } })

    if (typeof window !== 'undefined') {
      localStorage.setItem('chaalak_role', role)
      localStorage.setItem('chaalak_lang', lang)
    }

    if (role === 'passenger') {
      router.push('/')
    } else if (role === 'admin') {
      router.push('/admin/dashboard')
    } else {
      const { data: pullerRow } = await supabase
        .from('pullers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (pullerRow?.status === 'active') {
        router.push('/dashboard')
      } else {
        setStep('PENDING')
      }
    }
    setLoading(false)
  }


  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chaalak_role')
      localStorage.removeItem('chaalak_lang')
    }
    setPhone('')
    setOtp(Array(6).fill(''))
    setError('')
    setStep('ROLE_SELECT')
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  const screens: Record<Step, React.ReactNode> = {

    // ── ROLE_SELECT ──────────────────────────────────────────────────────────
    ROLE_SELECT: (
      <motion.div key="ROLE_SELECT" {...SLIDE} className="flex flex-col items-center gap-7">
        <ChaalakLogo />
        <p className="text-center text-base font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {tx.subtitle}
        </p>
        <LangPills lang={lang} onChange={setLang} />

        <div className="flex w-full flex-col gap-3">
          {/* Passenger */}
          <button
            type="button"
            onClick={() => { setSelectedRole('passenger'); setStep('PHONE_ENTRY') }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-[18px] text-xl font-black transition-all active:scale-[0.97]"
            style={{
              background: '#F59E0B',
              color: '#1A1A1E',
              boxShadow: '0 4px 24px rgba(245,158,11,0.28)',
            }}
          >
            <span className="text-2xl">🙋</span>
            <span>{tx.passenger}</span>
          </button>

          {/* Puller */}
          <button
            type="button"
            onClick={() => { setSelectedRole('puller'); setStep('PHONE_ENTRY') }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-[18px] text-xl font-black transition-all active:scale-[0.97]"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              color: '#FFFFFF',
            }}
          >
            <span className="text-2xl">🛺</span>
            <span>{tx.puller}</span>
          </button>
        </div>

        {/* Admin link */}
        <button
          type="button"
          onClick={() => { setSelectedRole('admin'); setStep('PHONE_ENTRY') }}
          className="text-xs font-medium underline underline-offset-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)')}
        >
          {tx.adminLogin}
        </button>
      </motion.div>
    ),

    // ── PHONE_ENTRY ──────────────────────────────────────────────────────────
    PHONE_ENTRY: (
      <motion.div key="PHONE_ENTRY" {...SLIDE} className="flex w-full flex-col gap-5">
        <BackButton label={tx.back} onClick={() => goBack('ROLE_SELECT')} />

        <div>
          <h2 className="text-2xl font-black text-white">{tx.phoneLabel}</h2>
          <p className="mt-1 text-sm font-semibold capitalize" style={{ color: '#F59E0B' }}>
            {selectedRole === 'passenger' ? tx.passenger : selectedRole === 'puller' ? tx.puller : 'Admin'}
          </p>
        </div>

        {/* Phone input */}
        <div
          className="flex overflow-hidden rounded-2xl transition-all"
          style={{ border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
        >
          <div
            className="flex items-center px-4"
            style={{ borderRight: '1.5px solid rgba(255,255,255,0.12)' }}
          >
            <span className="text-[17px] font-black text-white">+91</span>
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            autoFocus
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp() }}
            placeholder={tx.phonePlaceholder}
            className="flex-1 bg-transparent px-4 py-4 text-[17px] font-black text-white outline-none placeholder:font-semibold"
            style={{ caretColor: '#F59E0B', color: 'white' }}
          />
        </div>

        <ErrorMsg msg={error} />

        <AmberButton
          onClick={handleSendOtp}
          disabled={phone.replace(/\s/g, '').length !== 10}
          loading={loading}
        >
          {tx.continue}
        </AmberButton>

        {/* Demo Login Section */}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Demo Accounts</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          
          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              onClick={() => handleDemoLogin('passenger@test.com')}
              disabled={loading}
              className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-left transition-all active:scale-[0.98]"
            >
              <span className="text-xs font-black text-amber-500 uppercase tracking-tight">Demo Passenger</span>
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            </button>

            <button
              onClick={() => handleDemoLogin('puller@test.com')}
              disabled={loading}
              className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-left transition-all active:scale-[0.98]"
            >
              <span className="text-xs font-black text-emerald-500 uppercase tracking-tight">Demo Puller</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={() => handleDemoLogin('admin@chaalak.app')}
              disabled={loading}
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-left transition-all active:scale-[0.98]"
            >
              <span className="text-xs font-black text-white/60 uppercase tracking-tight">Demo Admin</span>
              <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
            </button>
          </div>
        </div>

      </motion.div>
    ),

    // ── OTP_VERIFY ───────────────────────────────────────────────────────────
    OTP_VERIFY: (
      <motion.div key="OTP_VERIFY" {...SLIDE} className="flex w-full flex-col gap-5">
        <BackButton
          label={tx.back}
          onClick={() => { setOtp(Array(6).fill('')); goBack('PHONE_ENTRY') }}
        />

        <div>
          <h2 className="text-2xl font-black text-white">{tx.verifyTitle}</h2>
          <p className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {tx.otpSentTo}&nbsp;
            <span className="text-white">+91&nbsp;{phone}</span>
          </p>
        </div>

        {/* 6-box OTP input */}
        <div className="flex justify-between gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKey(i, e)}
              onPaste={i === 0 ? handleOtpPaste : undefined}
              className="h-14 w-[46px] rounded-xl text-center text-2xl font-black text-white outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: `2px solid ${digit ? '#F59E0B' : 'rgba(255,255,255,0.14)'}`,
                caretColor: '#F59E0B',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F59E0B'
                e.currentTarget.style.background = 'rgba(245,158,11,0.08)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = digit ? '#F59E0B' : 'rgba(255,255,255,0.14)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
              }}
            />
          ))}
        </div>

        <ErrorMsg msg={error} />

        <AmberButton
          onClick={handleVerify}
          disabled={otp.join('').length !== 6}
          loading={loading}
        >
          {tx.verify}
        </AmberButton>
      </motion.div>
    ),

    // ── PENDING ──────────────────────────────────────────────────────────────
    PENDING: (
      <motion.div key="PENDING" {...SLIDE} className="flex flex-col items-center gap-6 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.3)' }}
        >
          <span className="text-4xl">⏳</span>
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">{tx.pendingTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {tx.pendingBody}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full px-6 py-2.5 text-sm font-semibold transition-all"
          style={{
            border: '1.5px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.5)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'rgba(255,255,255,0.4)'
            el.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'rgba(255,255,255,0.15)'
            el.style.color = 'rgba(255,255,255,0.5)'
          }}
        >
          {tx.logout}
        </button>
      </motion.div>
    ),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1A1E' }}>
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px]">
          <AnimatePresence mode="wait">
            {screens[step]}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
