'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const schema = z.object({
  email:    z.string().email('Unesite validan email'),
  password: z.string().min(6, 'Minimalno 6 karaktera'),
})
type Form = z.infer<typeof schema>

// ── Finance neural network canvas ─────────────────────────────────────────────
const NODE_LABELS = [
  'KPI', 'Score', 'AI', 'Risk', 'ROI', 'EBITDA', 'Cash', 'Trend',
  'Audit', 'P&L', 'FCF', 'ROE', 'D/E', 'ML', 'NLP', 'API',
  'Bilans', 'Analiza', 'GPT', 'Data',
]

interface Node {
  x: number; y: number; vx: number; vy: number
  r: number; label: string; alpha: number; phase: number
}
interface Pulse { from: number; to: number; t: number }

function FinanceCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init nodes spread across canvas
    const nodes: Node[] = NODE_LABELS.map(label => ({
      x: 60 + Math.random() * (canvas.width  - 120),
      y: 60 + Math.random() * (canvas.height - 120),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r:  20 + Math.random() * 10,
      label,
      alpha: 0.35 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    }))

    const pulses: Pulse[] = []
    let frame = 0
    let animId: number

    const spawnPulse = () => {
      const from = Math.floor(Math.random() * nodes.length)
      let to = Math.floor(Math.random() * nodes.length)
      while (to === from) to = Math.floor(Math.random() * nodes.length)
      pulses.push({ from, to, t: 0 })
    }

    let lastTime = 0
    const INTERVAL = 1000 / 30  // cap at 30 fps — keeps input responsive

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw)
      if (now - lastTime < INTERVAL) return  // skip frame
      lastTime = now
      frame++

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < n.r || n.x > canvas.width  - n.r) n.vx *= -1
        if (n.y < n.r || n.y > canvas.height - n.r) n.vy *= -1
        n.phase += 0.02
      }

      // Draw connections (solid lines, no gradients)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d  = dx * dx + dy * dy  // skip sqrt — compare to 200² = 40000
          if (d < 40000) {
            const a = (1 - Math.sqrt(d) / 200) * 0.11
            ctx.beginPath()
            ctx.strokeStyle = `rgba(99,102,241,${a.toFixed(3)})`
            ctx.lineWidth   = 0.7
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes (solid circles, no per-node RadialGradient — much cheaper)
      for (const n of nodes) {
        const pulse = 0.85 + Math.sin(n.phase) * 0.15
        const a = n.alpha * pulse

        // Soft outer circle
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * 1.1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,102,241,${(a * 0.08).toFixed(3)})`
        ctx.fill()

        // Ring
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * 0.55, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(139,92,246,${(a * 0.5).toFixed(3)})`
        ctx.lineWidth   = 0.8
        ctx.stroke()

        // Label
        ctx.fillStyle    = `rgba(148,163,184,${(a * 0.7).toFixed(3)})`
        ctx.font         = `700 8px monospace`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.label, n.x, n.y)
      }

      // Spawn pulse occasionally
      if (frame % 60 === 0) spawnPulse()

      // Draw & advance pulses (no RadialGradient)
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.t += 0.025
        if (p.t >= 1) { pulses.splice(i, 1); continue }
        const from = nodes[p.from], to = nodes[p.to]
        const px   = from.x + (to.x - from.x) * p.t
        const py   = from.y + (to.y - from.y) * p.t
        const fade = p.t < 0.5 ? p.t * 2 : (1 - p.t) * 2
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(196,181,253,${fade.toFixed(2)})`
        ctx.fill()
      }

      // Candlestick bar row at bottom (every other frame for perf)
      if (frame % 2 === 0) {
        const barW = 16, barGap = 8, baseY = canvas.height - 20
        const count = Math.floor(canvas.width / (barW + barGap))
        for (let i = 0; i < count; i++) {
          const seed   = (i * 137 + frame * 0.15) % 100
          const h      = 8 + (Math.sin(seed * 0.18 + frame * 0.004) * 0.5 + 0.5) * 24
          const isUp   = Math.sin(seed * 0.7) > 0
          const col    = isUp ? 'rgba(16,185,129,' : 'rgba(239,68,68,'
          const alpha  = (0.07 + (Math.sin(seed * 0.3) * 0.5 + 0.5) * 0.06).toFixed(3)
          const bx     = i * (barW + barGap) + barGap / 2
          ctx.fillStyle = `${col}${alpha})`
          ctx.fillRect(bx, baseY - h, barW, h)
        }
      }
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.85 }}
    />
  )
}

// ── Mini preview card ─────────────────────────────────────────────────────────
function PreviewCard({ label, value, color, delay }: {
  label: string; value: string; color: string; delay: string
}) {
  return (
    <div
      className={`animate-float ${delay} rounded-xl px-4 py-3 backdrop-blur-sm`}
      style={{
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.10)',
        boxShadow: '0 8px 32px rgba(0,0,0,.3)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black" style={{ color }}>{value}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [apiError, setApiError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setApiError('')
    try {
      const tokens = await auth.login(data.email, data.password)
      localStorage.setItem('access_token', tokens.access_token)
      const me = await auth.me()
      setAuth(me, tokens.access_token, tokens.refresh_token)
      router.push('/dashboard')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Greška pri prijavi')
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: '#060c1a' }}>

      {/* ── Canvas background ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <FinanceCanvas />
      </div>

      {/* ── Gradient overlays on top of canvas ────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Center bloom */}
        <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full animate-glow-pulse"
          style={{ background: 'radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 62%)' }} />
        {/* Bottom violet */}
        <div className="absolute -bottom-32 -right-24 h-[500px] w-[500px] rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle,rgba(139,92,246,.14) 0%,transparent 62%)' }} />
        {/* Left accent */}
        <div className="absolute top-1/3 -left-32 h-[400px] w-[400px] rounded-full animate-float"
          style={{ background: 'radial-gradient(circle,rgba(59,130,246,.08) 0%,transparent 65%)', animationDelay: '2s' }} />

        {/* Dot grid on top */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

        {/* Top divider line */}
        <div className="absolute left-0 top-0 h-px w-full"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(99,102,241,.25),rgba(139,92,246,.25),transparent)' }} />
      </div>

      {/* ─── Left panel — branding ─────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[54%] flex-col justify-between px-16 py-12">

        {/* Logo */}
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 28px rgba(99,102,241,.6)' }}>
            <ChartIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-black text-white tracking-wide">Bilansia</span>
            <p className="text-[10px] font-medium tracking-widest" style={{ color: '#818cf8' }}>AI FINANSIJSKA ANALIZA</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="space-y-8 animate-fade-in-up delay-100">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.22em] text-indigo-400 mb-4">
              Finansijska inteligencija
            </p>
            <h2 className="text-5xl font-black leading-[1.1] text-white">
              Pametna analiza.<br />
              <span style={{
                background: 'linear-gradient(135deg,#818cf8 0%,#c4b5fd 50%,#f0abfc 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Bolje odluke.
              </span>
            </h2>
            <p className="mt-5 text-base text-slate-400 leading-relaxed max-w-md">
              Platforma koja automatski transformiše finansijske izvještaje
              u jasne KPI uvide, risk scoring i AI preporuke.
            </p>
          </div>

          {/* Floating preview stats */}
          <div className="flex flex-wrap gap-3">
            <PreviewCard label="Risk score"    value="78.4"  color="#10b981" delay="delay-200" />
            <PreviewCard label="Kompanije"     value="12"    color="#818cf8" delay="delay-300" />
            <PreviewCard label="Visok rizik"   value="2"     color="#f97316" delay="delay-400" />
            <PreviewCard label="AI izvještaji" value="∞"     color="#c4b5fd" delay="delay-500" />
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { icon: '⚡', text: 'Automatski KPI izračun iz PDF izvještaja' },
              { icon: '🎯', text: 'Composite risk scoring sa 5 kategorija' },
              { icon: '🤖', text: 'AI finansijski izvještaji i preporuke' },
              { icon: '📈', text: 'Višegodišnji trend praćenje i ML forecasting' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{icon}</span>
                <span className="text-sm text-slate-400">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-700 animate-fade-in delay-500">
          © 2026 Bilansia · AI Finansijska Analiza · Sigurna veza · v1.0
        </p>
      </div>

      {/* ─── Right panel — form ────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center px-8 py-12 lg:px-14"
        style={{ borderLeft: '1px solid rgba(255,255,255,.05)' }}>

        {/* Subtle panel glow */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 40%,rgba(99,102,241,.05) 0%,transparent 65%)' }} />

        <div className="relative w-full max-w-[360px] animate-fade-in-up delay-150">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <ChartIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-black text-white">Bilansia</span>
              <p className="text-[10px]" style={{ color: '#818cf8' }}>AI FINANSIJSKA ANALIZA</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-[28px] font-black tracking-tight text-white">Dobrodošli nazad</h1>
            <p className="mt-1.5 text-sm text-slate-500">Unesite vaše podatke za pristup</p>
          </div>

          {/* Glass form card */}
          <div className="rounded-2xl p-7"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.09)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 24px 64px rgba(0,0,0,.4)',
            }}>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Email adresa
                </label>
                <div className="relative group">
                  <MailIcon className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                  <input
                    type="email" autoComplete="email" placeholder="vas@email.com"
                    className="block w-full rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)' }}
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Lozinka
                </label>
                <div className="relative group">
                  <LockIcon className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                  <input
                    type="password" autoComplete="current-password" placeholder="••••••••"
                    className="block w-full rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)' }}
                    {...register('password')}
                  />
                </div>
                {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
              </div>

              {/* Error */}
              {apiError && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.22)' }}>
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-red-400">{apiError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={isSubmitting}
                className="relative w-full overflow-hidden rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 hover:brightness-115 hover:scale-[1.02] active:scale-100 disabled:opacity-60 disabled:pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
                  boxShadow: '0 4px 24px rgba(99,102,241,.45)',
                }}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Prijava u toku...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Prijavite se
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.07)' }} />
                <span className="text-xs text-slate-700">ili</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.07)' }} />
              </div>

              <p className="text-center text-sm text-slate-600">
                Nemate nalog?{' '}
                <Link href="/register" className="font-bold text-indigo-400 transition-colors hover:text-indigo-300">
                  Registrujte se besplatno
                </Link>
              </p>
            </form>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-slate-700 font-medium">
            <span className="flex items-center gap-1"><span>🔒</span> Šifrovana veza</span>
            <span>·</span>
            <span className="flex items-center gap-1"><span>🛡️</span> Sigurno čuvanje</span>
            <span>·</span>
            <span className="flex items-center gap-1"><span>✅</span> GDPR</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-3C9.75 9.504 10.254 9 10.875 9h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zm6.75-5.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.375c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.5z" />
  </svg>
}
function MailIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
}
function LockIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
}
