import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

const variants = {
  primary:
    'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-sm ' +
    'hover:from-primary-700 hover:to-accent-600 hover:shadow-md ' +
    'focus-visible:outline-primary-600',
  secondary:
    'bg-white text-gray-800 ring-1 ring-inset ring-gray-200 ' +
    'hover:bg-gray-50 focus-visible:outline-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  ghost:
    'text-gray-600 hover:bg-gray-100 focus-visible:outline-gray-400',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium',
        'transition-all duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
