'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id:      number
  type:    ToastType
  title:   string
  message?: string
}

// ── Global store (no React context needed — works across any component) ────────
let _id = 0
const _listeners = new Set<(toasts: Toast[]) => void>()
let _toasts: Toast[] = []

function notify(listeners: typeof _listeners, toasts: Toast[]) {
  listeners.forEach(l => l([...toasts]))
}

export const toast = {
  success: (title: string, message?: string) => push('success', title, message),
  error:   (title: string, message?: string) => push('error',   title, message),
  info:    (title: string, message?: string) => push('info',    title, message),
  warning: (title: string, message?: string) => push('warning', title, message),
}

function push(type: ToastType, title: string, message?: string) {
  const id = ++_id
  _toasts = [..._toasts, { id, type, title, message }]
  notify(_listeners, _toasts)
  setTimeout(() => remove(id), 4500)
}

function remove(id: number) {
  _toasts = _toasts.filter(t => t.id !== id)
  notify(_listeners, _toasts)
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
}

const STYLES: Record<ToastType, { bg: string; border: string; icon: string; bar: string }> = {
  success: { bg: 'bg-white', border: 'border-emerald-100', icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  error:   { bg: 'bg-white', border: 'border-red-100',     icon: 'text-red-500',     bar: 'bg-red-500'     },
  warning: { bg: 'bg-white', border: 'border-amber-100',   icon: 'text-amber-500',   bar: 'bg-amber-500'   },
  info:    { bg: 'bg-white', border: 'border-blue-100',    icon: 'text-blue-500',    bar: 'bg-blue-500'    },
}

// ── Provider (mount once in layout) ──────────────────────────────────────────
export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _listeners.add(setToasts)
    return () => { _listeners.delete(setToasts) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 w-80">
      {toasts.map(t => {
        const s = STYLES[t.type]
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-xl animate-slide-in-right ${s.bg} ${s.border}`}
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,.10)' }}
          >
            {/* Progress bar */}
            <div
              className={`absolute bottom-0 left-0 h-[3px] ${s.bar} animate-shrink`}
            />

            <div className="flex items-start gap-3 p-4">
              <span className={`mt-0.5 shrink-0 ${s.icon}`}>{ICONS[t.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{t.title}</p>
                {t.message && (
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
