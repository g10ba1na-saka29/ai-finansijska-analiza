'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { companies, score } from '@/lib/api'
import { RiskBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn, COMPANY_GRADIENTS, getCompanyGradient } from '@/lib/utils'
import type { Company, ScoreHistoryPoint } from '@/types'

// ── Risk colour palette ────────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  excellent: '#10b981',
  good:      '#3b82f6',
  warning:   '#f59e0b',
  high_risk: '#f97316',
  critical:  '#ef4444',
}
const RISK_GLOW: Record<string, string> = {
  excellent: 'rgba(16,185,129,.40)',
  good:      'rgba(59,130,246,.40)',
  warning:   'rgba(245,158,11,.40)',
  high_risk: 'rgba(249,115,22,.40)',
  critical:  'rgba(239,68,68,.40)',
}

// ── Animated count-up ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) { setVal(0); return }
    const tid = setTimeout(() => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        const e = 1 - Math.pow(1 - p, 3)          // ease-out cubic
        setVal(+(target * e).toFixed(2))
        if (p < 1) requestAnimationFrame(tick)
        else setVal(target)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(tid)
  }, [target, duration, delay])
  return val
}

// ── Animated SVG score ring ───────────────────────────────────────────────────
function ScoreRing({
  score, size = 120, stroke = 9,
}: { score: number; size?: number; stroke?: number }) {
  const [anim, setAnim] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnim(score), 180); return () => clearTimeout(t) }, [score])

  const level = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'warning' : score >= 20 ? 'high_risk' : 'critical'
  const color = RISK_COLOR[level]

  const r    = (size - stroke * 2.4) / 2
  const cx   = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(anim / 100, 1) * circ * 0.75
  const uid  = `rg-${size}-${Math.floor(score)}`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id={uid} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={`${uid}bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background glow disc */}
      <circle cx={cx} cy={cy} r={r + 6} fill={`url(#${uid}bg)`} />

      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,.06)"
        strokeWidth={stroke} strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeLinecap="round" transform={`rotate(-225 ${cx} ${cy})`} />

      {/* Fill */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round" transform={`rotate(-225 ${cx} ${cy})`}
        filter={`url(#${uid})`}
        style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)' }} />

      {/* Score text */}
      <text x={cx} y={cy + 2} textAnchor="middle"
        fontSize={size / 6} fontWeight="800" fill={color} fontFamily="Inter,sans-serif">
        {Math.round(anim)}
      </text>
      <text x={cx} y={cy + size / 7.5} textAnchor="middle"
        fontSize={size / 13} fill="rgba(100,116,139,.7)" fontFamily="Inter,sans-serif">
        / 100
      </text>
    </svg>
  )
}

// ── Company card ──────────────────────────────────────────────────────────────
function CompanyCard({ company: c, score: s, idx }: {
  company: Company; score?: ScoreHistoryPoint; idx: number
}) {
  const level = s?.risk_level ?? 'good'
  const color = s ? RISK_COLOR[level] : '#94a3b8'
  const glow  = s ? RISK_GLOW[level]  : 'rgba(148,163,184,.15)'

  // Gradient loaded client-side only to avoid SSR hydration mismatch
  const [grad, setGrad] = useState(COMPANY_GRADIENTS[0])
  useEffect(() => { setGrad(getCompanyGradient(c.id)) }, [c.id])

  return (
    <Link
      href={`/companies/${c.id}`}
      style={{ animationDelay: `${320 + idx * 70}ms` }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80 transition-all duration-300 hover:-translate-y-2 hover:shadow-card-lg animate-fade-in-up"
    >
      {/* Coloured top stripe */}
      <div className="h-[3px] w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${color} 0%, ${color}55 100%)` }} />

      {/* Card header */}
      <div className="flex items-start justify-between p-5 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white"
            style={{ background: `linear-gradient(135deg,${grad.from},${grad.to})`, boxShadow: `0 4px 12px ${grad.from}55` }}
          >
            {c.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-slate-900 transition-colors group-hover:text-primary-700 leading-tight">
              {c.name}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{c.industry ?? 'N/A'} · {c.country}</p>
          </div>
        </div>
        {s && <RiskBadge level={s.risk_level} />}
      </div>

      {/* Score ring */}
      <div className="flex flex-1 flex-col items-center justify-center py-3">
        {s ? (
          <div className="relative">
            {/* Ambient glow behind ring */}
            <div className="absolute inset-0 -m-3 rounded-full blur-2xl opacity-60 animate-glow-pulse"
              style={{ background: glow }} />
            <ScoreRing score={s.total_score} size={112} stroke={9} />
          </div>
        ) : (
          <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full"
            style={{ border: '3px dashed rgba(203,213,225,.5)' }}>
            <p className="text-xs text-slate-300 text-center leading-relaxed">Nema<br />podataka</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-1 flex items-center justify-between border-t border-slate-50 px-5 py-3">
        <span className="text-[11px] text-slate-400">
          {s ? `god. ${s.fiscal_year}` : '—'}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-all group-hover:gap-2 group-hover:text-primary-600">
          Detalji
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </div>

      {/* Hover colour overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: `inset 0 0 0 1.5px ${color}30`, background: `linear-gradient(160deg,${color}06 0%,transparent 60%)` }} />
    </Link>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
const ACCENTS = {
  indigo:  { pill: 'bg-indigo-50',  icon: 'text-indigo-500',  bar: 'from-indigo-400 to-violet-400'  },
  violet:  { pill: 'bg-violet-50',  icon: 'text-violet-500',  bar: 'from-violet-400 to-purple-500'  },
  emerald: { pill: 'bg-emerald-50', icon: 'text-emerald-500', bar: 'from-emerald-400 to-teal-400'   },
  rose:    { pill: 'bg-rose-50',    icon: 'text-rose-500',    bar: 'from-rose-400 to-red-500'       },
  slate:   { pill: 'bg-slate-100',  icon: 'text-slate-400',   bar: 'from-slate-200 to-slate-300'    },
} as const

function StatCard({ delay, label, value, fmt, sub, accent, icon, red }: {
  delay: string; label: string; value: number; fmt: (v: number) => string
  sub: string; accent: keyof typeof ACCENTS; icon: React.ReactNode; red?: boolean
}) {
  const a = ACCENTS[accent]
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-md animate-fade-in-up', delay)}>
      <div className={cn('h-[3px] bg-gradient-to-r', a.bar)} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{label}</p>
            <p className={cn('mt-3 text-4xl font-black tabular-nums leading-none tracking-tight', red ? 'text-red-500' : 'text-slate-900')}>
              {fmt(value)}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">{sub}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', a.pill)}>
            <span className={cn('h-5 w-5', a.icon)}>{icon}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center py-24">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-glow-pulse rounded-2xl blur-xl"
          style={{ background: 'rgba(99,102,241,.2)' }} />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.15))', border: '1px solid rgba(99,102,241,.2)' }}>
          <BuildingIcon className="h-9 w-9 text-primary-400" />
        </div>
      </div>
      <p className="text-base font-bold text-slate-700">Još nema kompanija</p>
      <p className="mt-1.5 text-sm text-slate-400 text-center max-w-xs">
        Dodajte prvu kompaniju da biste počeli pratiti finansijsko stanje
      </p>
      <Link
        href="/companies/new"
        className="mt-6 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-glow"
        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 24px rgba(99,102,241,.35)' }}
      >
        <PlusIcon className="h-4 w-4" />
        Dodaj prvu kompaniju
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [companyList, setCompanyList] = useState<Company[]>([])
  const [scores, setScores]           = useState<Record<string, ScoreHistoryPoint>>({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    companies.list(0, 50).then(res => {
      setCompanyList(res.items)
      Promise.allSettled(
        res.items.map(c =>
          score.history(c.id).then(h => [c.id, h.history.at(-1)] as [string, ScoreHistoryPoint])
        )
      ).then(results => {
        const map: Record<string, ScoreHistoryPoint> = {}
        results.forEach(r => { if (r.status === 'fulfilled' && r.value[1]) map[r.value[0]] = r.value[1] })
        setScores(map)
      })
    }).finally(() => setLoading(false))
  }, [])

  // Compute derived values (0 during loading — that's fine for count-up)
  const sv   = Object.values(scores)
  const avg  = sv.length ? sv.reduce((a, s) => a + s.total_score, 0) / sv.length : 0
  const hi   = sv.filter(s => ['high_risk','critical'].includes(s.risk_level)).length
  const exc  = sv.filter(s => s.risk_level === 'excellent').length

  // All hooks BEFORE any conditional return (Rules of Hooks)
  const cCo  = useCountUp(companyList.length, 900,  150)
  const cAvg = useCountUp(avg,                1300, 250)
  const cExc = useCountUp(exc,                800,  350)
  const cHi  = useCountUp(hi,                800,  450)

  if (loading) return <PageSpinner />

  return (
    <div className="mesh-bg min-h-full">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-8 pt-8 pb-6"
        style={{
          background: 'linear-gradient(135deg,rgba(99,102,241,.07) 0%,rgba(139,92,246,.04) 50%,transparent 100%)',
          borderBottom: '1px solid rgba(99,102,241,.09)',
        }}>
        {/* Decorative orb */}
        <div className="pointer-events-none absolute -top-20 right-10 h-56 w-56 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%)' }} />

        <div className="relative flex items-end justify-between animate-fade-in-up">
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.2em] text-primary-500">
              Dashboard
            </p>
            <h1 className="text-[28px] font-black tracking-tight text-slate-900">
              Finansijski pregled
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Praćenje performansi i rizika vaših kompanija
            </p>
          </div>
          <Link
            href="/companies/new"
            className="group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 22px rgba(99,102,241,.40)' }}
          >
            <PlusIcon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            Nova kompanija
          </Link>
        </div>
      </div>

      <div className="px-8 py-7 space-y-8">

        {/* ── Stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard delay="delay-75"  label="Kompanije"    value={cCo}  fmt={v => String(Math.round(v))} sub="ukupno u sistemu"   accent="indigo"  icon={<BuildingIcon />} />
          <StatCard delay="delay-150" label="Prosj. score" value={cAvg} fmt={v => sv.length ? v.toFixed(1) : '—'} sub="prosječna ocjena" accent="violet"  icon={<ChartIcon />} />
          <StatCard delay="delay-250" label="Odlično"      value={cExc} fmt={v => String(Math.round(v))} sub="kompanija ≥ 80"    accent="emerald" icon={<StarIcon />} />
          <StatCard delay="delay-300" label="Visok rizik"  value={cHi}  fmt={v => String(Math.round(v))} sub="zahtijeva pažnju"  accent={hi > 0 ? 'rose' : 'slate'} icon={<AlertIcon />} red={hi > 0} />
        </div>

        {/* ── Company grid ────────────────────────────────────────────── */}
        {companyList.length === 0 ? <EmptyState /> : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Kompanije</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {companyList.length} {companyList.length === 1 ? 'kompanija' : 'kompanija'} · kliknite za detalje
                </p>
              </div>
              <Link href="/companies" className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                Prikaži sve →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
              {companyList.map((c, i) => (
                <CompanyCard key={c.id} company={c} score={scores[c.id]} idx={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
}
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-3C9.75 9.504 10.254 9 10.875 9h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zm6.75-5.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.375c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.5z" /></svg>
}
function StarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
}
function AlertIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
