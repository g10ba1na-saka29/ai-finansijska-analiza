'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { COMPANY_GRADIENTS, getUserAvatarGradient } from '@/lib/utils'
import { dispatchProfileUpdated } from '@/hooks/useUserProfile'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

// ── localStorage keys ────────────────────────────────────────────────────────
const LS_FIRST   = 'bilansia_user_firstname'
const LS_LAST    = 'bilansia_user_lastname'
const LS_AVATAR  = 'bilansia_user_avatar_idx'
const LS_PHOTO   = 'bilansia_user_photo'

// ── Schemas ──────────────────────────────────────────────────────────────────
const nameSchema = z.object({
  firstName: z.string().min(1, 'Obavezno polje'),
  lastName:  z.string().min(1, 'Obavezno polje'),
})
type NameForm = z.infer<typeof nameSchema>

const pwSchema = z.object({
  current:  z.string().min(1, 'Unesite trenutnu šifru'),
  next:     z.string().min(6, 'Minimalno 6 karaktera'),
  confirm:  z.string(),
}).refine(d => d.next === d.confirm, {
  message: 'Šifre se ne podudaraju',
  path: ['confirm'],
})
type PwForm = z.infer<typeof pwSchema>

// ── Component ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore()
  const fileRef  = useRef<HTMLInputElement>(null)

  // client-side only state
  const [mounted,      setMounted]      = useState(false)
  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [avatarIdx,    setAvatarIdx]    = useState<number | null>(null)
  const [photo,        setPhoto]        = useState<string | null>(null)
  const [nameSaved,    setNameSaved]    = useState(false)
  const [pwError,      setPwError]      = useState('')
  const [pwSuccess,    setPwSuccess]    = useState(false)

  // load localStorage on mount
  useEffect(() => {
    setFirstName(localStorage.getItem(LS_FIRST) ?? '')
    setLastName(localStorage.getItem(LS_LAST)  ?? '')
    const stored = localStorage.getItem(LS_AVATAR)
    setAvatarIdx(stored !== null ? parseInt(stored, 10) : null)
    setPhoto(localStorage.getItem(LS_PHOTO))
    setMounted(true)
  }, [])

  // ── Name form ──────────────────────────────────────────────────────────────
  const nameForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    values: { firstName, lastName },
  })

  function saveName(data: NameForm) {
    localStorage.setItem(LS_FIRST, data.firstName)
    localStorage.setItem(LS_LAST,  data.lastName)
    setFirstName(data.firstName)
    setLastName(data.lastName)
    dispatchProfileUpdated()
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2500)
  }

  // ── Password form ──────────────────────────────────────────────────────────
  const pwForm = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  async function changePw(data: PwForm) {
    setPwError('')
    setPwSuccess(false)
    try {
      await auth.changePassword(data.current, data.next)
      setPwSuccess(true)
      pwForm.reset()
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Greška')
    }
  }

  // ── Avatar gradient ────────────────────────────────────────────────────────
  function pickAvatar(idx: number) {
    setAvatarIdx(idx)
    localStorage.setItem(LS_AVATAR, String(idx))
    dispatchProfileUpdated()
  }

  // ── Photo upload ───────────────────────────────────────────────────────────
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      setPhoto(b64)
      localStorage.setItem(LS_PHOTO, b64)
      dispatchProfileUpdated()
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setPhoto(null)
    localStorage.removeItem(LS_PHOTO)
    if (fileRef.current) fileRef.current.value = ''
    dispatchProfileUpdated()
  }

  // ── Derived avatar display ─────────────────────────────────────────────────
  const email    = user?.email ?? ''
  const autoGrad = getUserAvatarGradient(email)
  const grad     = avatarIdx !== null ? COMPANY_GRADIENTS[avatarIdx] : autoGrad
  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : 'U'
  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : email.split('@')[0]

  if (!mounted) return null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="page-title">Postavke profila</h1>
        <p className="page-sub">Upravljajte svojim nalogom i preferencama</p>
      </div>

      <div className="space-y-6">

        {/* ── Avatar & photo ──────────────────────────────────────────────── */}
        <Card className="animate-fade-in-up">
          <CardHeader><CardTitle>Profilna slika</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Avatar preview */}
              <div className="relative shrink-0">
                {photo ? (
                  <img
                    src={photo}
                    alt="Profilna"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-200"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black text-white ring-2 ring-indigo-200"
                    style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
                  >
                    {initials}
                  </div>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 bg-emerald-400"
                  style={{ borderColor: '#fff' }}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">{displayName}</p>
                <p className="text-xs text-slate-400">{email}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role ?? 'Analitičar'}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                    Uploaduj foto
                  </Button>
                  {photo && (
                    <Button size="sm" variant="ghost" onClick={removePhoto}>
                      Ukloni
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhoto}
                />
              </div>
            </div>

            {/* Gradient colour picker (only shown when no photo) */}
            {!photo && (
              <div className="mt-5 border-t border-gray-100 pt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Boja avatara
                </p>
                <div className="flex gap-2 flex-wrap">
                  {COMPANY_GRADIENTS.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickAvatar(i)}
                      title={`Boja ${i + 1}`}
                      className="relative h-9 w-9 rounded-full transition-all duration-150 hover:scale-110 focus:outline-none"
                      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                    >
                      {(avatarIdx === i || (avatarIdx === null && autoGrad === g)) && (
                        <>
                          <span className="absolute inset-0 flex items-center justify-center">
                            <svg className="h-4 w-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                          <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-2" />
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Odabrana boja se prikazuje u sidebaru i svugdje gdje se prikazuje vaš avatar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Display name ────────────────────────────────────────────────── */}
        <Card className="animate-fade-in-up delay-75">
          <CardHeader><CardTitle>Ime i prezime</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={nameForm.handleSubmit(saveName)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ime"
                  placeholder="Marko"
                  error={nameForm.formState.errors.firstName?.message}
                  {...nameForm.register('firstName')}
                />
                <Input
                  label="Prezime"
                  placeholder="Marković"
                  error={nameForm.formState.errors.lastName?.message}
                  {...nameForm.register('lastName')}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm">
                  Sačuvaj ime
                </Button>
                {nameSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Sačuvano
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Ime i prezime se čuvaju lokalno i koriste se samo za prikaz.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* ── Account info ────────────────────────────────────────────────── */}
        <Card className="animate-fade-in-up delay-100">
          <CardHeader><CardTitle>Nalog</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">E-mail adresa</p>
                  <p className="text-sm font-medium text-gray-800">{email}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600">
                  {user?.role ?? 'user'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 px-1">
                E-mail adresa se ne može promijeniti. Obratite se administratoru za promjenu.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Change password ──────────────────────────────────────────────── */}
        <Card className="animate-fade-in-up delay-150">
          <CardHeader><CardTitle>Promjena šifre</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={pwForm.handleSubmit(changePw)} className="space-y-4">
              <Input
                label="Trenutna šifra"
                type="password"
                placeholder="••••••••"
                error={pwForm.formState.errors.current?.message}
                {...pwForm.register('current')}
              />
              <Input
                label="Nova šifra"
                type="password"
                placeholder="Minimalno 6 karaktera"
                error={pwForm.formState.errors.next?.message}
                {...pwForm.register('next')}
              />
              <Input
                label="Potvrda nove šifre"
                type="password"
                placeholder="Ponovi novu šifru"
                error={pwForm.formState.errors.confirm?.message}
                {...pwForm.register('confirm')}
              />

              {pwError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 font-medium flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Šifra uspješno promijenjena
                </p>
              )}

              <Button
                type="submit"
                size="sm"
                loading={pwForm.formState.isSubmitting}
              >
                Promijeni šifru
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
