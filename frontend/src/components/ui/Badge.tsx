import { cn, RISK_BG, RISK_LABELS } from '@/lib/utils'
import type { RiskLevel } from '@/types'

interface BadgeProps {
  children: React.ReactNode
  className?: string
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  )
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge className={RISK_BG[level]}>
      {RISK_LABELS[level]}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:    'bg-gray-50 text-gray-600 ring-gray-500/20',
    processing: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    generating: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    done:       'bg-green-50 text-green-700 ring-green-600/20',
    error:      'bg-red-50 text-red-700 ring-red-600/10',
  }
  const labels: Record<string, string> = {
    pending:    'Na čekanju',
    processing: 'Obrada...',
    generating: 'Generiše...',
    done:       'Završeno',
    error:      'Greška',
  }
  return <Badge className={styles[status] ?? 'bg-gray-50 text-gray-600'}>{labels[status] ?? status}</Badge>
}
