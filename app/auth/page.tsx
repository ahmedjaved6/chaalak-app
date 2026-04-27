'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { ChevronLeft, ArrowRight, ShieldCheck, Bike } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { LanguagePref } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'LANG_SELECT' | 'ROLE_SELECT' | 'PHONE_LOGIN' | 'OTP_VERIFY' | 'PENDING'
type SelectedRole = 'passenger' | 'puller' | 'admin'

// ─── Translations ──────────────────────────────────────────────────────────────

const T = {
  as: {
    chooseRole: 'আপুনি কোন?',
    puller: 'চালক',
    passenger: 'যাত্ৰী',
    pullerDesc: 'ৰিক্সা · অট\' · বাইক',
    passengerDesc: 'যাত্ৰা বুক কৰক',
    continue: 'আগবাঢ়ক',
    enterPhone: 'আপোনাৰ নম্বৰ দিয়ক',
    sendOtp: 'OTP পঠাওক',
    verifyOtp: 'OTP দিয়ক',
    verify: 'যাচাই কৰক',
    demoAccounts: 'Demo Accounts',
    pendingTitle: 'অনুমোদনৰ বাবে অপেক্ষাৰত',
    pendingBody: 'আপোনাৰ আবেদন পৰ্যালোচনা কৰা হৈছে। অনুগ্ৰহ কৰি অপেক্ষা কৰক।',
    logout: 'লগআউট',
  },
  hi: {
    chooseRole: 'आप कौन हैं?',
    puller: 'चालक',
    passenger: 'यात्री',
    pullerDesc: 'रिक्शा · ऑटो · बाइक',
    passengerDesc: 'यात्रा बुक करें',
    continue: 'आगे बढ़ें',
    enterPhone: 'अपना नंबर दर्ज करें',
    sendOtp: 'OTP भेजें',
    verifyOtp: 'OTP दर्ज करें',
    verify: 'सत्यापित करें',
    demoAccounts: 'Demo Accounts',
    pendingTitle: 'अनुमोदन लंबित',
    pendingBody: 'आपका आवेदन समीक्षाधीन है। कृपया प्रतीक्षा करें।',
    logout: 'लॉगआउट',
  },
  bn: {
    chooseRole: 'আপনি কে?',
    puller: 'চালক',
    passenger: 'যাত্রী',
    pullerDesc: 'রিকশা · অটো · বাইক',
    passengerDesc: 'যাত্রা বুক করুন',
    continue: 'এগিয়ে যান',
    enterPhone: 'আপনার নম্বর দিন',
    sendOtp: 'OTP পাঠান',
    verifyOtp: 'OTP দিন',
    verify: 'যাচাই করুন',
    demoAccounts: 'Demo Accounts',
    pendingTitle: 'অনুমোদনের অপেক্ষায়',
    pendingBody: 'আপনার আবেদন পর্যালোচনা করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।',
    logout: 'লগআউট',
  },
  en: {
    chooseRole: 'Who are you?',
    puller: 'Puller',
    passenger: 'Passenger',
    pullerDesc: 'Rickshaw · Auto · Bike',
    passengerDesc: 'Book a ride',
    continue: 'Continue',
    enterPhone: 'Enter your number',
    sendOtp: 'Send OTP',
    verifyOtp: 'Enter OTP',
    verify: 'Verify',
    demoAccounts: 'Demo Accounts',
    pendingTitle: 'Approval Pending',
    pendingBody: 'Your application is under review. Please wait for approval.',
    logout: 'Logout',
  },
} as const

// ─── Icons ────────────────────────────────────────────────────────────────────

function RickshawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <path d="M15 17.5h-6" />
      <path d="M5.5 14V7a2 2 0 0 1 2-2H12" />
      <path d="M18.5 14v-4a2 2 0 0 0-2-2h-3" />
      <path d="M12 5v12.5" />
    </svg>
  )
}

function AutoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 11l2-2h14l2 2v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7z" />
      <path d="M5 9V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}

function HailingPerson({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5" r="3" />
      <path d="M12 8v8" />
      <path d="M7 21l2-5 3-1 3 1 2 5" />
      <path d="M5 11l4-2 3 1 3-1 4 2" />
      <path d="M12 16v5" />
    </svg>
  )
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const SLIDE: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()

  const [step, setStep]                 = useState<Step>('LANG_SELECT')
  const [lang, setLang]                 = useState<LanguagePref>('as')
  const [selectedRole, setSelectedRole] = useState<SelectedRole | null>(null)
  const [phone, setPhone]               = useState('')
  const [otp, setOtp]                   = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]           = useState(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const tx = T[lang === 'bn' ? 'bn' : lang === 'hi' ? 'hi' : lang === 'as' ? 'as' : 'en']

  // Auth initialization
  useEffect(() => {
    const savedLang = localStorage.getItem('chaalak_lang') as LanguagePref
    if (savedLang) setLang(savedLang)

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (!data?.role) return
      if (data.role === 'passenger') router.replace('/')
      else if (data.role === 'puller') router.replace('/dashboard')
      else if (data.role === 'admin') router.replace('/admin/dashboard')
    })
  }, [router])

  // Handlers
  function handleLangSelect(l: LanguagePref) {
    setLang(l)
    localStorage.setItem('chaalak_lang', l)
    setStep('ROLE_SELECT')
  }

  async function handleSendOtp() {
    const clean = phone.replace(/\s/g, '')
    if (clean.length !== 10) { alert('Enter a valid 10-digit number'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({ phone: `+91${clean}` })
    setLoading(false)
    if (err) { alert(err.message); return }
    setStep('OTP_VERIFY')
  }

  async function handleVerify() {
    const token = otp.join('')
    if (token.length !== 6) return
    setLoading(true)
    const supabase = createClient()
    const cleanPhone = `+91${phone.replace(/\s/g, '')}`

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      phone: cleanPhone,
      token,
      type: 'sms',
    })
    if (verifyErr) { alert(verifyErr.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: existing } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (!existing) {
      await supabase.from('users').insert({
        id: user.id,
        email: user.email ?? `${cleanPhone.replace('+', '')}@phone.local`,
        name: cleanPhone,
        role: selectedRole ?? 'passenger',
        language_pref: lang,
      })
      await supabase.auth.updateUser({ data: { role: selectedRole ?? 'passenger' } })
    } else {
      await supabase.auth.updateUser({ data: { role: existing.role } })
    }

    const role = existing?.role ?? selectedRole ?? 'passenger'
    localStorage.setItem('chaalak_role', role)
    localStorage.setItem('chaalak_lang', lang)

    if (role === 'passenger') router.push('/')
    else if (role === 'admin') router.push('/admin/dashboard')
    else {
      const { data: puller } = await supabase.from('pullers').select('status').eq('user_id', user.id).maybeSingle()
      if (puller?.status === 'active') router.push('/dashboard')
      else setStep('PENDING')
    }
    setLoading(false)
  }

  async function handleDemoLogin(email: string) {
    setLoading(true)
    const supabase = createClient()
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: 'test1234' })
    if (loginErr) { alert(loginErr.message); setLoading(false); return }

    const { data: { user: demoUser } } = await supabase.auth.getUser()
    if (!demoUser) { setLoading(false); return }
 
    const { data: existingUser } = await supabase.from('users').select('role').eq('id', demoUser.id).maybeSingle()
    const role = existingUser?.role ?? 'passenger'
    await supabase.auth.updateUser({ data: { role } })
    localStorage.setItem('chaalak_role', role)
    localStorage.setItem('chaalak_lang', lang)

    if (role === 'passenger') router.push('/')
    else if (role === 'admin') router.push('/admin/dashboard')
    else {
      const { data: puller } = await supabase.from('pullers').select('status').eq('user_id', demoUser.id).maybeSingle()
      if (puller?.status === 'active') router.push('/dashboard')
      else setStep('PENDING')
    }
    setLoading(false)
  }

  function handleOtpChange(i: number, val: string) {
    const next = [...otp]
    next[i] = val.slice(-1)
    setOtp(next)
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }

  // Screens
  const screens: Record<Step, React.ReactNode> = {
    // ── SCREEN 1: Language Select ──────────────────────────────────────────
    LANG_SELECT: (
      <motion.div key="LANG_SELECT" {...SLIDE} className="flex flex-col items-center justify-center min-h-[100dvh] px-8 bg-[#FAFAFA]">
        <div className="mb-12 flex flex-col items-center">
          <div className="h-[72px] w-[72px] bg-[#1D4ED8] rounded-[20px] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <RickshawIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-4 text-[40px] font-extrabold text-[#0F172A] font-display tracking-tight uppercase">CHAALAK</h1>
          <p className="text-[20px] font-bold text-[#1D4ED8] font-display">চালক</p>
        </div>

        <div className="w-full max-w-[320px] space-y-3">
          {[
            { l: 'as', label: 'অসমীয়া', font: 'font-as' },
            { l: 'bn', label: 'বাংলা', font: 'font-as' },
            { l: 'hi', label: 'हिन्दी', font: 'font-as' },
            { l: 'en', label: 'English', font: 'font-body' },
          ].map((item) => (
            <button
              key={item.l}
              onClick={() => handleLangSelect(item.l as LanguagePref)}
              className={`w-full py-4 px-6 bg-white border-[1.5px] border-[#E4E4E7] rounded-[12px] text-[#0F172A] text-[18px] font-semibold transition-all active:scale-[0.98] ${
                lang === item.l ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8] border-2' : ''
              } ${item.font}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </motion.div>
    ),

    // ── SCREEN 2: Role Select ──────────────────────────────────────────────
    ROLE_SELECT: (
      <motion.div key="ROLE_SELECT" {...SLIDE} className="flex flex-col min-h-[100dvh] px-6 pt-12 bg-[#FAFAFA]">
        <button onClick={() => setStep('LANG_SELECT')} className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#1D4ED8] active:scale-90 transition-transform">
          <ChevronLeft size={24} />
        </button>

        <h2 className="mt-10 text-[28px] font-bold text-[#0F172A] font-display uppercase">{tx.chooseRole}</h2>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {/* PULLER card */}
          <button
            onClick={() => setSelectedRole('puller')}
            className={`flex flex-col items-center p-6 rounded-[16px] border-[1.5px] bg-white transition-all active:scale-[0.98] ${
              selectedRole === 'puller' ? 'bg-[#EFF6FF] border-[#1D4ED8] border-2' : 'border-[#E4E4E7]'
            }`}
          >
            <div className="flex gap-2 mb-8 text-[#1D4ED8]">
              <RickshawIcon className="h-8 w-8" />
              <AutoIcon className="h-8 w-8" />
              <Bike className="h-8 w-8" />
            </div>
            <span className="text-[20px] font-bold text-[#0F172A] font-display uppercase">{tx.puller}</span>
            <span className="mt-1 text-[11px] font-bold text-[#94A3B8] font-display tracking-tight text-center">{tx.pullerDesc}</span>
          </button>

          {/* PASSENGER card */}
          <button
            onClick={() => setSelectedRole('passenger')}
            className={`flex flex-col items-center p-6 rounded-[16px] border-[1.5px] bg-white transition-all active:scale-[0.98] ${
              selectedRole === 'passenger' ? 'bg-[#EFF6FF] border-[#1D4ED8] border-2' : 'border-[#E4E4E7]'
            }`}
          >
            <div className="mb-8 text-[#1D4ED8]">
              <HailingPerson className="h-14 w-14" />
            </div>
            <span className="text-[20px] font-bold text-[#0F172A] font-display uppercase">{tx.passenger}</span>
            <span className="mt-1 text-[11px] font-bold text-[#94A3B8] font-display tracking-tight text-center">{tx.passengerDesc}</span>
          </button>
        </div>

        <div className="mt-auto pb-12">
          <button
            disabled={!selectedRole}
            onClick={() => setStep('PHONE_LOGIN')}
            className={`w-full h-14 rounded-[12px] flex items-center justify-center gap-2 text-[18px] font-bold font-display uppercase transition-all ${
              selectedRole ? 'bg-[#1D4ED8] text-white' : 'bg-[#E4E4E7] text-[#94A3B8]'
            }`}
          >
            {tx.continue} <ArrowRight size={20} />
          </button>
        </div>
      </motion.div>
    ),

    // ── SCREEN 3: Phone Login ──────────────────────────────────────────────
    PHONE_LOGIN: (
      <motion.div key="PHONE_LOGIN" {...SLIDE} className="flex flex-col min-h-[100dvh] px-6 pt-12 bg-[#FAFAFA]">
        <button onClick={() => setStep('ROLE_SELECT')} className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#1D4ED8] active:scale-90 transition-transform">
          <ChevronLeft size={24} />
        </button>

        <h2 className="mt-10 text-[32px] font-extrabold text-[#0F172A] font-display uppercase leading-tight">{tx.enterPhone}</h2>

        <div className="mt-10 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1D4ED8] font-bold text-[20px] font-display tracking-tight">+91</div>
          <input
            type="tel"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-white border-[1.5px] border-[#E4E4E7] rounded-xl py-4 pl-16 pr-4 text-[#0F172A] text-[18px] font-medium font-body tracking-[0.05em] outline-none focus:border-[#1D4ED8] transition-colors"
            placeholder="00000 00000"
          />
        </div>

        <button
          onClick={handleSendOtp}
          disabled={phone.length !== 10 || loading}
          className="mt-6 w-full h-14 bg-[#1D4ED8] text-white rounded-[12px] text-[18px] font-bold font-display uppercase transition-all disabled:bg-[#E4E4E7] disabled:text-[#94A3B8]"
        >
          {loading ? '...' : tx.sendOtp}
        </button>

        <div className="mt-12">
          <div className="flex items-center gap-3">
            <div className="h-[1.5px] flex-1 bg-[#E4E4E7]" />
            <span className="text-[11px] font-normal text-[#94A3B8] font-body uppercase tracking-wider">Demo Accounts</span>
            <div className="h-[1.5px] flex-1 bg-[#E4E4E7]" />
          </div>

          <div className="mt-6 flex gap-2">
            <DemoBtn label="Passenger" color="bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]" onClick={() => handleDemoLogin('passenger@test.com')} />
            <DemoBtn label="Puller" color="bg-[#DCFCE7] border-[#16A34A] text-[#16A34A]" onClick={() => handleDemoLogin('puller@test.com')} />
            <DemoBtn label="Admin" color="bg-[#F4F4F5] border-[#D1D5DB] text-[#64748B]" onClick={() => handleDemoLogin('admin@chaalak.app')} />
          </div>
        </div>
      </motion.div>
    ),

    // ── SCREEN 4: OTP Verify ───────────────────────────────────────────────
    OTP_VERIFY: (
      <motion.div key="OTP_VERIFY" {...SLIDE} className="flex flex-col min-h-[100dvh] px-6 pt-12 bg-[#FAFAFA]">
        <button onClick={() => setStep('PHONE_LOGIN')} className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#1D4ED8] active:scale-90 transition-transform">
          <ChevronLeft size={24} />
        </button>

        <h2 className="mt-10 text-[32px] font-extrabold text-[#0F172A] font-display uppercase leading-tight">{tx.verifyOtp}</h2>
        <p className="mt-2 text-[14px] font-medium text-[#64748B] font-body">Sent to +91 {phone}</p>

        <div className="mt-12 flex justify-between gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el }}
              type="tel"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
              }}
              className="w-[48px] h-[60px] bg-white border-[1.5px] border-[#E4E4E7] rounded-xl text-center text-[#1D4ED8] text-[28px] font-extrabold font-display outline-none focus:border-[#1D4ED8] focus:border-2 transition-all"
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={otp.join('').length !== 6 || loading}
          className="mt-8 w-full h-14 bg-[#1D4ED8] text-white rounded-[12px] text-[18px] font-bold font-display uppercase transition-all disabled:bg-[#E4E4E7] disabled:text-[#94A3B8]"
        >
          {loading ? '...' : tx.verify}
        </button>
      </motion.div>
    ),

    // ── PENDING Screen ─────────────────────────────────────────────────────
    PENDING: (
      <motion.div key="PENDING" {...SLIDE} className="flex flex-col items-center justify-center min-h-[100dvh] px-8 text-center bg-[#FAFAFA]">
        <div className="h-20 w-20 bg-[#EFF6FF] rounded-full flex items-center justify-center border-2 border-blue-100 mb-8">
          <ShieldCheck className="h-10 w-10 text-[#1D4ED8]" />
        </div>
        <h2 className="text-[32px] font-extrabold text-[#0F172A] font-display uppercase mb-2 leading-tight">{tx.pendingTitle}</h2>
        <p className="text-[#64748B] font-body leading-relaxed mb-12">{tx.pendingBody}</p>
        <button
          onClick={() => {
            const supabase = createClient()
            supabase.auth.signOut().then(() => router.push('/auth'))
          }}
          className="px-8 py-3 rounded-full border border-[#E4E4E7] text-[#94A3B8] text-[14px] font-bold font-body hover:text-[#0F172A] transition-colors"
        >
          {tx.logout}
        </button>
      </motion.div>
    ),
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] overflow-hidden select-none">
      <AnimatePresence mode="wait">
        {screens[step]}
      </AnimatePresence>
    </div>
  )
}

function DemoBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-1 rounded-[8px] text-[12px] font-semibold border-1.5 transition-all active:scale-[0.95] ${color}`}
    >
      {label}
    </button>
  )
}
