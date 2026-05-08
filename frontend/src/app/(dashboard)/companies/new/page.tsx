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

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'BA' },
  })

  async function onSubmit(data: Form) {
    setApiError('')
    try {
      const company = await companies.create(data)
      router.push(`/companies/${company.id}`)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Greška')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova kompanija</h1>
        <p className="mt-1 text-sm text-gray-500">Dodajte kompaniju za analizu</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader><CardTitle>Podaci o kompaniji</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Naziv kompanije *" placeholder="Firma d.o.o." error={errors.name?.message} {...register('name')} />
            <Input label="PIB / JIB / OIB" placeholder="Porezni identifikacioni broj" {...register('tax_id')} />
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

            {apiError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={isSubmitting}>Kreiraj kompaniju</Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
