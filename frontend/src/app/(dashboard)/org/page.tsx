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
import type { OrgMember, AuditLogEntry } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  admin:   'bg-indigo-100 text-indigo-700 border border-indigo-200',
  analyst: 'bg-slate-100 text-slate-600 border border-slate-200',
}
const ROLE_LABEL: Record<string, string> = {
  admin:   'Admin',
  analyst: 'Analitičar',
}

const ACTION_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  'auth.login':          { dot: 'bg-blue-400',    text: 'text-blue-700',    label: 'Prijava' },
  'auth.register':       { dot: 'bg-indigo-400',  text: 'text-indigo-700',  label: 'Registracija' },
  'company.created':     { dot: 'bg-emerald-400', text: 'text-emerald-700', label: 'Kompanija dodana' },
  'company.deleted':     { dot: 'bg-red-400',     text: 'text-red-700',     label: 'Kompanija obrisana' },
  'member.added':        { dot: 'bg-violet-400',  text: 'text-violet-700',  label: 'Član dodan' },
  'member.removed':      { dot: 'bg-red-400',     text: 'text-red-700',     label: 'Član uklonjen' },
  'member.role_changed': { dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Rola promijenjena' },
  'member.deactivated':  { dot: 'bg-orange-400',  text: 'text-orange-700',  label: 'Deaktiviran' },
  'member.activated':    { dot: 'bg-green-400',   text: 'text-green-700',   label: 'Aktiviran' },
}

const inviteSchema = z.object({
  email:    z.string().email('Neispravan e-mail'),
  password: z.string().min(6, 'Minimalno 6 karaktera'),
  role:     z.enum(['admin', 'analyst']),
})
type InviteForm = z.infer<typeof inviteSchema>

type Tab = 'members' | 'audit'

// ── Component ──────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const { user } = useAuthStore()
  const isAdmin   = user?.role === 'admin'

  const [tab,         setTab]         = useState<Tab>('members')
  const [members,     setMembers]     = useState<OrgMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [addError,    setAddError]    = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState<string | null>(null)
  const [removing,    setRemoving]    = useState<string | null>(null)
  const [confirm,     setConfirm]     = useState<string | null>(null)

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditTotal,   setAuditTotal]   = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage,    setAuditPage]    = useState(0)
  const AUDIT_LIMIT = 25

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'analyst' },
  })

  async function load() {
    setLoading(true); setError(null)
    try { setMembers((await org.listMembers()).items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Greška') }
    finally { setLoading(false) }
  }

  async function loadAudit(page = 0) {
    if (!isAdmin) return
    setAuditLoading(true)
    try {
      const res = await org.auditLog({ skip: page * AUDIT_LIMIT, limit: AUDIT_LIMIT })
      setAuditEntries(res.items)
      setAuditTotal(res.total)
      setAuditPage(page)
    } catch { /* ignore */ }
    finally { setAuditLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'audit') loadAudit(0) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onAdd(data: InviteForm) {
    setAddError(null)
    try {
      const newMember = await org.addMember(data.email, data.password, data.role)
      setMembers(prev => [...prev, newMember])
      form.reset({ role: 'analyst' }); setShowAdd(false)
    } catch (e) { setAddError(e instanceof Error ? e.message : 'Greška') }
  }

  async function changeRole(id: string, role: string) {
    setRoleLoading(id)
    try { setMembers(prev => prev.map(m => m.id === id ? { ...m } : m)); const u = await org.updateMember(id, { role }); setMembers(prev => prev.map(m => m.id === id ? u : m)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Greška') }
    finally { setRoleLoading(null) }
  }

  async function toggleActive(id: string, is_active: boolean) {
    setRoleLoading(id)
    try { const u = await org.updateMember(id, { is_active }); setMembers(prev => prev.map(m => m.id === id ? u : m)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Greška') }
    finally { setRoleLoading(null) }
  }

  async function removeMember(id: string) {
    setRemoving(id)
    try { await org.removeMember(id); setMembers(prev => prev.filter(m => m.id !== id)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Greška') }
    finally { setRemoving(null); setConfirm(null) }
  }

  const adminCount = members.filter(m => m.role === 'admin' && m.is_active).length

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="page-title">Upravljanje organizacijom</h1>
        <p className="page-sub">Pregledajte i upravljajte članovima vašeg tima</p>
      </div>

      {/* Stats strip */}
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

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {([['members', 'Članovi tima'], ['audit', 'Dnevnik aktivnosti']] as [Tab, string][]).map(([t, label]) => (
          isAdmin || t === 'members' ? (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >{label}</button>
          ) : null
        ))}
      </div>

      {/* ── TAB: Members ─────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <>
          {/* Add member */}
          {isAdmin && (
            <Card className="mb-6 animate-fade-in-up">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Dodaj člana</CardTitle>
                  <button
                    onClick={() => { setShowAdd(v => !v); setAddError(null); form.reset({ role: 'analyst' }) }}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    {showAdd ? <><span className="text-base leading-none">×</span> Otkaži</> : <><PlusIcon className="h-3.5 w-3.5" /> Novi član</>}
                  </button>
                </div>
              </CardHeader>
              {showAdd && (
                <CardContent>
                  <form onSubmit={form.handleSubmit(onAdd)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="E-mail adresa" placeholder="korisnik@firma.ba" type="email" error={form.formState.errors.email?.message} {...form.register('email')} />
                      <Input label="Privremena šifra" placeholder="Minimalno 6 karaktera" type="password" error={form.formState.errors.password?.message} {...form.register('password')} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-600">Rola</label>
                      <div className="flex gap-3">
                        {(['analyst', 'admin'] as const).map(r => (
                          <label key={r} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value={r} {...form.register('role')} className="accent-indigo-600" />
                            <span className="text-sm text-slate-700">{ROLE_LABEL[r]}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">Analitičar pregledava podatke; Admin upravlja kompanijama i članovima.</p>
                    </div>
                    {addError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>}
                    <Button type="submit" size="sm" loading={form.formState.isSubmitting}>Dodaj člana</Button>
                  </form>
                </CardContent>
              )}
            </Card>
          )}

          {/* Members table */}
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
                      {members.map(m => {
                        const isSelf   = m.id === user?.id
                        const isLocked = isSelf || (m.role === 'admin' && adminCount <= 1)
                        return (
                          <tr key={m.id} className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 ${!m.is_active ? 'opacity-50' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                                  style={{ background: `hsl(${(m.email.charCodeAt(0) * 37) % 360},60%,55%)` }}>
                                  {m.email.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-800">{m.email}</p>
                                  {isSelf && <p className="text-[10px] text-indigo-400 font-semibold">Vi</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {isAdmin && !isSelf ? (
                                <select value={m.role} disabled={roleLoading === m.id}
                                  onChange={e => changeRole(m.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50">
                                  <option value="analyst">Analitičar</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLE[m.role] ?? ROLE_STYLE.analyst}`}>
                                  {ROLE_LABEL[m.role] ?? m.role}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {m.is_active ? 'Aktivan' : 'Deaktiviran'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs text-slate-400">
                              {new Date(m.created_at).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {!isSelf && (
                                    <>
                                      <button disabled={roleLoading === m.id || isLocked} onClick={() => toggleActive(m.id, !m.is_active)}
                                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 hover:bg-slate-100 text-slate-600">
                                        {m.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                                      </button>
                                      {confirm === m.id ? (
                                        <div className="flex items-center gap-1.5">
                                          <button onClick={() => removeMember(m.id)} disabled={removing === m.id}
                                            className="rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                                            {removing === m.id ? '...' : 'Potvrdi'}
                                          </button>
                                          <button onClick={() => setConfirm(null)}
                                            className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                                            Otkaži
                                          </button>
                                        </div>
                                      ) : (
                                        <button disabled={isLocked} onClick={() => setConfirm(m.id)}
                                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors">
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

          {/* Role info */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 animate-fade-in-up delay-200">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Opis rola</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { role: 'Admin', desc: 'Pun pristup: upravljanje kompanijama, izvještajima, analizama i članovima organizacije.', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                { role: 'Analitičar', desc: 'Pregled kompanija, analiza podataka i generisanje izvještaja. Bez pristupa upravljanju organizacijom.', color: 'text-slate-600', bg: 'bg-white border-slate-200' },
              ].map(r => (
                <div key={r.role} className={`rounded-xl border p-4 ${r.bg}`}>
                  <p className={`text-xs font-bold ${r.color} mb-1`}>{r.role}</p>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: Audit log ───────────────────────────────────────────────── */}
      {tab === 'audit' && isAdmin && (
        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Dnevnik aktivnosti</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">{auditTotal} ukupno zapisa</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadAudit(auditPage)}>↺ Osvježi</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {auditLoading ? (
              <div className="py-14 text-center text-sm text-slate-400">Učitavanje...</div>
            ) : auditEntries.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-400">
                <p className="text-2xl mb-2">📋</p>
                <p>Nema aktivnosti za prikaz</p>
                <p className="text-xs mt-1 text-slate-300">Aktivnosti će se pojaviti nakon prvih akcija</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-50">
                  {auditEntries.map(e => {
                    const style = ACTION_STYLE[e.action] ?? { dot: 'bg-slate-300', text: 'text-slate-600', label: e.action }
                    return (
                      <div key={e.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
                            {e.resource_type && (
                              <span className="rounded px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 font-mono">{e.resource_type}</span>
                            )}
                          </div>
                          {e.details && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {Object.entries(e.details)
                                .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(e.created_at).toLocaleString('bs-BA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {e.ip_address && <p className="text-[10px] text-slate-300 font-mono">{e.ip_address}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {auditTotal > AUDIT_LIMIT && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                    <p className="text-xs text-slate-400">
                      {auditPage * AUDIT_LIMIT + 1}–{Math.min((auditPage + 1) * AUDIT_LIMIT, auditTotal)} od {auditTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" disabled={auditPage === 0} onClick={() => loadAudit(auditPage - 1)}>← Prethodna</Button>
                      <Button size="sm" variant="ghost" disabled={(auditPage + 1) * AUDIT_LIMIT >= auditTotal} onClick={() => loadAudit(auditPage + 1)}>Sljedeća →</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
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
