'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { companies, score as scoreApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { fmtNum } from '@/lib/utils'
import type { Company, ScoreResponse } from '@/types'

const YEAR = new Date().getFullYear() - 1

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing:  'Proizvodnja',
  retail:         'Maloprodaja',
  services:       'Usluge',
  construction:   'Građevinarstvo',
  agriculture:    'Poljoprivreda',
  technology:     'Tehnologija',
  finance:        'Finansije',
  healthcare:     'Zdravstvo',
  energy:         'Energetika',
  other:          'Ostalo',
}

interface Row {
  company: Company
  score: ScoreResponse | null
}

export default function CompaniesPage() {
  const router = useRouter()
  const [rows, setRows]       = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    async function load() {
      const res  = await companies.list()
      const list = res.items
      const scores = await Promise.allSettled(
        list.map(c => scoreApi.get(c.id, YEAR))
      )
      setRows(list.map((c, i) => ({
        company: c,
        score: scores[i].status === 'fulfilled' ? scores[i].value : null,
      })))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <PageSpinner />

  const lower = search.toLowerCase()
  const filtered = rows.filter(r =>
    r.company.name.toLowerCase().includes(lower) ||
    (r.company.tax_id ?? '').includes(search)
  )

  const sorted = [...filtered].sort((a, b) =>
    (b.score?.total_score ?? -1) - (a.score?.total_score ?? -1)
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kompanije</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} kompanija ukupno</p>
        </div>
        <Link href="/companies/new">
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 transition-colors">
            <span className="text-lg leading-none">+</span>
            Nova kompanija
          </button>
        </Link>
      </div>

      <div className="max-w-sm">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pretraži po nazivu ili JIB..."
          className="w-full rounded-lg border-0 py-2 px-3 text-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-gray-400">
              {search ? 'Nema rezultata za tu pretragu.' : 'Još nema dodanih kompanija.'}
            </p>
            {!search && (
              <Link href="/companies/new">
                <button className="mt-4 text-sm font-medium text-primary-700 hover:underline">
                  Dodaj prvu kompaniju →
                </button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Kompanija</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Djelatnost</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">PDV / JIB</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Score {YEAR}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rizik</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(({ company: c, score }) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/companies/${c.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.country && (
                      <div className="text-xs text-gray-400 mt-0.5">{c.country.toUpperCase()}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {INDUSTRY_LABELS[c.industry ?? ''] ?? c.industry ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {c.tax_id ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {score ? (
                      <span className="text-lg font-bold text-gray-900">
                        {fmtNum(score.total_score)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {score ? (
                      <RiskBadge risk={score.risk_level} />
                    ) : (
                      <span className="text-xs text-gray-400">Nema podataka</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/companies/${c.id}`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      Detalji →
                    </Link>
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
