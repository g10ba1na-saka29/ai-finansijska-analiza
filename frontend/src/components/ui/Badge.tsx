import { cn, RISK_LABELS } from '@/lib/utils'
import type { RiskLevel } from '@/types'

interface BadgeProps {
  children: React.ReactNode
  className?: string
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      className
    )}>
      {children}
    </span>
  )
}

// ── Risk badge with colored dot ───────────────────────────────────────────────

const RISK_DOT_COLOR: Record<RiskLevel, string> = {
  excellent: '#10b981',
  good:      '#3b82f6',
  warning:   '#f59e0b',
  high_risk: '#f97316',
  critical:  '#ef4444',
}

const RISK_PILL: Record<RiskLevel, string> = {
  excellent: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  good:      'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  warning:   'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  high_risk: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  critical:  'bg-red-50    text-red-700    ring-1 ring-red-200',
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
      RISK_PILL[level]
    )}>
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: RISK_DOT_COLOR[level] }}
      />
      {RISK_LABELS[level]}
    </span>
  )
}

// ── Status badge with animated dot ───────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  pending:    'bg-slate-50  text-slate-600  ring-1 ring-slate-200',
  processing: 'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  generating: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  done:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  error:      'bg-red-50    text-red-700    ring-1 ring-red-200',
}

const STATUS_DOT: Record<string, string> = {
  pending:    'bg-slate-400',
  processing: 'bg-blue-500 animate-pulse',
  generating: 'bg-violet-500 animate-pulse',
  done:       'bg-emerald-500',
  error:      'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Na čekanju',
  processing: 'Obrada...',
  generating: 'Generiše...',
  done:       'Završeno',
  error:      'Greška',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
      STATUS_PILL[status] ?? 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[status] ?? 'bg-slate-400')} />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
