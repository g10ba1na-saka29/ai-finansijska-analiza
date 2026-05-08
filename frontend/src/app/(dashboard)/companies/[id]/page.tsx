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
import { fmtPct, fmtNum } from '@/lib/utils'
import type { Company, ScoreResponse, KPIResponse, KPITrendPoint } from '@/types'

const YEAR = new Date().getFullYear() - 1

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null)
  const [kpiData, setKpiData] = useState<KPIResponse | null>(null)
  const [trend, setTrend] = useState<KPITrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      companies.get(id),
      score.get(id, YEAR),
      kpi.get(id, YEAR),
      kpi.trend(id),
    ]).then(([co, sc, kp, tr]) => {
      if (co.status === 'fulfilled') setCompany(co.value)
      if (sc.status === 'fulfilled') setScoreData(sc.value)
      if (kp.status === 'fulfilled') setKpiData(kp.value)
      if (tr.status === 'fulfilled') setTrend(tr.value.points)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageSpinner />
  if (!company) return <div className="p-8 text-gray-500">Kompanija nije pronađena.</div>

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{company.industry ?? 'N/A'} · {company.country} · {YEAR}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/companies/${id}/reports`}>
            <Button variant="secondary" size="sm">Izvještaji</Button>
          </Link>
          <Link href={`/companies/${id}/kpi`}>
            <Button variant="secondary" size="sm">KPI detalji</Button>
          </Link>
          <Link href={`/companies/${id}/ai-report`}>
            <Button size="sm">AI Izvještaj</Button>
          </Link>
        </div>
      </div>

      {/* Score section */}
      {scoreData ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Gauge */}
          <Card className="col-span-1 flex flex-col items-center py-6">
            <p className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Score {YEAR}</p>
            <ScoreGauge score={scoreData.total_score} size={200} />
            {scoreData.altman && (
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-400">Altman Z''</p>
                <p className="text-sm font-semibold text-gray-700">
                  {scoreData.altman.z_score?.toFixed(2) ?? 'N/A'}
                  <span className="ml-1 text-xs font-normal text-gray-400">({scoreData.altman.zone})</span>
                </p>
              </div>
            )}
          </Card>

          {/* Category bars */}
          <Card className="col-span-1">
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
          <Card className="col-span-1">
            <CardHeader><CardTitle>Radar pregled</CardTitle></CardHeader>
            <CardContent className="pb-2">
              <ScoreRadar score={scoreData} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-400">
            Score nije dostupan za {YEAR}. Uploadajte PDF finansijski izvještaj i pokrenite analizu.
          </CardContent>
        </Card>
      )}

      {/* KPI quick cards */}
      {kpiData && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Current Ratio" value={fmtNum(kpiData.liquidity.current_ratio)} sub="Likvidnost" />
          <KPICard label="EBITDA Margin" value={fmtPct(kpiData.profitability.ebitda_margin)} sub="Profitabilnost" />
          <KPICard label="Debt/Equity" value={fmtNum(kpiData.leverage.debt_to_equity)} sub="Zaduženost" />
          <KPICard label="Rast prihoda" value={fmtPct(kpiData.growth.revenue_growth)} sub="YoY" />
        </div>
      )}

      {/* Trend chart */}
      {trend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Trend marži</CardTitle>
            <p className="text-xs text-gray-400">EBITDA, Net, Growth margin kroz godine</p>
          </CardHeader>
          <CardContent className="pb-2">
            <KPITrendChart points={trend} mode="margins" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KPICard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{sub}</p>
        <p className="mt-1 text-sm font-medium text-gray-700">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}
