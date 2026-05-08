'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { kpi as kpiApi, companies } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { KPITrendChart } from '@/components/charts/KPITrendChart'
import { fmtNum, fmtPct, fmtCurrency, kpiStatus, RISK_COLORS } from '@/lib/utils'
import type {
  KPIResponse, KPITrendPoint, Company,
  LiquidityKPIs, ProfitabilityKPIs, LeverageKPIs,
  GrowthKPIs, CashFlowKPIs, EfficiencyKPIs,
} from '@/types'

const YEAR = new Date().getFullYear() - 1

interface KPIRow {
  label: string
  value: number | null | undefined
  format: 'pct' | 'num' | 'currency' | 'days'
  metric?: string
}

interface KPISection {
  title: string
  rows: KPIRow[]
}

function buildSections(r: KPIResponse): KPISection[] {
  const liq  = r.liquidity
  const prof = r.profitability
  const lev  = r.leverage
  const grow = r.growth
  const cf   = r.cashflow
  const eff  = r.efficiency

  return [
    {
      title: 'Likvidnost',
      rows: [
        { label: 'Current Ratio',     value: liq.current_ratio,  format: 'num', metric: 'current_ratio' },
        { label: 'Quick Ratio',       value: liq.quick_ratio,    format: 'num', metric: 'quick_ratio' },
        { label: 'Cash Ratio',        value: liq.cash_ratio,     format: 'num', metric: 'cash_ratio' },
      ],
    },
    {
      title: 'Profitabilnost',
      rows: [
        { label: 'Bruto marža',       value: prof.gross_margin,  format: 'pct' },
        { label: 'EBITDA marža',      value: prof.ebitda_margin, format: 'pct', metric: 'ebitda_margin' },
        { label: 'EBIT marža',        value: prof.ebit_margin,   format: 'pct' },
        { label: 'Neto marža',        value: prof.net_margin,    format: 'pct', metric: 'net_margin' },
        { label: 'ROE',               value: prof.roe,           format: 'pct', metric: 'roe' },
        { label: 'ROA',               value: prof.roa,           format: 'pct', metric: 'roa' },
      ],
    },
    {
      title: 'Zaduženost',
      rows: [
        { label: 'D/E Ratio',         value: lev.debt_to_equity,    format: 'num', metric: 'debt_to_equity' },
        { label: 'Debt Ratio',        value: lev.debt_ratio,        format: 'num', metric: 'debt_ratio' },
        { label: 'Equity Ratio',      value: lev.equity_ratio,      format: 'num' },
        { label: 'Interest Coverage', value: lev.interest_coverage, format: 'num', metric: 'interest_coverage' },
      ],
    },
    {
      title: 'Rast',
      rows: [
        { label: 'Rast prihoda',          value: grow.revenue_growth,    format: 'pct', metric: 'revenue_growth' },
        { label: 'Rast EBITDA',           value: grow.ebitda_growth,     format: 'pct' },
        { label: 'Rast neto dobiti',      value: grow.net_income_growth, format: 'pct' },
        { label: 'Rast ukupne imovine',   value: grow.asset_growth,      format: 'pct' },
      ],
    },
    {
      title: 'Novčani tok',
      rows: [
        { label: 'Slobodni novčani tok',  value: cf.free_cash_flow,            format: 'currency' },
        { label: 'OCF marža',             value: cf.ocf_margin,                format: 'pct' },
        { label: 'Cash/Debt',             value: cf.cash_to_debt,              format: 'num' },
        { label: 'OCF / Kratk. obaveze',  value: cf.ocf_to_current_liabilities, format: 'num' },
      ],
    },
    {
      title: 'Efikasnost',
      rows: [
        { label: 'Asset Turnover',        value: eff.asset_turnover,              format: 'num' },
        { label: 'Receivables Turnover',  value: eff.receivables_turnover,        format: 'num' },
        { label: 'DSO (dani)',            value: eff.days_sales_outstanding,      format: 'days' },
        { label: 'Inventory Turnover',    value: eff.inventory_turnover,          format: 'num' },
        { label: 'DIO (dani)',            value: eff.days_inventory_outstanding,  format: 'days' },
      ],
    },
  ]
}

function fmt(value: number | null | undefined, format: KPIRow['format']): string {
  if (value == null) return '—'
  switch (format) {
    case 'pct':      return fmtPct(value)
    case 'currency': return fmtCurrency(value)
    case 'days':     return `${Math.round(value)} dana`
    default:         return fmtNum(value)
  }
}

function ValueCell({ value, format, metric }: Pick<KPIRow, 'value' | 'format' | 'metric'>) {
  if (value == null) return <span className="text-gray-400">—</span>
  const status = metric ? kpiStatus(metric, value) : 'neutral'
  const color = status === 'good' ? RISK_COLORS.good
    : status === 'warn' ? RISK_COLORS.warning
    : status === 'bad'  ? RISK_COLORS.high_risk
    : '#374151'
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {fmt(value, format)}
    </span>
  )
}

export default function KPIPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [kpiData, setKpiData] = useState<KPIResponse | null>(null)
  const [trend, setTrend]     = useState<KPITrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      companies.get(id),
      kpiApi.get(id, YEAR),
      kpiApi.trend(id),
    ]).then(([co, kp, tr]) => {
      if (co.status === 'fulfilled') setCompany(co.value)
      if (kp.status === 'fulfilled') setKpiData(kp.value)
      if (tr.status === 'fulfilled') setTrend(tr.value.points)
      setLoading(false)
    })
  }, [id])

  if (loading) return <PageSpinner />

  const sections = kpiData ? buildSections(kpiData) : []

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Detalji</h1>
          <p className="mt-1 text-sm text-gray-500">{company?.name} · {YEAR}</p>
        </div>
        <Link href={`/companies/${id}`}>
          <span className="text-sm text-primary-700 hover:underline cursor-pointer">← Nazad na pregled</span>
        </Link>
      </div>

      {!kpiData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-gray-400">
              KPI podaci nisu dostupni za {YEAR}. Uploadajte finansijski izvještaj.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {sections.map(section => (
              <Card key={section.title}>
                <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
                <CardContent>
                  <div className="divide-y divide-gray-50">
                    {section.rows.map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <span className="text-sm text-gray-600">{row.label}</span>
                        <ValueCell value={row.value} format={row.format} metric={row.metric} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {trend.length > 1 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Trend marži</CardTitle></CardHeader>
                <CardContent>
                  <KPITrendChart points={trend} mode="margins" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Finansijski koeficijenti</CardTitle></CardHeader>
                <CardContent>
                  <KPITrendChart points={trend} mode="ratios" />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
