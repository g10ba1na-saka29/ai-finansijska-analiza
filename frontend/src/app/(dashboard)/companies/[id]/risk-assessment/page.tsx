'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { riskAnalysis, reports } from '@/lib/api'
import type { AnomalyResult, BankruptcyRisk, AnomalyFlag, DistressLabel } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border border-red-200',
  high:     'bg-orange-100 text-orange-800 border border-orange-200',
  medium:   'bg-amber-100 text-amber-800 border border-amber-200',
  low:      'bg-blue-100 text-blue-800 border border-blue-200',
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Kritično', high: 'Visoko', medium: 'Srednje', low: 'Nisko',
}

const DISTRESS_STYLE: Record<DistressLabel, { bar: string; text: string; label: string }> = {
  very_high: { bar: 'bg-red-500',    text: 'text-red-700',    label: 'Vrlo visok' },
  high:      { bar: 'bg-orange-500', text: 'text-orange-700', label: 'Visok' },
  moderate:  { bar: 'bg-amber-500',  text: 'text-amber-700',  label: 'Umjeren' },
  low:       { bar: 'bg-green-500',  text: 'text-green-700',  label: 'Nizak' },
  very_low:  { bar: 'bg-emerald-500',text: 'text-emerald-700',label: 'Vrlo nizak' },
}

const PIO_CATEGORY_STYLE: Record<string, string> = {
  strong:  'text-emerald-700 bg-emerald-50 border border-emerald-200',
  neutral: 'text-blue-700 bg-blue-50 border border-blue-200',
  weak:    'text-red-700 bg-red-50 border border-red-200',
}
const PIO_CATEGORY_LABEL: Record<string, string> = {
  strong: 'Jaka', neutral: 'Neutralna', weak: 'Slaba',
}

function sortedAnomalies(flags: AnomalyFlag[]): AnomalyFlag[] {
  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  return [...flags].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
}

// ── Komponente ────────────────────────────────────────────────────────────────

function AnomalyCard({ flag }: { flag: AnomalyFlag }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
      <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full ${SEVERITY_STYLE[flag.severity]}`}>
        {SEVERITY_LABEL[flag.severity]}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{flag.label}</p>
        <p className="text-sm text-slate-500 mt-0.5">{flag.description}</p>
        {flag.value !== null && (
          <p className="text-xs text-slate-400 mt-1">
            Vrijednost: <span className="font-mono">{typeof flag.value === 'number' ? flag.value.toFixed(3) : flag.value}</span>
            {flag.previous_value !== null && (
              <> · Prethodna: <span className="font-mono">{flag.previous_value.toFixed(3)}</span></>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function DistressGauge({ prob, label }: { prob: number; label: DistressLabel }) {
  const style = DISTRESS_STYLE[label]
  const pct   = Math.round(prob * 100)
  // SVG arc gauge
  const R = 70, stroke = 14
  const circ = Math.PI * R  // half circle
  const dash = circ * prob
  const gap  = circ - dash

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="90" viewBox="-10 0 180 95">
        {/* Background arc */}
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none"
          stroke={label === 'very_high' ? '#ef4444' : label === 'high' ? '#f97316' : label === 'moderate' ? '#f59e0b' : label === 'low' ? '#22c55e' : '#10b981'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
        <text x="80" y="78" textAnchor="middle" className="font-bold" fontSize="24" fill="#1e293b">{pct}%</text>
        <text x="80" y="95" textAnchor="middle" fontSize="11" fill="#64748b">{style.label}</text>
      </svg>
    </div>
  )
}

// ── Stranica ──────────────────────────────────────────────────────────────────

export default function RiskAssessmentPage() {
  const params  = useParams<{ id: string }>()
  const id      = params.id

  const [year, setYear]         = useState<number | null>(null)
  const [years, setYears]       = useState<number[]>([])
  const [anomaly, setAnomaly]   = useState<AnomalyResult | null>(null)
  const [bkRisk, setBkRisk]     = useState<BankruptcyRisk | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Učitaj dostupne godine iz izvještaja
  useEffect(() => {
    reports.list(id).then(r => {
      const done = r.items
        .filter(rep => rep.status === 'done')
        .map(rep => rep.fiscal_year)
      const unique = [...new Set(done)].sort((a, b) => b - a)
      setYears(unique)
      if (unique.length > 0) setYear(unique[0])
    }).catch(() => {})
  }, [id])

  // Učitaj podatke kad se promijeni godina
  useEffect(() => {
    if (!year) return
    setLoading(true)
    setError(null)
    setAnomaly(null)
    setBkRisk(null)

    Promise.all([
      riskAnalysis.anomalies(id, year),
      riskAnalysis.bankruptcyRisk(id, year),
    ])
      .then(([a, b]) => { setAnomaly(a); setBkRisk(b) })
      .catch(e => setError(e.message ?? 'Greška pri učitavanju'))
      .finally(() => setLoading(false))
  }, [id, year])

  const sortedFlags = anomaly ? sortedAnomalies(anomaly.anomalies) : []
  const nCrit = sortedFlags.filter(f => f.severity === 'critical').length
  const nHigh = sortedFlags.filter(f => f.severity === 'high').length

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/companies/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Nazad na kompaniju
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Analiza rizika</h1>
          <p className="text-sm text-slate-500">Anomaly detection · Piotroski F-Score · Distress probability</p>
        </div>
        {years.length > 0 && (
          <select
            value={year ?? ''}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-500">Analiziranje...</div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && anomaly && bkRisk && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Lijeva kolona: Anomalije ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Summary card */}
            <div className={`p-4 rounded-xl border-2 ${
              nCrit > 0 ? 'bg-red-50 border-red-200' :
              nHigh > 0 ? 'bg-orange-50 border-orange-200' :
              sortedFlags.length > 0 ? 'bg-amber-50 border-amber-200' :
              'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {nCrit > 0 ? '🚨' : nHigh > 0 ? '⚠️' : sortedFlags.length > 0 ? '📊' : '✅'}
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{anomaly.summary}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Metode: {anomaly.methods_used.join(', ')} · Risk score: {anomaly.risk_score}/100
                  </p>
                  {nCrit > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                        {nCrit} kritičnih
                      </span>
                      {nHigh > 0 && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                          {nHigh} visokih
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lista anomalija */}
            <div>
              <h2 className="text-base font-semibold text-slate-700 mb-3">
                Detektovane anomalije
                {sortedFlags.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                    {sortedFlags.length}
                  </span>
                )}
              </h2>
              {sortedFlags.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-medium">Nisu pronađene anomalije</p>
                  <p className="text-xs mt-1">Finansijski podaci su unutar normalnih parametara</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedFlags.map((flag, i) => (
                    <AnomalyCard key={i} flag={flag} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Desna kolona: Bankruptcy Risk ──────────────────────────────── */}
          <div className="space-y-4">

            {/* Distress probability */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-700 mb-4 text-center">
                Vjerovatnoća finansijskog sloma
              </h2>
              <DistressGauge
                prob={bkRisk.distress_probability}
                label={bkRisk.distress_label}
              />
              <div className="mt-4 space-y-2 text-xs text-slate-500">
                {bkRisk.altman_z_score !== null && (
                  <div className="flex justify-between">
                    <span>Altman Z-Score</span>
                    <span className="font-mono font-medium text-slate-700">
                      {bkRisk.altman_z_score.toFixed(2)}
                      <span className="ml-1 text-slate-400">({bkRisk.altman_zone})</span>
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Piotroski F-Score</span>
                  <span className="font-mono font-medium text-slate-700">
                    {bkRisk.piotroski.score}/{bkRisk.piotroski.available}
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${PIO_CATEGORY_STYLE[bkRisk.piotroski.category]}`}>
                      {PIO_CATEGORY_LABEL[bkRisk.piotroski.category]}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Piotroski F-Score signali */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-700 mb-3">
                Piotroski F-Score
              </h2>
              <div className="space-y-2">
                {bkRisk.piotroski.signals.map(sig => (
                  <div key={sig.name} className="flex items-start gap-2">
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                      sig.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {sig.passed ? '✓' : '✗'}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-slate-500">{sig.name}</span>
                      <p className="text-xs text-slate-600">{sig.description}</p>
                      {sig.value !== null && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          {sig.value > 0 ? '+' : ''}{sig.value.toFixed(3)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {bkRisk.piotroski.signals.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    Potrebni podaci za prethodnu godinu
                  </p>
                )}
              </div>
            </div>

            {/* Faktori */}
            {(bkRisk.risk_factors.length > 0 || bkRisk.positive_factors.length > 0) && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                {bkRisk.positive_factors.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                      Pozitivni faktori
                    </h3>
                    <ul className="space-y-1">
                      {bkRisk.positive_factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="text-emerald-500 shrink-0 mt-0.5">▸</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {bkRisk.risk_factors.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                      Faktori rizika
                    </h3>
                    <ul className="space-y-1">
                      {bkRisk.risk_factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="text-red-400 shrink-0 mt-0.5">▸</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {!loading && !error && !anomaly && !year && (
        <div className="p-8 text-center text-slate-400">
          <p>Nema završenih izvještaja za analizu rizika.</p>
        </div>
      )}
    </div>
  )
}
