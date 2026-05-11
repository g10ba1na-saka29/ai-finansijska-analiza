'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { forecast as forecastApi, companies } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { fmtCurrency, fmtPct } from '@/lib/utils'
import type { ForecastResponse, Company, HistoricalPoint, ForecastPoint } from '@/types'

// ── Chart data builder ────────────────────────────────────────────────────────
type ChartPoint = {
  year: number
  rev_hist?: number
  rev_pred?: number
  rev_band?: [number, number]   // [low, high] for CI area
  ebitda_hist?: number
  ebitda_pred?: number
  net_hist?: number
  net_pred?: number
  isforecast: boolean
}

function buildChartData(
  historical: HistoricalPoint[],
  predictions: ForecastPoint[],
  baseYear: number,
): ChartPoint[] {
  const pts: ChartPoint[] = []

  for (const h of historical) {
    pts.push({
      year: h.year,
      rev_hist:   h.revenue   ?? undefined,
      ebitda_hist: h.ebitda   ?? undefined,
      net_hist:    h.net_income ?? undefined,
      isforecast: false,
    })
  }

  // Bridge: connect last hist point to first forecast
  const lastHist = historical[historical.length - 1]
  for (const p of predictions) {
    const isFirst = p.year === baseYear + 1
    pts.push({
      year: p.year,
      // Carry last hist value on first pred point to create continuous line
      rev_hist:    isFirst && lastHist ? (lastHist.revenue ?? undefined) : undefined,
      rev_pred:    p.revenue ?? undefined,
      rev_band:    p.revenue_low != null && p.revenue_high != null
        ? [p.revenue_low, p.revenue_high]
        : undefined,
      ebitda_hist: isFirst && lastHist ? (lastHist.ebitda ?? undefined) : undefined,
      ebitda_pred: p.ebitda ?? undefined,
      net_hist:    isFirst && lastHist ? (lastHist.net_income ?? undefined) : undefined,
      net_pred:    p.net_income ?? undefined,
      isforecast:  true,
    })
  }

  return pts
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white shadow-lg ring-1 ring-gray-100 p-3 text-xs space-y-1">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">
            {typeof p.value === 'number' ? fmtCurrency(p.value) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Stats pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-800">{value}</p>
    </div>
  )
}

// ── Projection table ──────────────────────────────────────────────────────────
function ProjectionTable({ predictions }: { predictions: ForecastPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Godina</th>
            <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prihodi</th>
            <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">EBITDA</th>
            <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Neto prihod</th>
            <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">EBITDA %</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map(p => (
            <tr key={p.year} className="border-b border-slate-50 hover:bg-slate-50/60">
              <td className="py-3 px-4 font-bold text-slate-700">
                {p.year}
                <span className="ml-1.5 text-[10px] font-semibold text-indigo-400 bg-indigo-50 rounded-full px-1.5 py-0.5">prognoza</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-bold tabular-nums text-slate-800">{fmtCurrency(p.revenue)}</span>
                {p.revenue_low != null && p.revenue_high != null && (
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    [{fmtCurrency(p.revenue_low)} – {fmtCurrency(p.revenue_high)}]
                  </p>
                )}
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-bold tabular-nums text-slate-800">{fmtCurrency(p.ebitda)}</span>
                {p.ebitda_low != null && p.ebitda_high != null && (
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    [{fmtCurrency(p.ebitda_low)} – {fmtCurrency(p.ebitda_high)}]
                  </p>
                )}
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-bold tabular-nums text-slate-800">{fmtCurrency(p.net_income)}</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-semibold tabular-nums text-slate-600">{fmtPct(p.ebitda_margin)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [data, setData]       = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [horizon, setHorizon] = useState(3)

  useEffect(() => {
    Promise.allSettled([
      companies.get(id),
      forecastApi.get(id),
    ]).then(([co, fc]) => {
      if (co.status === 'fulfilled') setCompany(co.value)
      if (fc.status === 'fulfilled') setData(fc.value)
    }).finally(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    try {
      await forecastApi.generate(id, horizon)
      toast.info('Prognoza se generiše', 'Osvježi stranicu za par sekundi...')
      // Poll once after a short wait
      setTimeout(async () => {
        const fresh = await forecastApi.get(id).catch(() => null)
        if (fresh) { setData(fresh); toast.success('Prognoza ažurirana!') }
        setGenerating(false)
      }, 4000)
    } catch (e) {
      toast.error('Greška', e instanceof Error ? e.message : 'Pokušajte ponovo')
      setGenerating(false)
    }
  }

  if (loading) return <PageSpinner />

  const chartData = data ? buildChartData(data.historical, data.predictions, data.base_year) : []

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href={`/companies/${id}`} className="hover:text-slate-600">← Nazad</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ML Prognoza</h1>
          <p className="mt-1 text-sm text-gray-500">{company?.name}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-500">Horizont:</label>
            <select
              value={horizon}
              onChange={e => setHorizon(Number(e.target.value))}
              className="rounded-lg border-0 py-1.5 px-3 text-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value={1}>1 godina</option>
              <option value={2}>2 godine</option>
              <option value={3}>3 godine</option>
            </select>
          </div>
          <Button onClick={handleGenerate} loading={generating} size="sm">
            {data ? 'Regeneriši prognozu' : 'Generiši prognozu'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-5 gap-3">
          <StatPill label="Metoda"       value={data.method === 'linear_regression' ? 'Lin. regresija' : 'Nedovoljno podataka'} />
          <StatPill label="Historijskih" value={`${data.data_points} god.`} />
          <StatPill label="Horizont"     value={`${data.horizon} god.`} />
          <StatPill label="CAGR prihoda" value={data.revenue_cagr != null ? fmtPct(data.revenue_cagr) : 'N/A'} />
          <StatPill label="R² (prihodi)" value={data.revenue_r_squared != null ? data.revenue_r_squared.toFixed(3) : 'N/A'} />
        </div>
      )}

      {/* Chart */}
      {data && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historija + Prognoza</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Isprekidana linija = prognoza · Sjenčano = 95% interval pouzdanosti
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis
                  tickFormatter={v => fmtCurrency(v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

                {/* Vertical line at forecast start */}
                {data.base_year && (
                  <ReferenceLine
                    x={data.base_year}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    label={{ value: 'Prognoza →', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
                  />
                )}

                {/* Revenue CI band (stacked area trick) */}
                <Area type="monotone" dataKey="rev_band[0]" stroke="none" fill="transparent" stackId="rev_ci" legendType="none" />
                <Area
                  type="monotone"
                  dataKey={(d: ChartPoint) => d.rev_band ? d.rev_band[1] - d.rev_band[0] : undefined}
                  name=" "
                  stroke="none"
                  fill="rgba(99,102,241,0.12)"
                  stackId="rev_ci"
                  legendType="none"
                />

                {/* Historical lines */}
                <Line type="monotone" dataKey="rev_hist"    name="Prihodi (hist.)"  stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="ebitda_hist" name="EBITDA (hist.)"   stroke="#10b981" strokeWidth={2}   dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="net_hist"    name="Neto (hist.)"     stroke="#f59e0b" strokeWidth={2}   dot={{ r: 3 }} connectNulls />

                {/* Forecast lines */}
                <Line type="monotone" dataKey="rev_pred"    name="Prihodi (prog.)"  stroke="#6366f1" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: '#6366f1' }} connectNulls />
                <Line type="monotone" dataKey="ebitda_pred" name="EBITDA (prog.)"   stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: '#10b981' }} connectNulls />
                <Line type="monotone" dataKey="net_pred"    name="Neto (prog.)"     stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: '#f59e0b' }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Projection table */}
      {data && data.predictions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Tabela projekcija</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ProjectionTable predictions={data.predictions} />
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {!data && !generating && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-slate-400 mb-4">
              Prognoza još nije generisana. Potrebna su minimalno 2 historijska perioda (KPI snapshots).
            </p>
            <Button onClick={handleGenerate} loading={generating}>Generiši prognozu</Button>
          </CardContent>
        </Card>
      )}

      {/* Method note */}
      {data?.method === 'insufficient_data' && (
        <Card className="ring-amber-200">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-amber-600">
              ⚠ Nedovoljno historijskih podataka za pouzdan forecast. Potrebni su bar 2 perioda.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
