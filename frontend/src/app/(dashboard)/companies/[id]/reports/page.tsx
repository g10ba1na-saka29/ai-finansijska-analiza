'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { reports, score, companies } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { fmtDate, cn } from '@/lib/utils'
import type { FinancialReport, Company } from '@/types'

const REPORT_TYPES = [
  { value: 'annual_report', label: 'Godišnji izvještaj',  icon: '📊' },
  { value: 'balance_sheet', label: 'Bilans stanja',       icon: '⚖️'  },
  { value: 'income',        label: 'Bilans uspjeha',      icon: '📈' },
  { value: 'cash_flow',     label: 'Cash Flow',           icon: '💵' },
  { value: 'tax',           label: 'Poreski bilans',      icon: '🧾' },
  { value: 'audit',         label: 'Revizorski izvještaj', icon: '🔍' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  done:       { label: 'Obrađeno',    color: '#10b981', bg: 'rgba(16,185,129,.08)',  dot: 'bg-emerald-400' },
  processing: { label: 'Procesira',   color: '#6366f1', bg: 'rgba(99,102,241,.08)',  dot: 'bg-indigo-400'  },
  pending:    { label: 'Na čekanju',  color: '#f59e0b', bg: 'rgba(245,158,11,.08)',  dot: 'bg-amber-400'   },
  error:      { label: 'Greška',      color: '#ef4444', bg: 'rgba(239,68,68,.08)',   dot: 'bg-red-400'     },
}

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>()
  const fileRef = useRef<HTMLInputElement>(null)

  const [company,   setCompany]   = useState<Company | null>(null)
  const [list,      setList]      = useState<FinancialReport[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [year,      setYear]      = useState(String(new Date().getFullYear() - 1))
  const [type,      setType]      = useState('balance_sheet')
  const [dragOver,  setDragOver]  = useState(false)
  const [calcYear,  setCalcYear]  = useState<number | null>(null)

  const load = useCallback(() =>
    reports.list(id).then(r => setList(r.items)).finally(() => setLoading(false)),
    [id]
  )

  useEffect(() => {
    companies.get(id).then(setCompany).catch(() => {})
    load()
  }, [id, load])

  // Poll when any report is in-progress
  useEffect(() => {
    const processing = list.some(r => ['pending', 'processing'].includes(r.status))
    if (!processing) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [list, load])

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    setUploading(true)
    try {
      await reports.upload(id, file, Number(year), type)
      if (fileRef.current) fileRef.current.value = ''
      toast.success('Izvještaj uploadovan', 'PDF je u redu za procesiranje')
      load()
    } catch (e) {
      toast.error('Greška pri uploadu', e instanceof Error ? e.message : 'Pokušajte ponovo')
    } finally {
      setUploading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) { toast.warning('Samo PDF fajlovi', 'Odaberite PDF dokument'); return }
    handleUpload(file)
  }

  // ── Calculate ───────────────────────────────────────────────────────────────
  async function triggerCalc(fiscal_year: number) {
    setCalcYear(fiscal_year)
    try {
      await score.calculate(id, fiscal_year)
      toast.success(`KPI kalkulacija pokrenuta za ${fiscal_year}`, 'Pričekajte par sekundi, zatim osvježite stranicu detalja')
    } catch (e) {
      toast.error('Greška pri kalkulaciji', e instanceof Error ? e.message : 'Pokušajte ponovo')
    } finally {
      setCalcYear(null)
    }
  }

  // ── Reparse ─────────────────────────────────────────────────────────────────
  async function triggerReparse(reportId: string) {
    try {
      await reports.reparse(reportId)
      toast.info('Re-parsiranje pokrenuto', 'Pričekajte nekoliko sekundi')
      load()
    } catch (e) {
      toast.error('Greška pri re-parsiranju', e instanceof Error ? e.message : 'Pokušajte ponovo')
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(reportId: string, label: string) {
    if (!confirm(`Obrisati izvještaj "${label}"? Ova akcija je nepovratna.`)) return
    try {
      await reports.delete(reportId)
      toast.success('Izvještaj obrisan')
      load()
    } catch (e) {
      toast.error('Greška pri brisanju', e instanceof Error ? e.message : 'Pokušajte ponovo')
    }
  }

  if (loading) return <PageSpinner />

  const doneReports = list.filter(r => r.status === 'done')
  const availableYears = [...new Set(doneReports.map(r => r.fiscal_year))].sort((a, b) => b - a)

  return (
    <div className="min-h-full p-8 space-y-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <Link href="/companies" className="hover:text-slate-600 transition-colors">Kompanije</Link>
          <span>/</span>
          <Link href={`/companies/${id}`} className="hover:text-slate-600 transition-colors">{company?.name ?? '…'}</Link>
          <span>/</span>
          <span className="text-slate-600 font-medium">Izvještaji</span>
        </div>
        <h1 className="page-title">Finansijski izvještaji</h1>
        <p className="page-sub">{list.length} {list.length === 1 ? 'izvještaj' : 'izvještaja'} ukupno</p>
      </div>

      {/* ── Upload card ───────────────────────────────────────────────── */}
      <Card className="animate-fade-in-up delay-75">
        <CardHeader><CardTitle>Upload novog izvještaja</CardTitle></CardHeader>
        <CardContent className="space-y-5">

          {/* Controls row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Fiskalna godina</label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-full rounded-xl border-0 py-2.5 px-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-600 bg-white"
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tip izvještaja</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full rounded-xl border-0 py-2.5 px-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-600 bg-white"
              >
                {REPORT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Drag & drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={cn(
              'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-all duration-200',
              dragOver
                ? 'border-indigo-400 bg-indigo-50/60 scale-[1.01]'
                : 'border-gray-200 bg-slate-50/80 hover:border-indigo-300 hover:bg-indigo-50/30',
              uploading && 'pointer-events-none opacity-60',
            )}
          >
            {uploading ? (
              <>
                <svg className="h-8 w-8 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm font-medium text-indigo-600">Uploadujem...</p>
              </>
            ) : (
              <>
                <div className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200',
                  dragOver ? 'bg-indigo-100' : 'bg-white shadow-sm ring-1 ring-gray-100'
                )}>
                  <UploadIcon className={cn('h-6 w-6 transition-colors', dragOver ? 'text-indigo-500' : 'text-slate-400')} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {dragOver ? 'Pusti fajl ovdje' : 'Prevuci PDF ovdje ili klikni za odabir'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Podržani format: PDF · Maks. 50MB</p>
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
          </div>
        </CardContent>
      </Card>

      {/* ── KPI trigger (if done reports exist) ───────────────────────── */}
      {availableYears.length > 0 && (
        <Card className="animate-fade-in-up delay-100">
          <CardHeader>
            <CardTitle>Pokretanje KPI analize</CardTitle>
            <p className="text-xs text-gray-400">Pokrenite kalkulaciju score-a za uploadovane izvještaje</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => triggerCalc(y)}
                  disabled={calcYear === y}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
                    calcYear === y
                      ? 'cursor-not-allowed bg-indigo-100 text-indigo-400'
                      : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:shadow-md hover:scale-105'
                  )}
                >
                  {calcYear === y ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <SparklesIcon className="h-3.5 w-3.5" />
                  )}
                  Izračunaj {y}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Kalkulacija uključuje sve KPI, finansijski score i Altman Z'' model.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Reports list ──────────────────────────────────────────────── */}
      <Card className="animate-fade-in-up delay-150">
        <CardHeader>
          <CardTitle>Uploadovani izvještaji</CardTitle>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{list.length}</span>
        </CardHeader>

        {list.length === 0 ? (
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <DocumentIcon className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">Nema uploadovanih izvještaja</p>
            <p className="mt-1 text-xs text-slate-400">Prevucite PDF gore da biste dodali prvi izvještaj</p>
          </CardContent>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((r, i) => {
              const rType = REPORT_TYPES.find(t => t.value === r.report_type)
              const sMeta = STATUS_META[r.status] ?? STATUS_META.pending
              return (
                <div
                  key={r.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="group flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50/70 animate-fade-in"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Type icon */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: `${sMeta.bg}`, border: `1px solid ${sMeta.color}22` }}
                    >
                      {rType?.icon ?? '📄'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {rType?.label ?? r.report_type}
                        </span>
                        <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          {r.fiscal_year}
                        </span>
                        {/* Status pill */}
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: sMeta.bg, color: sMeta.color }}
                        >
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            sMeta.dot,
                            r.status === 'processing' && 'animate-pulse'
                          )} />
                          {sMeta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Uploadovano {fmtDate(r.uploaded_at)}
                      </p>
                      {r.error_message && (
                        <p className="mt-1 text-xs text-red-500 max-w-sm">{r.error_message}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4">
                    {r.status === 'done' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => triggerReparse(r.id)}
                      >
                        Re-parse
                      </Button>
                    )}
                    {r.status === 'error' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => triggerReparse(r.id)}
                      >
                        Pokušaj ponovo
                      </Button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id, `${rType?.label ?? r.report_type} ${r.fiscal_year}`)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
