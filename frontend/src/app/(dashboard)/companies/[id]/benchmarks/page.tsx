'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { benchmarks as benchmarksApi, companies, reports as reportsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { fmtNum, fmtPct } from '@/lib/utils'
import type { BenchmarkResponse, Company, BenchmarkAssessment, MetricBenchmark } from '@/types'

const CUR_YEAR = new Date().getFullYear() - 1

// ── Assessment styling ────────────────────────────────────────────────────────
const ASSESSMENT_STYLE: Record<BenchmarkAssessment, { bg: string; text: string; dot: string; label: string }> = {
  strong:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Odlično' },
  above_avg:  { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-400',   label: 'Iznad prosjeka' },
  avg:        { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400',    label: 'Prosječno' },
  below_avg:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Ispod prosjeka' },
  weak:       { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Slabo' },
  neutral:    { bg: 'bg-slate-50',   text: 'text-slate-500',   dot: 'bg-slate-300',   label: 'Nema podataka' },
}

// ── Percentile bar ────────────────────────────────────────────────────────────
function PercentileBar({ pct, hib }: { pct: number | null; hib: boolean }) {
  if (pct === null) return <span className="text-xs text-slate-300">—</span>
  const score = hib ? pct : 100 - pct
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#3b82f6' : score >= 40 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold tabular-nums" style={{ color }}>{pct}</span>
    </div>
  )
}

// ── Format benchmark value ────────────────────────────────────────────────────
function fmtBenchmarkVal(metric: string, val: number | null): string {
  if (val === null) return '—'
  const pctMetrics = new Set(['ebitda_margin', 'net_margin', 'roe', 'roa', 'debt_ratio', 'revenue_growth', 'ocf_margin'])
  if (pctMetrics.has(metric)) return fmtPct(val)
  if (metric === 'days_sales_outstanding') return `${val.toFixed(0)} d`
  return fmtNum(val)
}

// ── Metric row ────────────────────────────────────────────────────────────────
function MetricRow({ m }: { m: MetricBenchmark }) {
  const style = ASSESSMENT_STYLE[m.assessment] ?? ASSESSMENT_STYLE.neutral
  const companyVal = fmtBenchmarkVal(m.metric, m.company_value)
  const medianVal  = fmtBenchmarkVal(m.metric, m.industry_median)

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="py-3 pl-4 pr-2">
        <span className="text-sm font-semibold text-slate-700">{m.label}</span>
      </td>
      <td className="py-3 px-2 text-center">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {m.assessment_label}
        </span>
      </td>
      <td className="py-3 px-2 text-right">
        <span className="text-sm font-bold tabular-nums text-slate-800">{companyVal}</span>
      </td>
      <td className="py-3 px-2 text-center text-xs text-slate-400 tabular-nums">
        {fmtBenchmarkVal(m.metric, m.industry_p25)}
      </td>
      <td className="py-3 px-2 text-center text-xs font-semibold text-slate-600 tabular-nums">
        {medianVal}
      </td>
      <td className="py-3 px-2 text-center text-xs text-slate-400 tabular-nums">
        {fmtBenchmarkVal(m.metric, m.industry_p75)}
      </td>
      <td className="py-3 pr-4 pl-2 w-36">
        <PercentileBar pct={m.percentile} hib={m.higher_is_better} />
      </td>
    </tr>
  )
}

// ── Overall gauge ring ────────────────────────────────────────────────────────
function OverallGauge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const r = 36, c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  const color = pct >= 75 ? '#10b981' : pct >= 55 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : pct >= 20 ? '#f97316' : '#ef4444'
  const label = pct >= 75 ? 'Iznad prosjeka' : pct >= 55 ? 'Dobro' : pct >= 40 ? 'Prosječno' : pct >= 20 ? 'Ispod prosjeka' : 'Slabo'
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" className="transition-all duration-700" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          fontSize="18" fontWeight="800" fill={color}>{pct}</text>
      </svg>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BenchmarksPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany]   = useState<Company | null>(null)
  const [data, setData]         = useState<BenchmarkResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [year, setYear]         = useState(CUR_YEAR)
  const [availableYears, setAvailableYears] = useState<number[]>([CUR_YEAR])

  useEffect(() => {
    Promise.allSettled([
      companies.get(id),
      reportsApi.list(id),
    ]).then(([co, reps]) => {
      if (co.status === 'fulfilled') setCompany(co.value)
      if (reps.status === 'fulfilled') {
        const done = [...new Set(
          reps.value.items.filter(r => r.status === 'done').map(r => r.fiscal_year)
        )].sort((a, b) => b - a)
        if (done.length > 0) {
          setAvailableYears(done)
          setYear(done[0])
          loadBenchmarks(done[0])
          return
        }
      }
      setLoading(false)
    })
  }, [id])

  function loadBenchmarks(y: number) {
    setLoading(true)
    setError(null)
    benchmarksApi.get(id, y)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Greška'))
      .finally(() => setLoading(false))
  }

  function onYearChange(y: number) {
    setYear(y)
    loadBenchmarks(y)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href={`/companies/${id}`} className="hover:text-slate-600">← Nazad</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Benchmark Poređenje</h1>
          <p className="mt-1 text-sm text-gray-500">{company?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-500">Godina:</label>
          <select
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            className="rounded-lg border-0 py-1.5 px-3 text-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <p className="mt-2 text-xs text-slate-400">
              Provjeri da li su KPI podaci izračunati za godinu {year}.
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-4">
            {/* Overall percentile */}
            <Card className="col-span-1 flex flex-col items-center justify-center py-5">
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Ukupni percentil
              </p>
              <OverallGauge pct={data.overall_percentile} />
              <p className="mt-3 text-xs text-slate-500">
                industrija: <span className="font-semibold text-slate-700">{data.industry}</span>
              </p>
            </Card>

            {/* Strengths */}
            <Card className="col-span-1">
              <CardHeader><CardTitle className="text-emerald-700 text-sm">✓ Snage</CardTitle></CardHeader>
              <CardContent>
                {data.strengths.length === 0
                  ? <p className="text-xs text-slate-400">Nema istaknutih prednosti</p>
                  : (
                    <ul className="space-y-1.5">
                      {data.strengths.map((s, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )
                }
              </CardContent>
            </Card>

            {/* Weaknesses */}
            <Card className="col-span-1">
              <CardHeader><CardTitle className="text-red-700 text-sm">✗ Slabosti</CardTitle></CardHeader>
              <CardContent>
                {data.weaknesses.length === 0
                  ? <p className="text-xs text-slate-400">Nema evidentnih slabosti</p>
                  : (
                    <ul className="space-y-1.5">
                      {data.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  )
                }
              </CardContent>
            </Card>

            {/* Data points legend */}
            <Card className="col-span-1">
              <CardHeader><CardTitle className="text-sm">Legenda</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(ASSESSMENT_STYLE).filter(([k]) => k !== 'neutral').map(([key, style]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <span className="text-xs text-slate-600">{style.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Metrics table */}
          <Card>
            <CardHeader>
              <CardTitle>KPI vs Industrijski benchmark — {data.industry} {year}</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Percentil = pozicija u industriji (0 = dno, 100 = vrh)</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Metrika</th>
                      <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ocjena</th>
                      <th className="py-2.5 px-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kompanija</th>
                      <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">P25</th>
                      <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Medijan</th>
                      <th className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">P75</th>
                      <th className="py-2.5 pr-4 pl-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Percentil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.metrics.map(m => <MetricRow key={m.metric} m={m} />)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!data && !error && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-slate-400">
              Nema KPI podataka za {year}. Uploadajte izvještaj i pokrenite kalkulaciju.
            </p>
            <Link href={`/companies/${id}/reports`}
              className="mt-4 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Idi na izvještaje
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
