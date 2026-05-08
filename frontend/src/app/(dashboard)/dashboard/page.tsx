'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { companies, score } from '@/lib/api'
import { RiskBadge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { ScoreGauge } from '@/components/charts/ScoreGauge'
import { fmtDate, scoreToRisk } from '@/lib/utils'
import type { Company, ScoreResponse } from '@/types'

export default function DashboardPage() {
  const [companyList, setCompanyList] = useState<Company[]>([])
  const [scores, setScores] = useState<Record<string, ScoreResponse>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    companies.list(0, 10).then(res => {
      setCompanyList(res.items)
      // Dohvati zadnji score za svaku kompaniju (tekuća godina)
      const year = new Date().getFullYear() - 1
      Promise.allSettled(
        res.items.map(c =>
          score.get(c.id, year).then(s => [c.id, s] as [string, ScoreResponse])
        )
      ).then(results => {
        const map: Record<string, ScoreResponse> = {}
        results.forEach(r => { if (r.status === 'fulfilled') map[r.value[0]] = r.value[1] })
        setScores(map)
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  const avgScore = Object.values(scores).length
    ? Object.values(scores).reduce((a, s) => a + s.total_score, 0) / Object.values(scores).length
    : null

  const highRisk = Object.values(scores).filter(s => ['high_risk', 'critical'].includes(s.risk_level)).length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pregled</h1>
        <p className="mt-1 text-sm text-gray-500">Finansijsko stanje vaših kompanija</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-gray-500">Ukupno kompanija</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{companyList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-gray-500">Prosječni score</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {avgScore != null ? avgScore.toFixed(1) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-gray-500">Visok rizik</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{highRisk}</p>
          </CardContent>
        </Card>
      </div>

      {/* Company list */}
      <Card>
        <CardHeader>
          <CardTitle>Kompanije</CardTitle>
          <Link href="/companies/new" className="text-sm font-medium text-primary-700 hover:underline">
            + Nova kompanija
          </Link>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {companyList.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Još uvijek nema kompanija.{' '}
              <Link href="/companies/new" className="text-primary-700 hover:underline">
                Dodajte prvu.
              </Link>
            </div>
          )}
          {companyList.map(c => {
            const s = scores[c.id]
            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.industry ?? 'N/A'} · {c.country}</p>
                </div>
                <div className="flex items-center gap-4">
                  {s && (
                    <>
                      <span className="text-xl font-bold" style={{
                        color: ['#2da552','#3399dc','#f2c40a','#e88026','#cc2626'][
                          ['excellent','good','warning','high_risk','critical'].indexOf(s.risk_level)
                        ]
                      }}>
                        {s.total_score.toFixed(0)}
                      </span>
                      <RiskBadge level={s.risk_level} />
                    </>
                  )}
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
