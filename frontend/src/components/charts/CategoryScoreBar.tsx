'use client'

import { RISK_COLORS, scoreToRisk } from '@/lib/utils'

interface CategoryRow {
  label: string
  score: number | null
  weight: string
}

interface Props {
  categories: CategoryRow[]
}

export function CategoryScoreBar({ categories }: Props) {
  return (
    <div className="space-y-3">
      {categories.map(({ label, score, weight }) => {
        const s = score ?? 0
        const color = RISK_COLORS[scoreToRisk(s)]
        return (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{weight}</span>
                <span className="w-10 text-right font-semibold" style={{ color }}>
                  {score != null ? s.toFixed(1) : '—'}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${s}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
