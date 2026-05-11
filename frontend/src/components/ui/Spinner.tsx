import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin text-primary-600', className ?? 'h-5 w-5')}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-9 w-9" />
        <p className="text-sm text-slate-400 animate-pulse">Učitavanje...</p>
      </div>
    </div>
  )
}
