'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { companies } from '@/lib/api'
import type { Company } from '@/types'
import { COMPANY_GRADIENTS, getCompanyGradient, setCompanyGradient } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

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

export default function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [company,   setCompany]   = useState<Company | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [apiError,  setApiError]  = useState('')
  const [colorIdx,  setColorIdx]  = useState(0)
  const [mounted,   setMounted]   = useState(false)

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  // load company + stored colour on mount
  useEffect(() => {
    async function load() {
      try {
        const c = await companies.get(id)
        setCompany(c)
        reset({
          name:     c.name,
          tax_id:   c.tax_id   ?? '',
          industry: c.industry ?? '',
          country:  c.country,
        })
        // colour: stored index or deterministic fallback
        const stored = localStorage.getItem(`bilansia_co_color_${id}`)
        if (stored !== null) {
          setColorIdx(parseInt(stored, 10))
        } else {
          const grad = getCompanyGradient(id)
          const idx  = COMPANY_GRADIENTS.findIndex(g => g.from === grad.from)
          setColorIdx(idx >= 0 ? idx : 0)
        }
      } catch {
        setApiError('Greška pri učitavanju podataka kompanije.')
      } finally {
        setLoading(false)
        setMounted(true)
      }
    }
    load()
  }, [id, reset])

  const watchedName   = watch('name') ?? company?.name ?? ''
  const avatarInitial = watchedName[0]?.toUpperCase() ?? '?'
  const grad          = COMPANY_GRADIENTS[colorIdx]

  async function onSubmit(data: Form) {
    setApiError('')
    try {
      await companies.update(id, {
        name:     data.name,
        tax_id:   data.tax_id   || undefined,
        industry: data.industry || undefined,
        country:  data.country,
      })
      setCompanyGradient(id, colorIdx)
      router.push(`/companies/${id}`)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Greška pri ažuriranju')
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  if (!company && !loading) {
    return (
      <div className="p-8">
        <p className="text-red-500">{apiError || 'Kompanija nije pronađena.'}</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.back()}>Nazad</Button>
      </div>
    )
  }

  if (!mounted) return null

  return (
    <div className="p-8">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="page-title">Uredi kompaniju</h1>
        <p className="page-sub">Ažurirajte podatke za <span className="font-semibold text-gray-700">{company?.name}</span></p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* ── Form ─────────────────────────────────────────────────────── */}
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

              {/* ── Colour picker ──────────────────────────────────────── */}
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
                        <>
                          <span className="absolute inset-0 flex items-center justify-center">
                            <svg className="h-4 w-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                          <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-2 ring-offset-white" />
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {apiError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={isSubmitting}>Sačuvaj izmjene</Button>
                <Button type="button" variant="secondary" onClick={() => router.push(`/companies/${id}`)}>
                  Odustani
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Live preview ──────────────────────────────────────────────── */}
        <div className="animate-fade-in-up delay-150 lg:w-64">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Preview</p>
          <div
            className="rounded-2xl border border-gray-100 bg-white p-5"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md transition-all duration-300"
                style={{
                  background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
                  boxShadow: `0 6px 20px ${grad.from}55`,
                }}
              >
                {avatarInitial}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {watchedName || company?.name || 'Naziv kompanije'}
                </p>
                <p className="text-xs text-slate-400">{company?.country ?? 'BA'}</p>
              </div>
            </div>

            <div
              className="h-1 w-full rounded-full mb-3 transition-all duration-300"
              style={{ background: `linear-gradient(90deg, ${grad.from}, ${grad.to})` }}
            />

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ovako će kompanija izgledati na dashboardu. Boju i naziv možeš promijeniti u svakom trenutku.
            </p>
          </div>

          {/* Danger zone */}
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
            <p className="text-xs font-semibold text-red-700 mb-2">Zona opasnosti</p>
            <p className="text-[11px] text-red-500 mb-3 leading-relaxed">
              Brisanje kompanije je trajna akcija i ne može se poništiti.
            </p>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm(`Jeste li sigurni da želite obrisati "${company?.name}"? Ova akcija je nepovratna.`)) {
                  companies.delete(id).then(() => router.push('/companies'))
                }
              }}
            >
              Obriši kompaniju
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
