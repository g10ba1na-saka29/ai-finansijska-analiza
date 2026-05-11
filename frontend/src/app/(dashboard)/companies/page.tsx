'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { companies, score as scoreApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn, fmtNum, getCompanyGradient, COMPANY_GRADIENTS } from '@/lib/utils'
import type { Company, ScoreHistoryPoint } from '@/types'

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing: 'Proizvodnja',
  retail:        'Maloprodaja',
  services:      'Usluge',
  construction:  'Građevinarstvo',
  agriculture:   'Poljoprivreda',
  technology:    'Tehnologija',
  finance:       'Finansije',
  healthcare:    'Zdravstvo',
  energy:        'Energetika',
  other:         'Ostalo',
}

const SCORE_COLOR: Record<string, string> = {
  excellent: '#10b981',
  good:      '#3b82f6',
  warning:   '#f59e0b',
  high_risk: '#f97316',
  critical:  '#ef4444',
}

interface Row {
  company: Company
  score:   ScoreHistoryPoint | null
}

export default function CompaniesPage() {
  const router = useRouter()
  const [rows, setRows]       = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  // Gradients loaded client-side only (localStorage) to avoid SSR hydration mismatch
  const [gradients, setGradients] = useState<Record<string, { from: string; to: string }>>({})

  useEffect(() => {
    setGradients(
      Object.fromEntries(rows.map(({ company: c }) => [c.id, getCompanyGradient(c.id)]))
    )
  }, [rows])

  useEffect(() => {
    companies.list().then(res => {
      const list = res.items
      Promise.allSettled(
        list.map(c => scoreApi.history(c.id).then(h => h.history.at(-1) ?? null))
      ).then(results => {
        setRows(list.map((c, i) => ({
          company: c,
          score: results[i].status === 'fulfilled' ? results[i].value : null,
        })))
        setLoading(false)
      })
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  const lower    = search.toLowerCase()
  const filtered = rows.filter(r =>
    r.company.name.toLowerCase().includes(lower) ||
    (r.company.tax_id ?? '').includes(search)
  )
  const sorted = [...filtered].sort(
    (a, b) => (b.score?.total_score ?? -1) - (a.score?.total_score ?? -1)
  )

  return (
    <div className="min-h-full bg-slate-50/60 p-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="page-title">Kompanije</h1>
          <p className="page-sub">{rows.length} kompanija ukupno</p>
        </div>
        <Link
          href="/companies/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-accent-600 hover:shadow-md"
        >
          <PlusIcon className="h-4 w-4" />
          Nova kompanija
        </Link>
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="max-w-sm animate-fade-in-up delay-75">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pretraži po nazivu ili JIB..."
            className="w-full rounded-xl border-0 py-2 pl-9 pr-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 bg-white shadow-sm"
          />
        </div>
      </div>

      {/* ── Table / empty state ─────────────────────────────────────── */}
      {sorted.length === 0 ? (
        <Card className="animate-fade-in-up delay-100">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <BuildingIcon className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nema rezultata za tu pretragu.' : 'Još nema dodanih kompanija.'}
            </p>
            {!search && (
              <Link
                href="/companies/new"
                className="mt-2 inline-block text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
              >
                Dodaj prvu kompaniju →
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card animate-fade-in-up delay-100">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-slate-50/80">
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Kompanija</th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Djelatnost</th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">JIB / PDV</th>
                <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Score</th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Rizik</th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(({ company: c, score }, i) => (
                <tr
                  key={c.id}
                  style={{ animationDelay: `${120 + i * 40}ms` }}
                  className="group cursor-pointer transition-colors hover:bg-slate-50 animate-fade-in"
                  onClick={() => router.push(`/companies/${c.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${(gradients[c.id] ?? COMPANY_GRADIENTS[0]).from}, ${(gradients[c.id] ?? COMPANY_GRADIENTS[0]).to})` }}
                      >
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                          {c.name}
                        </p>
                        {c.country && (
                          <p className="text-[10px] text-slate-400 uppercase">{c.country}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {INDUSTRY_LABELS[c.industry ?? ''] ?? c.industry ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                    {c.tax_id ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {score ? (
                      <div>
                        <span
                          className="text-lg font-bold tabular-nums"
                          style={{ color: SCORE_COLOR[score.risk_level] ?? '#64748b' }}
                        >
                          {score.total_score.toFixed(0)}
                        </span>
                        <p className="text-[10px] text-slate-400">{score.fiscal_year}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {score ? (
                      <RiskBadge level={score.risk_level} />
                    ) : (
                      <span className="text-xs italic text-slate-400">Nema podataka</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/companies/${c.id}/edit`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs font-medium text-slate-400 transition-all hover:text-indigo-600 inline-flex items-center gap-1"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                        Uredi
                      </Link>
                      <span className="text-xs font-medium text-slate-400 transition-all group-hover:text-primary-600 group-hover:translate-x-0.5 inline-flex items-center gap-1">
                        Detalji
                        <ChevronRightIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}
