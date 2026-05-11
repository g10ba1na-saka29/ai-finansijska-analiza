'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { companies } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { COMPANY_GRADIENTS, setCompanyGradient } from '@/lib/utils'

const schema = z.object({
  name:     z.string().min(2, 'Naziv je obavezan'),
  tax_id:   z.string().optional(),
  industry: z.string().optional(),
  country:  z.string().length(2),
})
type Form = z.infer<typeof schema>

const INDUSTRIES = [
  'Manufacturing', 'Construction', 'Retail', 'Technology',
  'Services', 'Healthcare', 'Finance', 'Agriculture', 'Transport', 'Other',
]

export default function NewCompanyPage() {
  const router = useRouter()
  const [apiError, setApiError] = useState('')
  const [colorIdx, setColorIdx] = useState(0)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'BA' },
  })

  const watchedName   = watch('name') ?? ''
  const avatarInitial = watchedName[0]?.toUpperCase() ?? '?'
  const grad          = COMPANY_GRADIENTS[colorIdx]

  async function onSubmit(data: Form) {
    setApiError('')
    try {
      const company = await companies.create(data)
      // Persist colour choice in localStorage
      setCompanyGradient(company.id, colorIdx)
      router.push(`/companies/${company.id}`)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Greška')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="page-title">Nova kompanija</h1>
        <p className="page-sub">Dodajte kompaniju za finansijsku analizu</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* ── Form ─────────────────────────────────────────────────── */}
        <Card className="w-full max-w-lg animate-fade-in-up delay-75">
          <CardHeader><CardTitle>Podaci o kompaniji</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              <Input
                label="Naziv kompanije *"
                placeholder="Firma d.o.o."
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="PIB / JIB / OIB"
                placeholder="Porezni identifikacioni broj"
                {...register('tax_id')}
              />
              <Select label="Industrija" {...register('industry')}>
                <option value="">— Odaberite —</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </Select>
              <Select label="Zemlja" {...register('country')}>
                <option value="BA">Bosna i Hercegovina</option>
                <option value="RS">Srbija</option>
                <option value="HR">Hrvatska</option>
                <option value="ME">Crna Gora</option>
                <option value="MK">Sjeverna Makedonija</option>
              </Select>

              {/* ── Colour picker ─────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Boja avatara
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {COMPANY_GRADIENTS.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setColorIdx(i)}
                      title={`Boja ${i + 1}`}
                      className="relative h-8 w-8 rounded-full transition-all duration-150 hover:scale-110 focus:outline-none"
                      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                    >
                      {colorIdx === i && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg className="h-4 w-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </span>
                      )}
                      {colorIdx === i && (
                        <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-2 ring-offset-white" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Boja se koristi za vizualnu identifikaciju kompanije u listi i na dashboardu.
                </p>
              </div>

              {apiError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={isSubmitting}>Kreiraj kompaniju</Button>
                <Button type="button" variant="secondary" onClick={() => router.back()}>Odustani</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Live preview ─────────────────────────────────────────── */}
        <div className="animate-fade-in-up delay-150 lg:w-64">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Preview</p>
          <div
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}
          >
            {/* Avatar preview */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md transition-all duration-300"
                style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`, boxShadow: `0 6px 20px ${grad.from}55` }}
              >
                {avatarInitial}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {watchedName || 'Naziv kompanije'}
                </p>
                <p className="text-xs text-slate-400">Nova kompanija</p>
              </div>
            </div>

            {/* Colour stripe preview */}
            <div
              className="h-1 w-full rounded-full mb-3 transition-all duration-300"
              style={{ background: `linear-gradient(90deg, ${grad.from}, ${grad.to})` }}
            />

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ovako će kompanija izgledati na dashboardu i u listama.
              Boju možeš promijeniti u postavkama kompanije.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
