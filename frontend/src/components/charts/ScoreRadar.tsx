'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import type { ScoreResponse } from '@/types'

interface Props {
  score: ScoreResponse
}

export function ScoreRadar({ score }: Props) {
  const data = [
    { category: 'Likvidnost',    value: score.liquidity_score    ?? 0 },
    { category: 'Profitabilnost', value: score.profitability_score ?? 0 },
    { category: 'Zaduženost',    value: score.leverage_score     ?? 0 },
    { category: 'Rast',          value: score.growth_score       ?? 0 },
    { category: 'Cash Flow',     value: score.cashflow_score     ?? 0 },
  ]

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#214789"
          fill="#214789"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip formatter={(v: number) => [`${v.toFixed(1)}`, 'Score']} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
