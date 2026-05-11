'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { companies, score, kpi } from '@/lib/api'
import { ScoreGauge } from '@/components/charts/ScoreGauge'
import { CategoryScoreBar } from '@/components/charts/CategoryScoreBar'
import { ScoreRadar } from '@/components/charts/ScoreRadar'
import { KPITrendChart } from '@/components/charts/KPITrendChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RiskBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { fmtPct, fmtNum, RISK_COLORS, COMPANY_GRADIENTS, getCompanyGradient } from '@/lib/utils'
import type { Company, ScoreResponse, KPIResponse, KPITrendPoint } from '@/types'

const RISK_BG_SUBTLE: Record<string, string> = {
  excellent: 'rgba(16,185,129,.08)',
  good:      'rgba(59,130,246,.08)',
  warning:   'rgba(245,158,11,.08)',
  high_risk: 'rgba(249,115,22,.08)',
  critical:  'rgba(239,68,68,.08)',
}
const RISK_BORDER: Record<string, string> = {
  excellent: 'rgba(16,185,129,.25)',
  good:      'rgba(59,130,246,.25)',
  warning:   'rgba(245,158,11,.25)',
  high_risk: 'rgba(249,115,22,.25)',
  critical:  'rgba(239,68,68,.25)',
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany]     = useState<Company | null>(null)
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null)
  const [kpiData, setKpiData]     = useState<KPIResponse | null>(null)
  const [trend, setTrend]         = useState<KPITrendPoint[]>([])
  const [year, setYear]           = useState<number | null>(null)
  const [loading, setLoading]     = useState(true)
  const [grad, setGrad]           = useState(COMPANY_GRADIENTS[0])

  useEffect(() => {
    setGrad(getCompanyGradient(id))
  }, [id])

  useEffect(() => {
    Promise.allSettled([companies.get(id), score.history(id)]).then(([coRes, histRes]) => {
      if (coRes.status === 'fulfilled') setCompany(coRes.value)
      if (histRes.status !== 'fulfilled') return
      const latest = histRes.value.history.at(-1)
      if (!latest) return
      const y = latest.fiscal_year
      setYear(y)
      return Promise.allSettled([score.get(id, y), kpi.get(id, y), kpi.trend(id)]).then(([sc, kp, tr]) => {
        if (sc.status === 'fulfilled') setScoreData(sc.value)
        if (kp.status === 'fulfilled') setKpiData(kp.value)
        if (tr.status === 'fulfilled') setTrend(tr.value.points)
      })
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageSpinner />
  if (!company) return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-400">Kompanija nije pronađena.</div>
  )

  const level      = scoreData?.risk_level ?? 'good'
  const riskColor  = RISK_COLORS[level]  ?? '#94a3b8'
  const riskBg     = RISK_BG_SUBTLE[level] ?? 'rgba(148,163,184,.08)'
  const riskBorder = RISK_BORDER[level] ?? 'rgba(148,163,184,.2)'

  return (
    <div className="mesh-bg min-h-full">

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-8 pt-8 pb-0">
        {/* Background glow matching risk colour */}
        <div className="pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle,${riskColor}22 0%,transparent 70%)` }} />

        <div className="relative animate-fade-in-up">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
            <Link href="/companies" className="hover:text-slate-600 transition-colors">Kompanije</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">{company.name}</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              {/* Company avatar */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg"
                style={{ background: `linear-gradient(135deg,${grad.from},${grad.to})`, boxShadow: `0 8px 24px ${grad.from}66` }}
              >
                {company.name[0].toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">{company.name}</h1>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {company.industry && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {company.industry}
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {company.country}
                  </span>
                  {year && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: riskBg, color: riskColor, border: `1px solid ${riskBorder}` }}>
                      god. {year}
                    </span>
                  )}
                  {scoreData && <RiskBadge level={scoreData.risk_level} />}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/companies/${id}/edit`}>
                <Button variant="ghost" size="sm">
                  <PencilIcon className="h-3.5 w-3.5" />
                  Uredi
                </Button>
              </Link>
              <Link href={`/companies/${id}/reports`}>
                <Button variant="secondary" size="sm">Izvještaji</Button>
              </Link>
              <Link href={`/companies/${id}/kpi`}>
                <Button variant="secondary" size="sm">KPI detalji</Button>
              </Link>
              <Link href={`/companies/${id}/benchmarks`}>
                <Button variant="secondary" size="sm">Benchmarks</Button>
              </Link>
              <Link href={`/companies/${id}/forecast`}>
                <Button variant="secondary" size="sm">📈 Prognoza</Button>
              </Link>
              <Link href={`/companies/${id}/risk-assessment`}>
                <Button variant="secondary" size="sm">🔬 Analiza rizika</Button>
              </Link>
              <Link href={`/companies/${id}/ai-report`}>
                <Button size="sm">
                  <span className="mr-1">✨</span> AI Izvještaj
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tab-style bottom border */}
        <div className="mt-6 h-px w-full" style={{ background: 'linear-gradient(90deg,rgba(99,102,241,.2),rgba(139,92,246,.1),transparent)' }} />
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="px-8 py-7 space-y-6">

        {scoreData ? (
          <>
            {/* Score strip */}
            <div className="grid grid-cols-3 gap-5 animate-fade-in-up delay-75">

              {/* Gauge card */}
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80 flex flex-col items-center py-7"
                style={{ background: `linear-gradient(160deg,${riskBg} 0%,#fff 60%)` }}>
                <div className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ border: `1px solid ${riskBorder}` }} />
                <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[.2em] text-slate-400">
                  Ukupni Score {year}
                </p>
                <ScoreGauge score={scoreData.total_score} size={190} />
                {scoreData.altman && (
                  <div className="mt-5 text-center px-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Altman Z&apos;&apos;</p>
                    <p className="mt-1 text-lg font-black text-slate-800">
                      {scoreData.altman.z_score?.toFixed(2) ?? 'N/A'}
                      <span className="ml-1.5 text-xs font-medium text-slate-400">({scoreData.altman.zone})</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Category bars */}
              <Card className="col-span-1 animate-fade-in-up delay-100">
                <CardHeader><CardTitle>Score po kategorijama</CardTitle></CardHeader>
                <CardContent>
                  <CategoryScoreBar categories={[
                    { label: 'Likvidnost',     score: scoreData.liquidity_score,     weight: '20%' },
                    { label: 'Profitabilnost', score: scoreData.profitability_score, weight: '25%' },
                    { label: 'Zaduženost',     score: scoreData.leverage_score,     weight: '20%' },
                    { label: 'Rast',           score: scoreData.growth_score,       weight: '20%' },
                    { label: 'Cash Flow',      score: scoreData.cashflow_score,     weight: '15%' },
                  ]} />
                </CardContent>
              </Card>

              {/* Radar */}
              <Card className="col-span-1 animate-fade-in-up delay-150">
                <CardHeader><CardTitle>Radar pregled</CardTitle></CardHeader>
                <CardContent className="pb-2">
                  <ScoreRadar score={scoreData} />
                </CardContent>
              </Card>
            </div>

            {/* KPI summary grid */}
            {kpiData && (
              <div className="grid grid-cols-4 gap-4 animate-fade-in-up delay-200">
                <KPICard label="Current Ratio"  value={fmtNum(kpiData.liquidity.current_ratio)}     sub="Likvidnost"    good={kpiData.liquidity.current_ratio != null && kpiData.liquidity.current_ratio >= 1.5} />
                <KPICard label="EBITDA Margin"  value={fmtPct(kpiData.profitability.ebitda_margin)} sub="Profitabilnost" good={kpiData.profitability.ebitda_margin != null && kpiData.profitability.ebitda_margin >= 0.15} />
                <KPICard label="Debt / Equity"  value={fmtNum(kpiData.leverage.debt_to_equity)}     sub="Zaduženost"    good={kpiData.leverage.debt_to_equity != null && kpiData.leverage.debt_to_equity <= 2.0} reverse />
                <KPICard label="Rast prihoda"   value={fmtPct(kpiData.growth.revenue_growth)}       sub="YoY"           good={kpiData.growth.revenue_growth != null && kpiData.growth.revenue_growth >= 0.05} />
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80 animate-fade-in-up delay-75">
            <div className="py-14 text-center">
              <p className="text-sm font-medium text-slate-500">Score nije dostupan za godinu {year ?? '—'}</p>
              <p className="mt-1 text-xs text-slate-400">Uploadajte finansijski izvještaj i pokrenite analizu</p>
              <Link href={`/companies/${id}/reports`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                Upload izvještaja
              </Link>
            </div>
          </div>
        )}

        {/* Trend chart */}
        {trend.length > 1 && (
          <Card className="animate-fade-in-up delay-300">
            <CardHeader>
              <CardTitle>Trend marži</CardTitle>
              <p className="text-xs text-gray-400">EBITDA, Net i Growth margin kroz godine</p>
            </CardHeader>
            <CardContent className="pb-2">
              <KPITrendChart points={trend} mode="margins" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

// ── KPI mini card ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, good, reverse }: {
  label: string; value: string; sub: string; good?: boolean; reverse?: boolean
}) {
  const isGood = reverse ? !good : good
  const color  = isGood === undefined ? '#64748b' : isGood ? '#10b981' : '#f97316'
  const bg     = isGood === undefined ? 'rgba(100,116,139,.08)' : isGood ? 'rgba(16,185,129,.08)' : 'rgba(249,115,22,.08)'
  const border = isGood === undefined ? 'rgba(100,116,139,.15)' : isGood ? 'rgba(16,185,129,.2)' : 'rgba(249,115,22,.2)'

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80 p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-md">
      {/* Colour accent top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">{sub}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
      {isGood !== undefined && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: bg, color, border: `1px solid ${border}` }}>
          {isGood ? '↑ Dobro' : '↓ Ispod cilja'}
        </div>
      )}
    </div>
  )
}
