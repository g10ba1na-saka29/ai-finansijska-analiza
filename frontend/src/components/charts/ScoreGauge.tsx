'use client'

import { RISK_COLORS, RISK_LABELS, scoreToRisk } from '@/lib/utils'
import type { RiskLevel } from '@/types'

interface Props {
  score: number
  size?: number
}

const R = 80
const CX = 100
const CY = 105
const STROKE = 16

function polar(angle: number) {
  const rad = ((angle - 180) * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

function arcPath(start: number, end: number) {
  const s = polar(start)
  const e = polar(end)
  const large = end - start > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`
}

const SEGMENTS: [number, number, RiskLevel][] = [
  [0,   36,  'critical'],
  [36,  72,  'high_risk'],
  [72,  108, 'warning'],
  [108, 144, 'good'],
  [144, 180, 'excellent'],
]

export function ScoreGauge({ score, size = 220 }: Props) {
  const risk = scoreToRisk(score)
  const needleAngle = (score / 100) * 180   // 0 = left, 180 = right
  const needle = polar(needleAngle)
  const color = RISK_COLORS[risk]
  const scale = size / 210

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 200 120"
        width={size}
        height={size * 0.6}
        style={{ overflow: 'visible' }}
      >
        {/* Background arc */}
        <path
          d={arcPath(0, 180)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Coloured segments */}
        {SEGMENTS.map(([s, e, level]) => (
          <path
            key={level}
            d={arcPath(s, e)}
            fill="none"
            stroke={RISK_COLORS[level]}
            strokeWidth={STROKE}
            opacity={0.25}
          />
        ))}

        {/* Score arc (filled portion) */}
        {score > 0 && (
          <path
            d={arcPath(0, needleAngle)}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          stroke="#1e3a5f"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} fill="#1e3a5f" />

        {/* Score text */}
        <text
          x={CX}
          y={CY - 18}
          textAnchor="middle"
          fontSize={28}
          fontWeight="700"
          fill={color}
        >
          {score.toFixed(1)}
        </text>
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">
          / 100
        </text>

        {/* Min / Max labels */}
        <text x={CX - R - 2} y={CY + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">0</text>
        <text x={CX + R + 2} y={CY + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">100</text>
      </svg>

      {/* Risk badge */}
      <span
        className="inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold"
        style={{ backgroundColor: color + '20', color }}
      >
        {RISK_LABELS[risk]}
      </span>
    </div>
  )
}
