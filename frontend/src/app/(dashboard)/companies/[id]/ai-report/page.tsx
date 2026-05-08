'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { aiReports, companies } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { token } from '@/lib/api'
import type { AIReport, Company } from '@/types'

const YEAR = new Date().getFullYear() - 1

export default function AIReportPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany]     = useState<Company | null>(null)
  const [report, setReport]       = useState<AIReport | null>(null)
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)

  // Q&A state
  const [question, setQuestion]   = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [messages, setMessages]   = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const [co, rep] = await Promise.allSettled([
      companies.get(id),
      aiReports.get(id, YEAR),
    ])
    if (co.status === 'fulfilled') setCompany(co.value)
    if (rep.status === 'fulfilled') setReport(rep.value)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Poll while generating
  useEffect(() => {
    if (report?.status !== 'generating' && report?.status !== 'pending') return
    const t = setInterval(async () => {
      const r = await aiReports.get(id, YEAR).catch(() => null)
      if (r) { setReport(r); if (r.status === 'done' || r.status === 'error') clearInterval(t) }
    }, 4000)
    return () => clearInterval(t)
  }, [report?.status, id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const r = await aiReports.generate(id, YEAR)
      setReport(r)
    } finally {
      setGenerating(false)
    }
  }

  async function handleAsk() {
    if (!question.trim()) return
    const q = question.trim()
    setQuestion('')
    setMessages(m => [...m, { role: 'user', content: q }])
    setQaLoading(true)
    try {
      const res = await aiReports.qa(id, YEAR, q, messages)
      setMessages(m => [...m, { role: 'assistant', content: res.answer }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Greška pri dohvatanju odgovora.' }])
    } finally {
      setQaLoading(false)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Finansijski Izvještaj</h1>
          <p className="mt-1 text-sm text-gray-500">{company?.name} · {YEAR}</p>
        </div>
        <div className="flex items-center gap-3">
          {report && <StatusBadge status={report.status} />}
          {report?.status === 'done' && (
            <a
              href={aiReports.pdfUrl(id, YEAR)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm">
                ↓ Preuzmi PDF
              </Button>
            </a>
          )}
          <Button
            onClick={handleGenerate}
            loading={generating || report?.status === 'generating'}
            size="sm"
          >
            {report ? 'Regeneriši' : 'Generiši izvještaj'}
          </Button>
        </div>
      </div>

      {/* Report content */}
      {report?.status === 'done' ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Main report */}
          <div className="col-span-2 space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader><CardTitle>Sažetak</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-gray-700">{report.summary}</p>
              </CardContent>
            </Card>

            {/* Score explanation */}
            <Card>
              <CardHeader><CardTitle>Obrazloženje score-a</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-gray-700">{report.score_explanation}</p>
              </CardContent>
            </Card>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-green-700">Snage</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.strengths?.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 h-4 w-4 shrink-0 text-green-600">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-red-700">Slabosti</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.weaknesses?.map((w, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 h-4 w-4 shrink-0 text-red-500">✕</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <Card>
              <CardHeader><CardTitle>Preporuke rukovodstvu</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 list-decimal list-inside">
                  {report.recommendations?.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700">{r}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Risk assessment */}
            <Card>
              <CardHeader><CardTitle>Procjena rizika</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-gray-700">{report.risk_assessment}</p>
              </CardContent>
            </Card>

            {/* Outlook */}
            <Card>
              <CardHeader><CardTitle>Outlook</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-gray-700">{report.outlook}</p>
              </CardContent>
            </Card>

            {/* Red flags */}
            {(report.red_flags?.length ?? 0) > 0 && (
              <Card className="ring-red-300">
                <CardHeader><CardTitle className="text-red-700">⚠ Crvene zastavice</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {report.red_flags?.map((f, i) => (
                      <li key={i} className="text-sm text-red-700">{f}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Q&A sidebar */}
          <div className="col-span-1">
            <Card className="sticky top-6 flex flex-col" style={{ maxHeight: '80vh' }}>
              <CardHeader><CardTitle>Pitajte AI</CardTitle></CardHeader>
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    Postavite pitanje o finansijskom stanju kompanije.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-primary-700 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {qaLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-400">
                      Razmišljam...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-gray-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk()}
                    placeholder="Vaše pitanje..."
                    className="flex-1 rounded-lg border-0 py-2 px-3 text-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                  <Button size="sm" onClick={handleAsk} loading={qaLoading} disabled={!question.trim()}>
                    →
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : report?.status === 'error' ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-red-600">Greška pri generisanju: {report.error_message ?? 'Nepoznata greška'}</p>
            <Button className="mt-4" onClick={handleGenerate} loading={generating}>Pokušaj ponovo</Button>
          </CardContent>
        </Card>
      ) : report ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
            <p className="text-sm text-gray-500">AI generiše izvještaj... Ovo može potrajati 30–60 sekundi.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-gray-400 mb-4">
              AI izvještaj nije generisan za {YEAR}. Potrebni su KPI i score podaci.
            </p>
            <Button onClick={handleGenerate} loading={generating}>Generiši AI izvještaj</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
