import type {
  TokenResponse, User, Company, CompanyListResponse,
  FinancialReport, ReportListResponse,
  KPIResponse, KPITrendResponse,
  ScoreResponse, ScoreHistoryPoint,
  AIReport,
  BenchmarkResponse, IndustriesResponse,
  ForecastResponse,
  AnomalyResult, BankruptcyRisk,
} from '@/types'

const API =
  typeof window === 'undefined'
    ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://api:8000'}/api/v1`
    : 'http://localhost:8000/api/v1'

// ── Token storage (localStorage, client-only) ─────────────────────────────────
export const token = {
  get: () => (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null),
  getRefresh: () => (typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null),
  set: (access: string, refresh: string) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  },
  clear: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = token.get()
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    },
    ...init,
  })

  if (res.status === 204) return undefined as T

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }

  return res.json()
}

// Upload wrapper (no Content-Type header — let browser set multipart boundary)
async function upload<T>(path: string, form: FormData): Promise<T> {
  const accessToken = token.get()
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (email: string, password: string, org_name: string) =>
    req<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, org_name }),
    }),

  login: (email: string, password: string) =>
    req<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => req<User>('/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    req<void>('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ current_password, new_password }),
    }),

  refresh: (refresh_token: string) =>
    req<{ access_token: string; token_type: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),
}

// ── Companies ─────────────────────────────────────────────────────────────────
export const companies = {
  list: (skip = 0, limit = 50) =>
    req<CompanyListResponse>(`/companies?skip=${skip}&limit=${limit}`),

  get: (id: string) => req<Company>(`/companies/${id}`),

  create: (data: { name: string; tax_id?: string; industry?: string; country?: string }) =>
    req<Company>('/companies', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Company>) =>
    req<Company>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => req<void>(`/companies/${id}`, { method: 'DELETE' }),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reports = {
  list: (companyId: string) =>
    req<ReportListResponse>(`/companies/${companyId}/reports`),

  get: (reportId: string) => req<FinancialReport>(`/reports/${reportId}`),

  upload: (companyId: string, file: File, fiscal_year: number, report_type: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('fiscal_year', String(fiscal_year))
    form.append('report_type', report_type)
    return upload<FinancialReport>(`/companies/${companyId}/reports`, form)
  },

  delete: (reportId: string) => req<void>(`/reports/${reportId}`, { method: 'DELETE' }),

  reparse: (reportId: string) =>
    req<FinancialReport>(`/reports/${reportId}/reparse`, { method: 'POST' }),
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export const kpi = {
  get: (companyId: string, year: number) =>
    req<KPIResponse>(`/companies/${companyId}/kpi/${year}`),

  trend: (companyId: string) =>
    req<KPITrendResponse>(`/companies/${companyId}/kpi/trend`),
}

// ── Score ─────────────────────────────────────────────────────────────────────
export const score = {
  get: (companyId: string, year: number) =>
    req<ScoreResponse>(`/companies/${companyId}/score/${year}`),

  history: (companyId: string) =>
    req<{ company_id: string; history: ScoreHistoryPoint[] }>(`/companies/${companyId}/score/history`),

  calculate: (companyId: string, year: number) =>
    req<{ task_id: string; status: string }>(`/companies/${companyId}/calculate/${year}`, { method: 'POST' }),
}

// ── Benchmarks ────────────────────────────────────────────────────────────────
export const benchmarks = {
  get: (companyId: string, year: number) =>
    req<BenchmarkResponse>(`/companies/${companyId}/benchmarks/${year}`),

  industries: () => req<IndustriesResponse>('/industries'),
}

// ── Forecast ──────────────────────────────────────────────────────────────────
export const forecast = {
  get: (companyId: string) =>
    req<ForecastResponse>(`/companies/${companyId}/forecast`),

  generate: (companyId: string, horizon = 3) =>
    req<{ task_id: string; status: string; horizon: number }>(
      `/companies/${companyId}/forecast/generate`,
      { method: 'POST', body: JSON.stringify({ horizon }) },
    ),
}

// ── Risk Analysis ────────────────────────────────────────────────────────────
export const riskAnalysis = {
  anomalies: (companyId: string, year: number) =>
    req<AnomalyResult>(`/companies/${companyId}/anomalies/${year}`),

  bankruptcyRisk: (companyId: string, year: number) =>
    req<BankruptcyRisk>(`/companies/${companyId}/bankruptcy-risk/${year}`),
}

// ── AI Reports ────────────────────────────────────────────────────────────────
export const aiReports = {
  generate: (companyId: string, year: number) =>
    req<AIReport>(`/companies/${companyId}/ai-report/${year}`, { method: 'POST' }),

  get: (companyId: string, year: number) =>
    req<AIReport>(`/companies/${companyId}/ai-report/${year}`),

  pdfUrl: (companyId: string, year: number) =>
    `/api/v1/companies/${companyId}/ai-report/${year}/pdf`,

  qa: (companyId: string, year: number, question: string, history?: Array<{ role: string; content: string }>) =>
    req<{ answer: string; company_id: string; fiscal_year: number }>(
      `/companies/${companyId}/qa/${year}`,
      { method: 'POST', body: JSON.stringify({ question, history }) },
    ),
}
