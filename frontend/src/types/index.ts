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
}
