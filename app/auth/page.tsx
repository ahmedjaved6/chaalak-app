'use client'

import { useState, useRef, useEffect } from 'react'

import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { LanguagePref } from '@/lib/types'
import { ChevronLeft, ArrowRight, ShieldCheck, Bike } from 'lucide-react'


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
    india: '+91 India',
    sendOtp: 'OTP পঠাওক',
    verifyOtp: 'OTP দিয়ক',
    resend: 'পুনৰ পঠাওক',
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
    india: '+91 India',
    sendOtp: 'OTP भेजें',
    verifyOtp: 'OTP दर्ज करें',
    resend: 'फिर से भेजें',
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
    india: '+91 India',
    sendOtp: 'OTP পাঠান',
    verifyOtp: 'OTP দিন',
    resend: 'আবার পাঠান',
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
    india: '+91 India',
    sendOtp: 'Send OTP',
    verifyOtp: 'Enter OTP',
    resend: 'Resend OTP',
    verify: 'Verify',
    demoAccounts: 'Demo Accounts',
    pendingTitle: 'Approval Pending',
    pendingBody: 'Your application is under review. Please wait for approval.',
    logout: 'Logout',
  },
} as const

// ─── SVGs ─────────────────────────────────────────────────────────────────────

function RickshawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

// ─── Animation variants ───────────────────────────────────────────────────────

const SLIDE: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } },
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()

  const [step, setStep]               = useState<Step>('LANG_SELECT')
  const [lang, setLang]               = useState<LanguagePref>('as')
  const [selectedRole, setSelectedRole] = useState<SelectedRole | null>(null)
  const [phone, setPhone]             = useState('')
  const [otp, setOtp]                 = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]         = useState(false)


  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const tx = T[lang === 'bn' ? 'bn' : lang === 'hi' ? 'hi' : lang === 'as' ? 'as' : 'en']

  // Auth check & init
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

  // ── Handlers ───────────────────────────────────────────────────────────────

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


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: existing } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = existing?.role ?? 'passenger'
    await supabase.auth.updateUser({ data: { role } })
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

  function handleOtpChange(i: number, val: string) {
    const next = [...otp]
    next[i] = val.slice(-1)
    setOtp(next)
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  const screens: Record<Step, React.ReactNode> = {

    // ── LANG_SELECT ─────────────────────────────────────────────────────────
    LANG_SELECT: (
      <motion.div key="LANG_SELECT" {...SLIDE} className="flex flex-col items-center justify-center min-h-[100dvh] px-8">
        <div className="mb-12 flex flex-col items-center">
          <div className="h-[72px] w-[72px] bg-[#F59E0B] rounded-[20px] flex items-center justify-center shadow-[0_8px_32px_rgba(245,158,11,0.3)]">
            <RickshawIcon className="h-10 w-10 text-[#1A1A1E]" />
          </div>
          <h1 className="mt-4 text-[40px] font-black text-white font-nunito tracking-tight">CHAALAK</h1>
          <p className="text-[18px] font-bold text-[#F59E0B] font-noto-bengali">চালক</p>
        </div>

        <div className="w-full max-w-[280px] space-y-3">
          {[
            { l: 'as', label: 'অসমীয়া', font: 'font-noto-bengali' },
            { l: 'hi', label: 'हिन्दी', font: 'font-noto-devanagari' },
            { l: 'bn', label: 'বাংলা', font: 'font-noto-bengali' },
            { l: 'en', label: 'English', font: 'font-nunito' },
          ].map((item) => (
            <button
              key={item.l}
              onClick={() => handleLangSelect(item.l as LanguagePref)}
              className={`w-full py-4 px-6 bg-[#2A2A2E] border-[1.5px] border-[#3A3A3E] rounded-[14px] text-white text-[18px] font-bold transition-all active:scale-[0.98] hover:border-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B15] ${item.font}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </motion.div>
    ),

    // ── ROLE_SELECT ─────────────────────────────────────────────────────────
    ROLE_SELECT: (
      <motion.div key="ROLE_SELECT" {...SLIDE} className="flex flex-col min-h-[100dvh] px-5 pt-12">
        <button onClick={() => setStep('LANG_SELECT')} className="p-2 -ml-2 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={28} />
        </button>

        <div className="mt-8 text-center">
          <p className="text-[#8A8A9A] font-bold text-[16px] font-nunito uppercase tracking-widest">{tx.chooseRole}</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4">
          {/* Puller Card */}
          <button
            onClick={() => setSelectedRole('puller')}
            className={`flex flex-col items-center p-6 rounded-[20px] border-2 transition-all active:scale-[0.98] ${
              selectedRole === 'puller' ? 'bg-[#F59E0B10] border-[#F59E0B]' : 'bg-[#2A2A2E] border-[#3A3A3E]'
            }`}
          >
            <span className="text-[18px] font-black text-white font-nunito">{tx.puller}</span>
            <div className="my-8 flex items-center justify-center gap-2 text-[#F59E0B]">
              <RickshawIcon className="h-8 w-8" />
              <AutoIcon className="h-8 w-8" />
              <Bike className="h-8 w-8" />
            </div>
            <span className="text-[11px] font-bold text-gray-500 font-nunito tracking-tighter">{tx.pullerDesc}</span>
          </button>

          {/* Passenger Card */}
          <button
            onClick={() => setSelectedRole('passenger')}
            className={`flex flex-col items-center p-6 rounded-[20px] border-2 transition-all active:scale-[0.98] ${
              selectedRole === 'passenger' ? 'bg-[#3B82F610] border-[#3B82F6]' : 'bg-[#2A2A2E] border-[#3A3A3E]'
            }`}
          >
            <span className="text-[18px] font-black text-white font-nunito">{tx.passenger}</span>
            <div className="my-8 flex items-center justify-center text-amber-500">
              <HailingPerson className="h-16 w-16" />
            </div>
            <span className="text-[11px] font-bold text-gray-500 font-nunito tracking-tighter">{tx.passengerDesc}</span>
          </button>
        </div>

        <div className="mt-auto pb-12">
          <button
            disabled={!selectedRole}
            onClick={() => setStep('PHONE_LOGIN')}
            className={`w-full py-4 rounded-[14px] flex items-center justify-center gap-2 text-[18px] font-black transition-all ${
              selectedRole ? 'bg-[#F59E0B] text-[#1A1A1E]' : 'bg-[#F59E0B]/50 text-[#1A1A1E]/50'
            }`}
          >
            {tx.continue} <ArrowRight size={20} />
          </button>
        </div>
      </motion.div>
    ),

    // ── PHONE_LOGIN ─────────────────────────────────────────────────────────
    PHONE_LOGIN: (
      <motion.div key="PHONE_LOGIN" {...SLIDE} className="flex flex-col min-h-[100dvh] px-5 pt-12">
        <button onClick={() => setStep('ROLE_SELECT')} className="p-2 -ml-2 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={28} />
        </button>

        <h2 className="mt-8 text-[28px] font-black text-white font-nunito leading-tight">{tx.enterPhone}</h2>
        <p className="mt-2 text-[13px] font-bold text-[#8A8A9A] uppercase tracking-widest">{tx.india}</p>

        <div className="mt-8 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F59E0B] font-black text-[20px]">+91</div>
          <input
            type="tel"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-[#2A2A2E] border-[1.5px] border-[#3A3A3E] rounded-xl py-4 pl-16 pr-4 text-white text-[20px] font-bold font-nunito tracking-[0.05em] outline-none focus:border-[#F59E0B] transition-colors"
            placeholder="00000 00000"
          />
        </div>

        <button
          onClick={handleSendOtp}
          disabled={phone.length !== 10 || loading}
          className="mt-6 w-full bg-[#F59E0B] text-[#1A1A1E] py-4 rounded-xl text-[18px] font-black font-nunito transition-all disabled:opacity-50"
        >
          {loading ? '...' : tx.sendOtp}
        </button>

        <div className="mt-12">
          <div className="flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{tx.demoAccounts}</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          <div className="mt-6 flex gap-3">
            <DemoBtn label="Passenger" color="bg-amber-500/20 text-amber-500" onClick={() => handleDemoLogin('passenger@test.com')} />
            <DemoBtn label="Puller" color="bg-emerald-500/20 text-emerald-500" onClick={() => handleDemoLogin('puller@test.com')} />
            <DemoBtn label="Admin" color="bg-white/5 text-white/60" onClick={() => handleDemoLogin('admin@chaalak.app')} />
          </div>
        </div>
      </motion.div>
    ),

    // ── OTP_VERIFY ──────────────────────────────────────────────────────────
    OTP_VERIFY: (
      <motion.div key="OTP_VERIFY" {...SLIDE} className="flex flex-col min-h-[100dvh] px-5 pt-12">
        <button onClick={() => setStep('PHONE_LOGIN')} className="p-2 -ml-2 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={28} />
        </button>

        <h2 className="mt-8 text-[28px] font-black text-white font-nunito leading-tight">{tx.verifyOtp}</h2>
        <p className="mt-2 text-[14px] font-bold text-white/40">Sent to +91 {phone}</p>

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
              className="w-[44px] h-[56px] bg-[#2A2A2E] border-[1.5px] border-[#3A3A3E] rounded-xl text-center text-[#F59E0B] text-[28px] font-black font-nunito outline-none focus:border-[#F59E0B] transition-colors"
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={otp.join('').length !== 6 || loading}
          className="mt-8 w-full bg-[#F59E0B] text-[#1A1A1E] py-4 rounded-xl text-[18px] font-black font-nunito transition-all disabled:opacity-50"
        >
          {loading ? '...' : tx.verify}
        </button>

        <button className="mt-6 text-[12px] font-bold text-white/40 uppercase tracking-widest mx-auto">
          {tx.resend}
        </button>
      </motion.div>
    ),

    // ── PENDING ──────────────────────────────────────────────────────────────
    PENDING: (
      <motion.div key="PENDING" {...SLIDE} className="flex flex-col items-center justify-center min-h-[100dvh] px-8 text-center">
        <div className="h-20 w-20 bg-amber-500/10 rounded-full flex items-center justify-center border-2 border-amber-500/20 mb-8">
          <ShieldCheck className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-[28px] font-black text-white font-nunito mb-2">{tx.pendingTitle}</h2>
        <p className="text-white/50 leading-relaxed mb-12">{tx.pendingBody}</p>
        <button
          onClick={() => {
            const supabase = createClient()
            supabase.auth.signOut().then(() => router.push('/auth'))
          }}
          className="px-8 py-3 rounded-full border border-white/10 text-white/40 text-[14px] font-bold hover:text-white transition-colors"
        >
          {tx.logout}
        </button>
      </motion.div>
    ),
  }

  return (
    <div className="min-h-[100dvh] bg-[#1A1A1E] overflow-hidden select-none">
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
      className={`flex-1 py-3 px-2 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all active:scale-[0.95] ${color}`}
    >
      {label}
    </button>
  )
}
