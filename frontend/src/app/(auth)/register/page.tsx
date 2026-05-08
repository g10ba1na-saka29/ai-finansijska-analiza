'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  org_name:  z.string().min(2, 'Unesite naziv organizacije'),
  email:     z.string().email('Unesite validan email'),
  password:  z.string().min(8, 'Minimalno 8 karaktera'),
  password2: z.string(),
}).refine(d => d.password === d.password2, {
  message: 'Lozinke se ne poklapaju',
  path: ['password2'],
})
type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [apiError, setApiError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setApiError('')
    try {
      const tokens = await auth.register(data.email, data.password, data.org_name)
      localStorage.setItem('access_token', tokens.access_token)
      const me = await auth.me()
      setAuth(me, tokens.access_token, tokens.refresh_token)
      router.push('/dashboard')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Greška pri registraciji')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-700">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-3C9.75 9.504 10.254 9 10.875 9h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zm6.75-5.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.375c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Kreirajte nalog</h1>
          <p className="mt-1 text-sm text-gray-500">Počnite s analizom vaših kompanija</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <Input
            label="Naziv organizacije"
            placeholder="Vaša firma d.o.o."
            error={errors.org_name?.message}
            {...register('org_name')}
          />
          <Input
            label="Email"
            type="email"
            placeholder="vas@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Lozinka"
            type="password"
            placeholder="Minimalno 8 karaktera"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Potvrdi lozinku"
            type="password"
            placeholder="••••••••"
            error={errors.password2?.message}
            {...register('password2')}
          />

          {apiError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Registracija
          </Button>

          <p className="text-center text-sm text-gray-500">
            Već imate nalog?{' '}
            <Link href="/login" className="font-medium text-primary-700 hover:underline">
              Prijavite se
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
