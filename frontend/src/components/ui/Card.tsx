import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Card({ className, style, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-card ring-1 ring-gray-100/80',
        'transition-shadow duration-200 hover:shadow-card-md',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn(
      'flex items-center justify-between px-6 py-4 border-b border-gray-100',
      className,
    )}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn('text-sm font-semibold text-gray-900', className)}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children }: CardProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  )
}
