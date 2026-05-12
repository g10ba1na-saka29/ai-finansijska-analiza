// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  role: string
  org_id: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ── Company ───────────────────────────────────────────────────────────────────
export interface Company {
  id: string
  org_id: string
  name: string
  tax_id: string | null
  industry: string | null
  country: string
  created_at: string
}

export interface CompanyListResponse {
  items: Company[]
  total: number
}

// ── Report ────────────────────────────────────────────────────────────────────
export type ReportStatus = 'pending' | 'processing' | 'done' | 'error'
export type ReportType = 'balance_sheet' | 'income' | 'cash_flow' | 'tax' | 'audit'

export interface FinancialReport {
  id: string
  company_id: string
  fiscal_year: number
  report_type: ReportType
  status: ReportStatus
  error_message: string | null
  raw_data: Record<string, unknown> | null
  uploaded_at: string
  processed_at: string | null
}

export interface ReportListResponse {
  items: FinancialReport[]
  total: number
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export interface LiquidityKPIs {
  current_ratio: number | null
  quick_ratio: number | null
  cash_ratio: number | null
}

export interface ProfitabilityKPIs {
  gross_margin: number | null
  ebitda_margin: number | null
  ebit_margin: number | null
  net_margin: number | null
  roe: number | null
  roa: number | null
}

export interface LeverageKPIs {
  debt_to_equity: number | null
  interest_coverage: number | null
  debt_ratio: number | null
  equity_ratio: number | null
}

export interface GrowthKPIs {
  revenue_growth: number | null
  ebitda_growth: number | null
  net_income_growth: number | null
  asset_growth: number | null
}

export interface CashFlowKPIs {
  free_cash_flow: number | null
  ocf_margin: number | null
  cash_to_debt: number | null
  ocf_to_current_liabilities: number | null
}

export interface EfficiencyKPIs {
  asset_turnover: number | null
  receivables_turnover: number | null
  days_sales_outstanding: number | null
  inventory_turnover: number | null
  days_inventory_outstanding: number | null
}

export interface KPIResponse {
  company_id: string
  fiscal_year: number
  liquidity: LiquidityKPIs
  profitability: ProfitabilityKPIs
  leverage: LeverageKPIs
  growth: GrowthKPIs
  cashflow: CashFlowKPIs
  efficiency: EfficiencyKPIs
  calculated_at: string | null
}

export interface KPITrendPoint {
  fiscal_year: number
  ebitda_margin: number | null
  net_margin: number | null
  current_ratio: number | null
  debt_to_equity: number | null
  revenue_growth: number | null
  total_score: number | null
}

export interface KPITrendResponse {
  company_id: string
  points: KPITrendPoint[]
}

// ── Score ─────────────────────────────────────────────────────────────────────
export type RiskLevel = 'excellent' | 'good' | 'warning' | 'high_risk' | 'critical'

export interface AltmanData {
  z_score: number | null
  zone: string
  components: Record<string, number | null>
  interpretation: string
}

export interface ScoreResponse {
  company_id: string
  fiscal_year: number
  total_score: number
  risk_level: RiskLevel
  liquidity_score: number | null
  profitability_score: number | null
  leverage_score: number | null
  growth_score: number | null
  cashflow_score: number | null
  altman: AltmanData | null
  breakdown: Record<string, Record<string, number | null>> | null
  score_version: string
  calculated_at: string | null
}

export interface ScoreHistoryPoint {
  fiscal_year: number
  total_score: number
  risk_level: RiskLevel
  liquidity_score: number | null
  profitability_score: number | null
  leverage_score: number | null
  growth_score: number | null
  cashflow_score: number | null
}

// ── Benchmark ─────────────────────────────────────────────────────────────────
export type BenchmarkAssessment = 'strong' | 'above_avg' | 'avg' | 'below_avg' | 'weak' | 'neutral'

export interface MetricBenchmark {
  metric: string
  label: string
  company_value: number | null
  industry_p25: number | null
  industry_median: number | null
  industry_p75: number | null
  percentile: number | null
  higher_is_better: boolean
  assessment: BenchmarkAssessment
  assessment_label: string
}

export interface BenchmarkResponse {
  company_id: string
  fiscal_year: number
  industry: string
  metrics: MetricBenchmark[]
  overall_percentile: number | null
  strengths: string[]
  weaknesses: string[]
}

export interface IndustriesResponse {
  industries: string[]
}

// ── Forecast ──────────────────────────────────────────────────────────────────
export interface ForecastPoint {
  year: number
  revenue: number | null
  revenue_low: number | null
  revenue_high: number | null
  ebitda: number | null
  ebitda_low: number | null
  ebitda_high: number | null
  net_income: number | null
  net_income_low: number | null
  net_income_high: number | null
  ebitda_margin: number | null
  net_margin: number | null
}

export interface HistoricalPoint {
  year: number
  revenue: number | null
  ebitda: number | null
  net_income: number | null
  total_assets: number | null
}

export interface ForecastResponse {
  company_id: string
  base_year: number
  horizon: number
  method: string
  data_points: number
  predictions: ForecastPoint[]
  historical: HistoricalPoint[]
  revenue_r_squared: number | null
  revenue_cagr: number | null
  generated_at: string | null
}

// ── Risk Analysis ─────────────────────────────────────────────────────────────
export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'
export type AnomalyType = 'yoy_change' | 'absolute_threshold' | 'industry_outlier' | 'isolation_forest' | 'combined'

export interface AnomalyFlag {
  metric: string
  label: string
  severity: AnomalySeverity
  anomaly_type: AnomalyType
  description: string
  value: number | null
  previous_value: number | null
  industry_norm: number | null
}

export interface AnomalyResult {
  company_id: string
  fiscal_year: number
  anomalies: AnomalyFlag[]
  risk_score: number
  summary: string
  methods_used: string[]
}

export interface PiotroskiSignal {
  name: string
  description: string
  passed: boolean
  value: number | null
}

export type PiotroskiCategory = 'strong' | 'neutral' | 'weak'
export type DistressLabel = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'

export interface PiotroskiResult {
  score: number
  available: number
  category: PiotroskiCategory
  signals: PiotroskiSignal[]
}

export interface BankruptcyRisk {
  company_id: string
  fiscal_year: number
  piotroski: PiotroskiResult
  altman_z_score: number | null
  altman_zone: string | null
  distress_probability: number
  distress_label: DistressLabel
  risk_factors: string[]
  positive_factors: string[]
}

// ── Organization ──────────────────────────────────────────────────────────────
export interface OrgMember {
  id: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface MemberListResponse {
  items: OrgMember[]
  total: number
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AuditLogListResponse {
  items: AuditLogEntry[]
  total: number
}

// ── AI Report ─────────────────────────────────────────────────────────────────
export type AIReportStatus = 'pending' | 'generating' | 'done' | 'error'

export interface AIReport {
  id: string
  company_id: string
  fiscal_year: number
  status: AIReportStatus
  summary: string | null
  score_explanation: string | null
  risk_assessment: string | null
  outlook: string | null
  strengths: string[] | null
  weaknesses: string[] | null
  key_risks: string[] | null
  recommendations: string[] | null
  red_flags: string[] | null
  model_used: string | null
  generated_at: string | null
  error_message: string | null
}
