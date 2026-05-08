import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { RiskLevel } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmtPct(val: number | null | undefined, decimals = 1): string {
  if (val == null) return 'N/A'
  return `${(val * 100).toFixed(decimals)}%`
}

export function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val == null) return 'N/A'
  return val.toFixed(decimals)
}

export function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return 'N/A'
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${abs.toFixed(2)}`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Risk level helpers ────────────────────────────────────────────────────────
export const RISK_LABELS: Record<RiskLevel, string> = {
  excellent: 'Odlično',
  good:      'Dobro',
  warning:   'Upozorenje',
  high_risk: 'Visok rizik',
  critical:  'Kritično',
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  excellent: '#2da552',
  good:      '#3399dc',
  warning:   '#f2c40a',
  high_risk: '#e88026',
  critical:  '#cc2626',
}

export const RISK_BG: Record<RiskLevel, string> = {
  excellent: 'bg-green-50 text-green-800 ring-green-600/20',
  good:      'bg-blue-50 text-blue-800 ring-blue-600/20',
  warning:   'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  high_risk: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  critical:  'bg-red-50 text-red-800 ring-red-600/20',
}

export function scoreToRisk(score: number): RiskLevel {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'warning'
  if (score >= 20) return 'high_risk'
  return 'critical'
}

// ── KPI thresholds for colour coding ─────────────────────────────────────────
export function kpiStatus(metric: string, value: number | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (value == null) return 'neutral'
  const thresholds: Record<string, [number, number]> = {
    current_ratio:      [1.0, 1.5],
    quick_ratio:        [0.7, 1.0],
    cash_ratio:         [0.2, 0.5],
    ebitda_margin:      [0.05, 0.15],
    net_margin:         [0.02, 0.05],
    roe:                [0.08, 0.12],
    roa:                [0.03, 0.05],
    debt_to_equity:     [3.0, 2.0],   // lower is better — reversed
    interest_coverage:  [1.5, 3.0],
    debt_ratio:         [0.7, 0.5],   // reversed
    revenue_growth:     [-0.05, 0.05],
  }
  const reversed = new Set(['debt_to_equity', 'debt_ratio'])
  const t = thresholds[metric]
  if (!t) return 'neutral'
  const [bad, ok] = reversed.has(metric) ? [t[0], t[1]] : [t[0], t[1]]
  if (reversed.has(metric)) {
    return value <= t[1] ? 'good' : value <= t[0] ? 'warn' : 'bad'
  }
  return value >= t[1] ? 'good' : value >= t[0] ? 'warn' : 'bad'
}
