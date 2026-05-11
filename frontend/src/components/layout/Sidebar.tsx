'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useUserProfile } from '@/hooks/useUserProfile'

const nav = [
  { href: '/dashboard', label: 'Pregled',   icon: HomeIcon,     badge: null },
  { href: '/companies', label: 'Kompanije', icon: BuildingIcon, badge: null },
  { href: '/settings',  label: 'Postavke',  icon: SettingsIcon, badge: null },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuthStore()

  const email   = user?.email ?? ''
  const profile = useUserProfile(email)

  // Initials: from stored name if available, else from email
  const initials = profile.firstName
    ? `${profile.firstName[0]}${profile.lastName?.[0] ?? ''}`.toUpperCase()
    : email.split('@')[0].slice(0, 2).toUpperCase() || 'U'

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <aside
      className="relative flex h-screen w-[220px] shrink-0 flex-col"
      style={{
        background: 'linear-gradient(180deg, #0a0f1e 0%, #0d1630 50%, #090e1c 100%)',
        borderRight: '1px solid rgba(99,102,241,.12)',
      }}
    >
      {/* Subtle top glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,.5) 0%, transparent 70%)' }} />

      {/* ── Logo ───────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-16 items-center gap-3 px-5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 20px rgba(99,102,241,.5)',
          }}
        >
          <ChartIcon className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-bold text-white tracking-wide">Bilansia</p>
          <p className="text-[10px] font-medium" style={{ color: '#818cf8' }}>AI Finansijska Analiza</p>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="relative z-10 flex-1 px-3 pt-4">
        <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[.15em]" style={{ color: '#3d4d7a' }}>
          Meni
        </p>
        <div className="space-y-0.5">
          {nav.map(({ href, label, icon: Icon }, i) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 animate-slide-right',
                  active
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-200',
                )}
              >
                {/* Active background */}
                {active && (
                  <span
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(139,92,246,.15))',
                      border: '1px solid rgba(99,102,241,.25)',
                    }}
                  />
                )}
                {/* Hover background */}
                {!active && (
                  <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(255,255,255,.04)' }} />
                )}

                <span className="relative">
                  <Icon className={cn('h-[18px] w-[18px]', active ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300')} />
                </span>
                <span className="relative">{label}</span>

                {active && (
                  <span className="relative ml-auto flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span className="absolute h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping opacity-60" />
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="mx-3 my-5 h-px" style={{ background: 'rgba(255,255,255,.05)' }} />

        {/* ── Quick stats ──────────────────────────────────────────── */}
        <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[.15em]" style={{ color: '#3d4d7a' }}>
          Status
        </p>
        <div className="mx-1 rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500">Backend</span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">API v1</span>
            <span className="text-[10px] text-slate-600">:8000</span>
          </div>
        </div>
      </nav>

      {/* ── User footer ────────────────────────────────────────────── */}
      <div className="relative z-10 px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div className="flex items-center gap-2.5 px-2 pt-4 pb-1">
          {/* Avatar: photo > gradient initials */}
          <div className="relative shrink-0">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt="Profilna"
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold text-white ring-1 ring-white/10"
                style={{ background: `linear-gradient(135deg, ${profile.grad.from}, ${profile.grad.to})` }}
              >
                {initials}
              </div>
            )}
            <span
              className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 bg-emerald-400"
              style={{ borderColor: '#090e1c' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-300">{profile.displayName}</p>
            <p className="text-[10px]" style={{ color: profile.grad.from }}>{user?.role ?? 'Analitičar'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-600 transition-all duration-200 hover:bg-white/5 hover:text-slate-300"
        >
          <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
          Odjava
        </button>
      </div>
    </aside>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.092 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6.75-3C9.75 9.504 10.254 9 10.875 9h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zm6.75-5.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.375c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.5z" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
