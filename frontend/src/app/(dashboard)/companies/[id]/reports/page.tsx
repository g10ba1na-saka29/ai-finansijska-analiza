'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { reports, score } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { fmtDate } from '@/lib/utils'
import type { FinancialReport } from '@/types'

const REPORT_TYPES = [
  { value: 'balance_sheet', label: 'Bilans stanja' },
  { value: 'income',        label: 'Bilans uspjeha' },
  { value: 'cash_flow',     label: 'Cash Flow' },
  { value: 'tax',           label: 'Poreski bilans' },
  { value: 'audit',         label: 'Revizorski izvještaj' },
]

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>()
  const fileRef = useRef<HTMLInputElement>(null)
  const [list, setList]           = useState<FinancialReport[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [year, setYear]           = useState(String(new Date().getFullYear() - 1))
  const [type, setType]           = useState('balance_sheet')
  const [error, setError]         = useState('')

  const load = () =>
    reports.list(id).then(r => setList(r.items)).finally(() => setLoading(false))

  useEffect(() => { load() }, [id])

  // Poll processing reports every 5 s
  useEffect(() => {
    const processing = list.some(r => ['pending', 'processing'].includes(r.status))
    if (!processing) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [list])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Odaberite PDF fajl'); return }
    setError('')
    setUploading(true)
    try {
      await reports.upload(id, file, Number(year), type)
      fileRef.current!.value = ''
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri uploadu')
    } finally {
      setUploading(false)
    }
  }

  async function triggerCalc(fiscal_year: number) {
    await score.calculate(id, fiscal_year)
    alert('KPI + score kalkulacija pokrenuta')
  }

  if (loading) return <PageSpinner />

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Finansijski izvještaji</h1>

      {/* Upload forma */}
      <Card>
        <CardHeader><CardTitle>Upload PDF izvještaja</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fiskalna godina</label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="rounded-lg border-0 py-2 px-3 text-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tip izvještaja</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="rounded-lg border-0 py-2 px-3 text-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">PDF fajl</label>
              <input ref={fileRef} type="file" accept=".pdf" className="text-sm text-gray-600" />
            </div>
            <Button onClick={handleUpload} loading={uploading}>Upload</Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Lista izvještaja */}
      <Card>
        <CardHeader><CardTitle>Uploadovani izvještaji ({list.length})</CardTitle></CardHeader>
        {list.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-gray-400">
            Još nema uploadovanih izvještaja.
          </CardContent>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map(r => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {REPORT_TYPES.find(t => t.value === r.report_type)?.label ?? r.report_type}
                    </span>
                    <span className="text-xs text-gray-400">— {r.fiscal_year}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">Uploadovano: {fmtDate(r.uploaded_at)}</p>
                  {r.error_message && <p className="mt-0.5 text-xs text-red-500">{r.error_message}</p>}
                </div>
                {r.status === 'done' && (
                  <Button size="sm" variant="secondary" onClick={() => triggerCalc(r.fiscal_year)}>
                    Izračunaj KPI
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
