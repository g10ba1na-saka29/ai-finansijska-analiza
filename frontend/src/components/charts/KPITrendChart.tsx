'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { KPITrendPoint } from '@/types'

interface Props {
  points: KPITrendPoint[]
  mode?: 'margins' | 'scores' | 'ratios'
}

const SERIES = {
  margins: [
    { key: 'ebitda_margin',  label: 'EBITDA Margin', color: '#3399dc', pct: true },
    { key: 'net_margin',     label: 'Net Margin',     color: '#2da552', pct: true },
    { key: 'revenue_growth', label: 'Rast prihoda',   color: '#f2c40a', pct: true },
  ],
  scores: [
    { key: 'total_score', label: 'Score', color: '#214789', pct: false },
  ],
  ratios: [
    { key: 'current_ratio',  label: 'Current Ratio', color: '#3399dc', pct: false },
    { key: 'debt_to_equity', label: 'D/E Ratio',     color: '#cc2626', pct: false },
  ],
} as const

function fmtTick(val: number, pct: boolean) {
  return pct ? `${(val * 100).toFixed(0)}%` : val.toFixed(1)
}

export function KPITrendChart({ points, mode = 'margins' }: Props) {
  const series = SERIES[mode]
  const data = points.map(p => ({
    ...p,
    year: String(p.fiscal_year),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => fmtTick(v, series[0].pct)}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            const s = series.find(s => s.label === name)
            return [s?.pct ? `${(value * 100).toFixed(1)}%` : value.toFixed(2), name]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(s => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
