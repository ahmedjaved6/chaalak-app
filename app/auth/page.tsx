'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { ChevronLeft, Bike, Mail, Phone as PhoneIcon, Clock } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { LanguagePref } from '@/lib/types'
import { useT } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'LANG_SELECT' | 'ENTRY' | 'OTP_VERIFY' | 'PENDING'
type SelectedRole = 'passenger' | 'puller' | 'admin'
type AuthMethod = 'phone' | 'email'
type AuthMode = 'login' | 'signup'

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
  const tx = useT()

  const [step, setStep]                 = useState<Step>('LANG_SELECT')
  const [lang, setLang]                 = useState<LanguagePref>('as')
  
  const [mode, setMode]                 = useState<AuthMode>('login')
  const [method, setMethod]             = useState<AuthMethod>('phone')
  const [selectedRole, setSelectedRole] = useState<SelectedRole | null>(null)
  
  const [phone, setPhone]               = useState('')
  const [email, setEmail]               = useState('')
  
  const [otp, setOtp]                   = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]           = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

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

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Handlers
  function handleLangSelect(l: LanguagePref) {
    setLang(l)
    localStorage.setItem('chaalak_lang', l)
    setStep('ENTRY')
  }

  async function handleSendOtp() {
    let identifier = ''
    if (method === 'phone') {
      const clean = phone.replace(/\s/g, '')
      if (clean.length !== 10) { alert('Enter a valid 10-digit number'); return }
      identifier = `+91${clean}`
    } else {
      if (!email.includes('@')) { alert('Enter a valid email'); return }
      identifier = email
    }

    setLoading(true)
    const supabase = createClient()
    
    let err
    if (method === 'phone') {
      const { error } = await supabase.auth.signInWithOtp({ phone: identifier })
      err = error
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email: identifier, options: { shouldCreateUser: true } })
      err = error
    }

    setLoading(false)
    if (err) { alert(err.message); return }
    
    if (mode === 'signup') {
      localStorage.setItem('chaalak_pending_role', selectedRole || 'passenger')
    }
    
    setResendCooldown(60)
    setStep('OTP_VERIFY')
  }

  async function handleVerify() {
    const token = otp.join('')
    if (token.length !== 6) return
    setLoading(true)
    const supabase = createClient()
    
    let verifyErr
    let cleanPhone = ''
    
    if (method === 'phone') {
      cleanPhone = `+91${phone.replace(/\s/g, '')}`
      const { error } = await supabase.auth.verifyOtp({ phone: cleanPhone, token, type: 'sms' })
      verifyErr = error
    } else {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      verifyErr = error
    }

    if (verifyErr) { alert(verifyErr.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    if (mode === 'login') {
      const { data: existing } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (existing) {
        await supabase.auth.updateUser({ data: { role: existing.role } })
        localStorage.setItem('chaalak_role', existing.role)
        
        if (existing.role === 'passenger') router.replace('/')
        else if (existing.role === 'admin') router.replace('/admin/dashboard')
        else {
          const { data: puller } = await supabase.from('pullers').select('status').eq('user_id', user.id).maybeSingle()
          if (puller?.status === 'active') router.replace('/dashboard')
          else setStep('PENDING')
        }
      } else {
        // First login but no user record? Fallback to passenger
        const pendingRole = localStorage.getItem('chaalak_pending_role') || 'passenger'
        await supabase.from('users').insert({
          id: user.id,
          email: user.email ?? (method === 'phone' ? `${cleanPhone.replace('+', '')}@phone.local` : ''),
          name: method === 'phone' ? cleanPhone : email,
          role: pendingRole,
          language_pref: lang,
        })
        await supabase.auth.updateUser({ data: { role: pendingRole } })
        localStorage.setItem('chaalak_role', pendingRole)
        router.replace('/')
      }
    } else if (mode === 'signup') {
      const pendingRole = localStorage.getItem('chaalak_pending_role') || 'passenger'
      const { data: existing } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      
      if (!existing) {
        const cleanIdentifier = method === 'phone' ? `+91${phone.replace(/\s/g, '')}` : email
        await supabase.from('users').insert({
          id: user.id,
          phone: method === 'phone' ? cleanIdentifier : null,
          email: method === 'email' ? email : `${cleanIdentifier.replace('+', '')}@phone.local`,
          name: '',
          role: pendingRole,
          language_pref: localStorage.getItem('chaalak_lang') || 'as',
        })
        
        if (pendingRole === 'passenger') {
          await supabase.from('passengers').insert({
            user_id: user.id,
            total_rides: 0,
            thumbs_given: 0,
            no_show_count: 0
          })
          await supabase.auth.updateUser({ data: { role: 'passenger' } })
          localStorage.setItem('chaalak_role', 'passenger')
          router.replace('/')
        } else if (pendingRole === 'puller') {
          await supabase.auth.updateUser({ data: { role: 'puller' } })
          localStorage.setItem('chaalak_role', 'puller')
          router.replace('/onboarding')
        }
      } else {
        // Already exists
        await supabase.auth.updateUser({ data: { role: existing.role } })
        localStorage.setItem('chaalak_role', existing.role)
        if (existing.role === 'passenger') router.replace('/')
        else if (existing.role === 'admin') router.replace('/admin/dashboard')
        else {
          const { data: puller } = await supabase.from('pullers').select('status').eq('user_id', user.id).maybeSingle()
          if (puller?.status === 'active') router.replace('/dashboard')
          else setStep('PENDING')
        }
      }
      localStorage.removeItem('chaalak_pending_role')
    }

    setLoading(false)
  }

  async function handleDemoLogin(demoEmail: string) {
    setLoading(true)
    const supabase = createClient()
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: demoEmail, password: 'test1234' })
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

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const next = pasted.split('')
      setOtp(next)
      // auto submit could happen here or in a useEffect checking otp.join('').length
      otpRefs.current[5]?.focus()
    }
  }

  // Auto-submit OTP
  useEffect(() => {
    if (otp.join('').length === 6 && step === 'OTP_VERIFY') {
      handleVerify()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step])


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

    // ── SCREEN 2: ENTRY (LOGIN / SIGNUP) ──────────────────────────────────────────────
    ENTRY: (
      <motion.div key="ENTRY" {...SLIDE} className="flex flex-col min-h-[100dvh] bg-white">
        <div className="px-6 pt-12 pb-4">
          <button onClick={() => setStep('LANG_SELECT')} className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#1D4ED8] active:scale-90 transition-transform mb-6">
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b-[2px] border-[#E4E4E7] px-6">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 pb-3 text-center text-[15px] font-bold font-body transition-colors ${mode === 'login' ? 'border-b-[2px] border-[#1D4ED8] text-[#1D4ED8]' : 'text-[#94A3B8]'} -mb-[2px]`}
          >
            {tx.login}
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={`flex-1 pb-3 text-center text-[15px] font-bold font-body transition-colors ${mode === 'signup' ? 'border-b-[2px] border-[#1D4ED8] text-[#1D4ED8]' : 'text-[#94A3B8]'} -mb-[2px]`}
          >
            {tx.signup}
          </button>
        </div>

        <div className="flex-1 px-6 pt-8 pb-12 overflow-y-auto">
          {mode === 'login' ? (
            <div className="flex flex-col h-full animate-fade-in">
              <h2 className="text-[32px] font-extrabold text-[#0F172A] font-display uppercase leading-tight">{tx.welcome_back}</h2>
              <p className="mt-1 text-[14px] font-medium text-[#64748B] font-body">{tx.login} to your account</p>
              
              <div className="mt-6 flex gap-2">
                <button onClick={() => setMethod('phone')} className={`px-4 py-2 rounded-full text-[12px] font-semibold font-body flex items-center gap-1 border transition-colors ${method === 'phone' ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]' : 'bg-[#F4F4F5] border-[#E4E4E7] text-[#64748B]'}`}>
                  <PhoneIcon size={14} /> {tx.phone_method}
                </button>
                <button onClick={() => setMethod('email')} className={`px-4 py-2 rounded-full text-[12px] font-semibold font-body flex items-center gap-1 border transition-colors ${method === 'email' ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]' : 'bg-[#F4F4F5] border-[#E4E4E7] text-[#64748B]'}`}>
                  <Mail size={14} /> {tx.email_method}
                </button>
              </div>

              <div className="mt-6 relative">
                {method === 'phone' ? (
                  <>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1D4ED8] font-bold text-[20px] font-display tracking-tight">+91</div>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white border-[1.5px] border-[#E4E4E7] rounded-xl py-4 pl-16 pr-4 text-[#0F172A] text-[18px] font-medium font-body tracking-[0.05em] outline-none focus:border-[#1D4ED8] transition-colors"
                      placeholder="00000 00000"
                    />
                  </>
                ) : (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border-[1.5px] border-[#E4E4E7] rounded-xl py-4 px-4 text-[#0F172A] text-[18px] font-medium font-body tracking-[0.05em] outline-none focus:border-[#1D4ED8] transition-colors"
                    placeholder="you@example.com"
                  />
                )}
              </div>

              <button
                onClick={handleSendOtp}
                disabled={loading || (method === 'phone' && phone.length !== 10) || (method === 'email' && !email.includes('@'))}
                className="mt-6 w-full h-14 bg-[#1D4ED8] text-white rounded-[12px] text-[18px] font-bold font-display uppercase transition-all disabled:bg-[#E4E4E7] disabled:text-[#94A3B8]"
              >
                {loading ? '...' : tx.send_otp}
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-fade-in">
              <h2 className="text-[32px] font-extrabold text-[#0F172A] font-display uppercase leading-tight">{tx.create_account}</h2>
              <p className="mt-1 text-[14px] font-medium text-[#64748B] font-body">Join Chaalak</p>
              
              <div className="mt-6">
                <p className="text-[14px] font-semibold text-[#64748B] font-body mb-3">{tx.i_am_a}</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedRole('puller')}
                    className={`flex flex-col items-center p-5 rounded-[16px] border-[1.5px] bg-white transition-all active:scale-[0.98] ${
                      selectedRole === 'puller' ? 'bg-[#EFF6FF] border-[#1D4ED8] border-2' : 'border-[#E4E4E7]'
                    }`}
                  >
                    <div className="flex gap-1.5 mb-3 text-[#1D4ED8]">
                      <RickshawIcon className="h-7 w-7" />
                      <AutoIcon className="h-7 w-7" />
                      <Bike className="h-7 w-7" />
                    </div>
                    <span className="text-[20px] font-bold text-[#0F172A] font-display uppercase">{tx.puller}</span>
                    <span className="mt-1 text-[11px] font-medium text-[#64748B] font-body text-center">{tx.pullerDesc}</span>
                  </button>

                  <button
                    onClick={() => setSelectedRole('passenger')}
                    className={`flex flex-col items-center p-5 rounded-[16px] border-[1.5px] bg-white transition-all active:scale-[0.98] ${
                      selectedRole === 'passenger' ? 'bg-[#EFF6FF] border-[#1D4ED8] border-2' : 'border-[#E4E4E7]'
                    }`}
                  >
                    <div className="mb-3 text-[#1D4ED8]">
                      <HailingPerson className="h-[52px] w-[52px]" />
                    </div>
                    <span className="text-[20px] font-bold text-[#0F172A] font-display uppercase">{tx.passenger}</span>
                    <span className="mt-1 text-[11px] font-medium text-[#64748B] font-body text-center">Book rides instantly</span>
                  </button>
                </div>
              </div>

              {selectedRole && (
                <div className="mt-6 animate-slide-up">
                  <div className="flex gap-2">
                    <button onClick={() => setMethod('phone')} className={`px-4 py-2 rounded-full text-[12px] font-semibold font-body flex items-center gap-1 border transition-colors ${method === 'phone' ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]' : 'bg-[#F4F4F5] border-[#E4E4E7] text-[#64748B]'}`}>
                      <PhoneIcon size={14} /> {tx.phone_method}
                    </button>
                    <button onClick={() => setMethod('email')} className={`px-4 py-2 rounded-full text-[12px] font-semibold font-body flex items-center gap-1 border transition-colors ${method === 'email' ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]' : 'bg-[#F4F4F5] border-[#E4E4E7] text-[#64748B]'}`}>
                      <Mail size={14} /> {tx.email_method}
                    </button>
                  </div>

                  <div className="mt-4 relative">
                    {method === 'phone' ? (
                      <>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1D4ED8] font-bold text-[20px] font-display tracking-tight">+91</div>
                        <input
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-white border-[1.5px] border-[#E4E4E7] rounded-xl py-4 pl-16 pr-4 text-[#0F172A] text-[18px] font-medium font-body tracking-[0.05em] outline-none focus:border-[#1D4ED8] transition-colors"
                          placeholder="00000 00000"
                        />
                      </>
                    ) : (
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border-[1.5px] border-[#E4E4E7] rounded-xl py-4 px-4 text-[#0F172A] text-[18px] font-medium font-body tracking-[0.05em] outline-none focus:border-[#1D4ED8] transition-colors"
                        placeholder="you@example.com"
                      />
                    )}
                  </div>

                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !selectedRole || (method === 'phone' && phone.length !== 10) || (method === 'email' && !email.includes('@'))}
                    className="mt-6 w-full h-14 bg-[#1D4ED8] text-white rounded-[12px] text-[18px] font-bold font-display uppercase transition-all disabled:bg-[#E4E4E7] disabled:text-[#94A3B8]"
                  >
                    {loading ? '...' : tx.create_account}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SCREEN 3: DEMO ACCOUNTS */}
          <div className="mt-12">
            <div className="flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-[#E4E4E7]" />
              <span className="text-[11px] font-normal text-[#94A3B8] font-body">{tx.demo_accounts}</span>
              <div className="h-[1px] flex-1 bg-[#E4E4E7]" />
            </div>

            <div className="mt-6 flex justify-center gap-2">
              <DemoBtn label="Passenger" color="bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]" onClick={() => handleDemoLogin('passenger@test.com')} />
              <DemoBtn label="Puller" color="bg-[#DCFCE7] border-[#16A34A] text-[#16A34A]" onClick={() => handleDemoLogin('puller@test.com')} />
              <DemoBtn label="Admin" color="bg-[#F4F4F5] border-[#D1D5DB] text-[#64748B]" onClick={() => handleDemoLogin('admin@chaalak.app')} />
            </div>
          </div>
        </div>
      </motion.div>
    ),

    // ── SCREEN 4: OTP Verify ───────────────────────────────────────────────
    OTP_VERIFY: (
      <motion.div key="OTP_VERIFY" {...SLIDE} className="flex flex-col min-h-[100dvh] px-6 pt-12 bg-white">
        <button onClick={() => setStep('ENTRY')} className="h-10 w-10 flex items-center justify-center rounded-full bg-[#F4F4F5] text-[#1D4ED8] active:scale-90 transition-transform">
          <ChevronLeft size={24} />
        </button>

        <div className="mt-8 flex justify-center">
          <div className="h-[80px] w-[80px] rounded-full bg-[#EFF6FF] flex items-center justify-center">
            {method === 'email' ? <Mail size={48} className="text-[#1D4ED8]" /> : <PhoneIcon size={48} className="text-[#1D4ED8]" />}
          </div>
        </div>

        <h2 className="mt-8 text-[28px] font-extrabold text-[#0F172A] font-display uppercase leading-tight text-center">
          {method === 'phone' ? `Enter the code sent to +91${phone.slice(-4).padStart(10, '*')}` : `Enter the code sent to ${email.substring(0, 2)}***@${email.split('@')[1]}`}
        </h2>
        <p className="mt-2 text-[13px] font-medium text-[#64748B] font-body text-center">6-digit code · expires in 10 min</p>

        <div className="mt-10 flex justify-center gap-2" onPaste={handlePaste}>
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
              className={`w-[48px] h-[60px] bg-white border-[1.5px] rounded-xl text-center text-[#1D4ED8] text-[28px] font-extrabold font-display outline-none transition-all ${digit ? 'bg-[#EFF6FF] border-[#1D4ED8]' : 'border-[#E4E4E7]'} focus:border-[#1D4ED8] focus:border-2 focus:shadow-[0_0_0_3px_#EFF6FF]`}
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={otp.join('').length !== 6 || loading}
          className="mt-8 w-full h-14 bg-[#1D4ED8] text-white rounded-[12px] text-[18px] font-bold font-display uppercase transition-all disabled:bg-[#E4E4E7] disabled:text-[#94A3B8]"
        >
          {loading ? '...' : tx.verify_otp}
        </button>

        <div className="mt-8 text-center">
          <span className="text-[12px] font-normal text-[#64748B] font-body">Didn&apos;t receive it? </span>
          <button 
            onClick={handleSendOtp} 
            disabled={resendCooldown > 0} 
            className="text-[12px] font-semibold text-[#1D4ED8] underline disabled:text-[#94A3B8] disabled:no-underline"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          </button>
        </div>
      </motion.div>
    ),

    // ── PENDING Screen ─────────────────────────────────────────────────────
    PENDING: (
      <motion.div key="PENDING" {...SLIDE} className="flex flex-col items-center justify-center min-h-[100dvh] px-8 text-center bg-white">
        <div className="h-[80px] w-[80px] bg-[#FEF3C7] rounded-full flex items-center justify-center mb-8">
          <Clock size={48} className="text-[#D97706]" />
        </div>
        <h2 className="text-[28px] font-extrabold text-[#0F172A] font-display uppercase mb-2 leading-tight">Application Submitted</h2>
        <p className="text-[#64748B] font-body text-[14px] leading-relaxed mb-6 max-w-[280px]">
          Your puller profile is being reviewed. You&apos;ll be able to start accepting rides once approved.
        </p>
        
        <button
          onClick={() => {
            const supabase = createClient()
            supabase.auth.signOut().then(() => router.push('/auth'))
          }}
          className="w-full h-12 bg-[#F4F4F5] rounded-[12px] text-[#0F172A] text-[14px] font-bold font-body transition-colors mt-6"
        >
          {tx.logout}
        </button>
        
        <p className="mt-8 text-[12px] font-normal text-[#94A3B8] font-body">Questions? WhatsApp: +91XXXXXXXXXX</p>
      </motion.div>
    ),
  }

  return (
    <div className="min-h-[100dvh] bg-white overflow-hidden select-none">
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
      className={`px-4 py-3 rounded-xl text-[12px] font-bold font-body border transition-all active:scale-[0.95] ${color}`}
    >
      {label}
    </button>
  )
}
