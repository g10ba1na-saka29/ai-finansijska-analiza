'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { org } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { OrgMember } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  admin:   'bg-indigo-100 text-indigo-700 border border-indigo-200',
  analyst: 'bg-slate-100 text-slate-600 border border-slate-200',
}
const ROLE_LABEL: Record<string, string> = {
  admin:   'Admin',
  analyst: 'Analitičar',
}

const inviteSchema = z.object({
  email:    z.string().email('Neispravan e-mail'),
  password: z.string().min(6, 'Minimalno 6 karaktera'),
  role:     z.enum(['admin', 'analyst']),
})
type InviteForm = z.infer<typeof inviteSchema>

// ── Component ──────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const { user } = useAuthStore()
  const isAdmin   = user?.role === 'admin'

  const [members,     setMembers]     = useState<OrgMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [addError,    setAddError]    = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState<string | null>(null)
  const [removing,    setRemoving]    = useState<string | null>(null)
  const [confirm,     setConfirm]     = useState<string | null>(null)

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'analyst' },
  })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await org.listMembers()
      setMembers(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function onAdd(data: InviteForm) {
    setAddError(null)
    try {
      const newMember = await org.addMember(data.email, data.password, data.role)
      setMembers(prev => [...prev, newMember])
      form.reset({ role: 'analyst' })
      setShowAdd(false)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Greška')
    }
  }

  async function changeRole(id: string, role: string) {
    setRoleLoading(id)
    try {
      const updated = await org.updateMember(id, { role })
      setMembers(prev => prev.map(m => m.id === id ? updated : m))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška')
    } finally {
      setRoleLoading(null)
    }
  }

  async function toggleActive(id: string, is_active: boolean) {
    setRoleLoading(id)
    try {
      const updated = await org.updateMember(id, { is_active })
      setMembers(prev => prev.map(m => m.id === id ? updated : m))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška')
    } finally {
      setRoleLoading(null)
    }
  }

  async function removeMember(id: string) {
    setRemoving(id)
    try {
      await org.removeMember(id)
      setMembers(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška')
    } finally {
      setRemoving(null)
      setConfirm(null)
    }
  }

  const adminCount = members.filter(m => m.role === 'admin' && m.is_active).length

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="page-title">Upravljanje organizacijom</h1>
        <p className="page-sub">Pregledajte i upravljajte članovima vašeg tima</p>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6 animate-fade-in-up delay-75">
        {[
          { label: 'Ukupno članova', value: members.length },
          { label: 'Aktivnih',       value: members.filter(m => m.is_active).length },
          { label: 'Admini',         value: adminCount },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">{s.label}</p>
            <p className="mt-1.5 text-3xl font-black text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Add member ──────────────────────────────────────────────────── */}
      {isAdmin && (
        <Card className="mb-6 animate-fade-in-up delay-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dodaj člana</CardTitle>
              <button
                onClick={() => { setShowAdd(v => !v); setAddError(null); form.reset({ role: 'analyst' }) }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {showAdd ? (
                  <>
                    <span className="text-base leading-none">×</span> Otkaži
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-3.5 w-3.5" /> Novi član
                  </>
                )}
              </button>
            </div>
          </CardHeader>

          {showAdd && (
            <CardContent>
              <form onSubmit={form.handleSubmit(onAdd)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="E-mail adresa"
                    placeholder="korisnik@firma.ba"
                    type="email"
                    error={form.formState.errors.email?.message}
                    {...form.register('email')}
                  />
                  <Input
                    label="Privremena šifra"
                    placeholder="Minimalno 6 karaktera"
                    type="password"
                    error={form.formState.errors.password?.message}
                    {...form.register('password')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">Rola</label>
                  <div className="flex gap-3">
                    {(['analyst', 'admin'] as const).map(r => (
                      <label key={r} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={r}
                          {...form.register('role')}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm text-slate-700">{ROLE_LABEL[r]}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Analitičar može pregledati podatke; Admin može upravljati kompanijama i članovima.
                  </p>
                </div>

                {addError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>
                )}

                <Button type="submit" size="sm" loading={form.formState.isSubmitting}>
                  Dodaj člana
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Members table ────────────────────────────────────────────────── */}
      <Card className="animate-fade-in-up delay-150">
        <CardHeader><CardTitle>Članovi tima</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-14 text-center text-sm text-slate-400">Učitavanje...</div>
          ) : error ? (
            <div className="py-8 px-6 text-sm text-red-600 bg-red-50 rounded-b-2xl">{error}</div>
          ) : members.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">Nema članova.</div>
          ) : (
            <div className="overflow-hidden rounded-b-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Korisnik</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Rola</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Dodan</th>
                    {isAdmin && <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Akcije</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => {
                    const isSelf   = m.id === user?.id
                    const isLocked = isSelf || (m.role === 'admin' && adminCount <= 1)
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 ${!m.is_active ? 'opacity-50' : ''}`}
                      >
                        {/* Email + avatar initials */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{
                                background: `hsl(${(m.email.charCodeAt(0) * 37) % 360},60%,55%)`,
                              }}
                            >
                              {m.email.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{m.email}</p>
                              {isSelf && <p className="text-[10px] text-indigo-400 font-semibold">Vi</p>}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-4">
                          {isAdmin && !isSelf ? (
                            <select
                              value={m.role}
                              disabled={roleLoading === m.id}
                              onChange={e => changeRole(m.id, e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
                            >
                              <option value="analyst">Analitičar</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLE[m.role] ?? ROLE_STYLE.analyst}`}>
                              {ROLE_LABEL[m.role] ?? m.role}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            m.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {m.is_active ? 'Aktivan' : 'Deaktiviran'}
                          </span>
                        </td>

                        {/* Created at */}
                        <td className="px-4 py-4 text-xs text-slate-400">
                          {new Date(m.created_at).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>

                        {/* Actions */}
                        {isAdmin && (
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {!isSelf && (
                                <>
                                  <button
                                    disabled={roleLoading === m.id || isLocked}
                                    onClick={() => toggleActive(m.id, !m.is_active)}
                                    title={m.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 hover:bg-slate-100 text-slate-600"
                                  >
                                    {m.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                                  </button>

                                  {confirm === m.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => removeMember(m.id)}
                                        disabled={removing === m.id}
                                        className="rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                                      >
                                        {removing === m.id ? '...' : 'Potvrdi'}
                                      </button>
                                      <button
                                        onClick={() => setConfirm(null)}
                                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                                      >
                                        Otkaži
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      disabled={isLocked}
                                      onClick={() => setConfirm(m.id)}
                                      title="Ukloni"
                                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors"
                                    >
                                      <TrashIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Role info footer ─────────────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 animate-fade-in-up delay-200">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Opis rola</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              role: 'Admin',
              desc: 'Pun pristup: upravljanje kompanijama, izvještajima, analizama i članovima organizacije.',
              color: 'text-indigo-600',
              bg: 'bg-indigo-50 border-indigo-200',
            },
            {
              role: 'Analitičar',
              desc: 'Pregled kompanija, analiza podataka i generisanje izvještaja. Bez pristupa upravljanju organizacijom.',
              color: 'text-slate-600',
              bg: 'bg-white border-slate-200',
            },
          ].map(r => (
            <div key={r.role} className={`rounded-xl border p-4 ${r.bg}`}>
              <p className={`text-xs font-bold ${r.color} mb-1`}>{r.role}</p>
              <p className="text-xs text-slate-500">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
