# Arhitektura sistema

## Pregled

Bilansia je višeslojna aplikacija izgrađena na mikroservisnoj arhitekturi unutar Docker Compose okruženja. Sistem se sastoji od pet glavnih slojeva:

1. **Prezentacijski sloj** — Next.js 15 frontend
2. **API sloj** — FastAPI REST backend
3. **Asinhroni procesni sloj** — Celery worker pipeline
4. **Podatkovna pohrana** — PostgreSQL + Redis (broker + API cache)
5. **Vanjski servisi** — LLM provideri (OpenAI/Anthropic/Ollama)

---

## Dijagram komponenti

```
╔══════════════════════════════════════════════════════════════════╗
║                    KLIJENT (Browser)                            ║
║  Next.js 15 · React 18 · TailwindCSS · Recharts · Zustand      ║
╚═══════════════════════════╤══════════════════════════════════════╝
                            │ JWT Bearer / REST
╔═══════════════════════════▼══════════════════════════════════════╗
║                    API LAYER (FastAPI)                           ║
║  ┌────────┐ ┌──────────┐ ┌─────────┐ ┌────────────────────┐   ║
║  │  Auth  │ │Companies │ │ Reports │ │ Analytics / Score  │   ║
║  └────────┘ └──────────┘ └────┬────┘ └────────────────────┘   ║
║  ┌────────────┐ ┌──────────┐  │      ┌────────────────────┐   ║
║  │ Benchmarks │ │Forecasting│  │      │   Webhooks CRUD    │   ║
║  └────────────┘ └──────────┘  │      └────────────────────┘   ║
║  ─────── slowapi rate limiting · RequestLoggingMiddleware ───── ║
╚══════════════════════════════╪═══════════════════════════════════╝
                               │ Celery task
╔══════════════════════════════▼══════════════════════════════════╗
║                  WORKER LAYER (Celery)                          ║
║                                                                  ║
║  process_pdf_report  →  calculate_kpis_and_score  →  (opt)     ║
║        │                        │  + cache_invalidate  generate ║
║        │  webhook dispatch      │  + webhook dispatch    _ai   ║
║        ▼                        ▼                               ║
║  ┌──────────────┐     ┌─────────────────┐                      ║
║  │  PDF Parser  │     │  KPI Calculator │                      ║
║  │  (Camelot +  │     │  Score Engine   │                      ║
║  │  pdfplumber +│     │  Altman Z-Score │                      ║
║  │  Tesseract)  │     └─────────────────┘                      ║
║  └──────────────┘                                               ║
║  ┌────────────────────────────────────┐                         ║
║  │  ML Forecasting (OLS + 95% CI)    │  ← on demand            ║
║  └────────────────────────────────────┘                         ║
║  ┌────────────────────────────────────┐                         ║
║  │  webhook_delivery (httpx + HMAC)  │  ← per-org, per-event   ║
║  └────────────────────────────────────┘                         ║
╚══════════════╤══════════════════════════════════════════════════╝
               │
╔══════════════▼═══════════════╗  ╔═══════════════════════════════╗
║   PostgreSQL 16              ║  ║    Redis 7                    ║
║  • organizations             ║  ║  • Celery broker + results    ║
║  • users                     ║  ║  • API cache (KPI/score/      ║
║  • companies                 ║  ║    forecast: TTL 1–2h)        ║
║  • financial_reports         ║  ╚═══════════════════════════════╝
║  • kpi_snapshots             ║
║  • company_scores            ║  ╔═══════════════════════════════╗
║  • ai_reports                ║  ║  LLM Provider (swappable)     ║
║  • forecasts                 ║  ║  • OpenAI gpt-4o              ║
║  • webhooks                  ║  ║  • Anthropic claude-3-5       ║
╚══════════════════════════════╝  ║  • Ollama (local)             ║
                                  ╚═══════════════════════════════╝
```

---

## Backend moduli

### `app/api/routes/`

Svaka ruta je zasebni FastAPI router montiran na `/api/v1/`:

| Fajl | Ruter | Odgovornost |
|---|---|---|
| `auth.py` | `/auth` | Registracija, login, refresh token, /me |
| `companies.py` | `/companies` | CRUD operacije nad kompanijama |
| `reports.py` | `/companies/{id}/reports` | Upload PDF-ova, status, reparse (rate limited: 20/min) |
| `analytics.py` | `/companies/{id}/kpi`, `/score` | KPI podaci, score, historija (Redis cache-aside) |
| `ai_reports.py` | `/companies/{id}/ai-report` | Generisanje, preuzimanje, Q&A, PDF export |
| `benchmarks.py` | `/companies/{id}/benchmarks`, `/industries` | Poređenje sa industrijskim prosjekom (p25/p50/p75) |
| `forecasting.py` | `/companies/{id}/forecast` | OLS prognoza + triggerovanje Celery taska |
| `webhooks.py` | `/webhooks` | CRUD webhookova + test endpoint |

### `app/modules/kpi/`

```
kpi/
├── calculator.py      # calculate_all() → sve kategorije; flatten_kpis() → dict za DB
├── financials.py      # FinancialStatement dataclass; extract_from_raw() parsira raw_data JSON
├── liquidity.py       # current_ratio, quick_ratio, cash_ratio, ocf_to_current_liabilities
├── profitability.py   # gross_margin, ebitda_margin, ebit_margin, net_margin, roe, roa
├── leverage.py        # debt_to_equity, interest_coverage, debt_ratio, equity_ratio
├── growth.py          # revenue_growth, ebitda_growth, net_income_growth, asset_growth
├── cashflow.py        # free_cash_flow, ocf_margin, cash_to_debt, ocf_to_current_liabilities
└── efficiency.py      # asset_turnover, receivables_turnover, dso, inventory_turnover, dio
```

Svaki modul prima `FinancialStatement` i vraća typed dataclass s nullable float poljima.

### `app/modules/scoring/`

```
scoring/
├── composite_score.py  # ScoreResult; calculate(kpi_data, fs, industry) → ScoreResult
├── weights.py          # CategoryWeights; get_weights(industry) → industry-adjusted weights
├── thresholds.py       # MetricThreshold; score_metric() normalizuje na 0–100; risk_level()
└── altman.py           # calculate_z_score(fs) → {z_score, zone, components, interpretation}
```

**Scoring formula:**

```python
total_score = (
    liquidity_score    * 0.20 +
    profitability_score * 0.25 +
    leverage_score     * 0.20 +
    growth_score       * 0.20 +
    cashflow_score     * 0.15
)
# Altman distress penalty: if z_score < 1.8 → max total_score = 35
```

### `app/modules/pdf_parser/`

```
pdf_parser/
├── extractor.py      # Glavni entry point: extract_financial_data(file_path) → raw_dict
├── table_parser.py   # Camelot: lattice (linije) + stream (bijeli prostor) mode
├── text_parser.py    # pdfplumber: tekst ekstrakcija, metadata
├── ocr_parser.py     # Pytesseract: OCR za skenirane PDF-ove
├── normalizer.py     # Mapiranje BiH/RS/HR naziva kolona na standardne nazive
└── validators.py     # Provjera kompletnosti ekstraktovanih podataka
```

### `app/modules/llm/`

```
llm/
├── client.py           # LLMClient adapter; from_settings() factory; complete_json/text()
├── prompts.py          # Prompt template-ovi za report generisanje
├── report_generator.py # generate(company, kpis, score, trend) → ReportData
├── qa.py               # answer(company, kpis, score, question, history) → str
└── pdf_export.py       # generate_pdf(ai_report) → bytes (ReportLab)
```

**LLM Adapter pattern** — provider se mijenja bez promjene pozivajućeg koda:

```python
class LLMClient:
    @classmethod
    def from_settings(cls) -> "LLMClient":
        if settings.LLM_PROVIDER == "openai":
            return cls(OpenAIProvider(settings.LLM_MODEL))
        elif settings.LLM_PROVIDER == "anthropic":
            return cls(AnthropicProvider(settings.LLM_MODEL))
        else:
            return cls(OllamaProvider(settings.LLM_MODEL))
```

### `app/modules/ml/`

```
ml/
└── forecasting.py   # OLS linearna regresija + 95% CI intervali povjerenja
```

**Arhitektura forecasting modula:**

```python
@dataclass
class HistoricalPoint:
    year: int
    revenue: float | None
    ebitda: float | None
    net_income: float | None
    total_assets: float | None

@dataclass
class ForecastPoint:
    year: int
    revenue: float; revenue_low: float; revenue_high: float
    ebitda: float;  ebitda_low: float;  ebitda_high: float
    net_income: float; net_income_low: float; net_income_high: float

def forecast(company_id, historical, horizon=3) -> ForecastResult:
    # OLS fit: numpy.linalg.lstsq(A, y)
    # 95% CI: RMSE_reziduala * CONFIDENCE_Z (1.96)
    # Vraća ForecastResult sa predictions + CAGR + R²
    # Ako < 2 historijske tačke: method = "insufficient_data"
```

### `app/modules/webhooks/`

```
webhooks/
└── dispatcher.py   # HMAC-SHA256 signing + httpx HTTP delivery
```

**Signing i dostava:**

```python
def sign_payload(secret: str, body_bytes: bytes) -> str:
    digest = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"

# Header koji se šalje:
# X-Bilansia-Signature: sha256=<hex_digest>
# X-Bilansia-Event: kpi.calculated
# X-Bilansia-Delivery: <uuid>
```

### `app/core/`

```
core/
├── cache.py           # AsyncCacheClient — Redis cache-aside za FastAPI rute
├── middleware.py      # RequestLoggingMiddleware — request_id + timing headers
├── logging_config.py  # setup_logging() — JSON ili human-readable, quiets noise
└── security.py        # JWT encode/decode, bcrypt helpers
```

**Cache key shema:**

```python
kpi_key(company_id, fiscal_year)     → "kpi:{org}:{co}:{year}"   TTL 3600s
score_key(company_id, fiscal_year)   → "score:{co}:{year}"       TTL 3600s
score_history_key(company_id)        → "score_hist:{co}"         TTL 3600s
kpi_trend_key(company_id)            → "kpi_trend:{co}"          TTL 3600s
benchmark_key(company_id, year)      → "bench:{co}:{year}"       TTL 3600s
forecast_key(company_id)             → "forecast:{co}"           TTL 7200s
```

---

## Baza podataka

### Shema

```sql
-- Multi-tenant osnova
CREATE TABLE organizations (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50) DEFAULT 'free'  -- free, pro, enterprise
);

CREATE TABLE users (
    id              UUID PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(50) DEFAULT 'analyst',  -- admin, analyst, viewer
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE companies (
    id       UUID PRIMARY KEY,
    org_id   UUID REFERENCES organizations(id),
    name     VARCHAR(255) NOT NULL,
    tax_id   VARCHAR(100),           -- JIB / PDV broj
    industry VARCHAR(100),           -- manufacturing, retail, services...
    country  VARCHAR(10) DEFAULT 'BA'
);

CREATE TABLE financial_reports (
    id           UUID PRIMARY KEY,
    company_id   UUID REFERENCES companies(id),
    fiscal_year  INTEGER NOT NULL,
    report_type  VARCHAR(50),        -- balance_sheet, income, cash_flow, tax, audit
    source_file  VARCHAR(500),       -- path do originalnog PDF-a
    raw_data     JSONB,              -- svi ekstraktovani podaci
    status       VARCHAR(50),        -- pending, processing, done, error
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE kpi_snapshots (
    id                        UUID PRIMARY KEY,
    company_id                UUID REFERENCES companies(id),
    fiscal_year               INTEGER NOT NULL,
    -- Likvidnost
    current_ratio             NUMERIC(12,4),
    quick_ratio               NUMERIC(12,4),
    cash_ratio                NUMERIC(12,4),
    -- Profitabilnost
    gross_margin              NUMERIC(12,4),
    ebitda_margin             NUMERIC(12,4),
    ebit_margin               NUMERIC(12,4),
    net_margin                NUMERIC(12,4),
    roe                       NUMERIC(12,4),
    roa                       NUMERIC(12,4),
    -- Zaduženost
    debt_to_equity            NUMERIC(12,4),
    interest_coverage         NUMERIC(12,4),
    debt_ratio                NUMERIC(12,4),
    equity_ratio              NUMERIC(12,4),
    -- Rast (YoY, zahtijeva prethodnu godinu)
    revenue_growth            NUMERIC(12,4),
    ebitda_growth             NUMERIC(12,4),
    net_income_growth         NUMERIC(12,4),
    asset_growth              NUMERIC(12,4),
    -- Cash Flow
    free_cash_flow            NUMERIC(18,2),
    ocf_margin                NUMERIC(12,4),
    cash_to_debt              NUMERIC(12,4),
    ocf_to_current_liabilities NUMERIC(12,4),
    -- Efikasnost
    asset_turnover            NUMERIC(12,4),
    receivables_turnover      NUMERIC(12,4),
    days_sales_outstanding    NUMERIC(12,4),
    inventory_turnover        NUMERIC(12,4),
    days_inventory_outstanding NUMERIC(12,4),
    raw_financials            JSONB,   -- sirovi finansijski podaci (revenue, ebitda, ...)
    calculated_at             TIMESTAMPTZ,
    UNIQUE (company_id, fiscal_year)
);

CREATE TABLE company_scores (
    id                  UUID PRIMARY KEY,
    company_id          UUID REFERENCES companies(id),
    fiscal_year         INTEGER NOT NULL,
    total_score         NUMERIC(6,2) NOT NULL,    -- 0–100
    risk_level          VARCHAR(20),              -- excellent/good/warning/high_risk/critical
    liquidity_score     NUMERIC(6,2),
    profitability_score NUMERIC(6,2),
    leverage_score      NUMERIC(6,2),
    growth_score        NUMERIC(6,2),
    cashflow_score      NUMERIC(6,2),
    altman_data         JSONB,   -- z_score, zone, components, interpretation
    breakdown           JSONB,   -- detaljan breakdown po svakoj metrici
    score_version       VARCHAR(20) DEFAULT 'v1',
    calculated_at       TIMESTAMPTZ,
    UNIQUE (company_id, fiscal_year)
);

CREATE TABLE ai_reports (
    id                UUID PRIMARY KEY,
    company_id        UUID REFERENCES companies(id),
    fiscal_year       INTEGER NOT NULL,
    status            VARCHAR(20),  -- pending, generating, done, error
    summary           TEXT,
    score_explanation TEXT,
    risk_assessment   TEXT,
    outlook           TEXT,
    strengths         JSONB,        -- string[]
    weaknesses        JSONB,        -- string[]
    key_risks         JSONB,        -- string[]
    recommendations   JSONB,        -- string[]
    red_flags         JSONB,        -- string[]
    model_used        VARCHAR(100),
    generated_at      TIMESTAMPTZ,
    error_message     TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ML forecasting rezultati — jedan red po kompaniji (upsert)
CREATE TABLE forecasts (
    id                  UUID PRIMARY KEY,
    company_id          UUID REFERENCES companies(id) UNIQUE,
    base_year           INTEGER NOT NULL,       -- zadnja historijska godina
    horizon             INTEGER NOT NULL,       -- broj prognoziranih godina (1–3)
    method              VARCHAR(50) NOT NULL,   -- "ols_linear" ili "insufficient_data"
    data_points         INTEGER NOT NULL,       -- broj historijskih tačaka korištenih
    predictions         JSONB NOT NULL,         -- list[ForecastPoint] kao JSON
    historical_summary  JSONB,                  -- list[HistoricalPoint] kao JSON
    revenue_r_squared   NUMERIC(6,4),           -- R² OLS modela za revenue
    revenue_cagr        NUMERIC(8,4),           -- CAGR prihoda iz historijskih podataka
    generated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook registracije po organizaciji
CREATE TABLE webhooks (
    id               UUID PRIMARY KEY,
    org_id           UUID REFERENCES organizations(id),
    url              VARCHAR(2048) NOT NULL,
    secret           VARCHAR(255) NOT NULL,  -- HMAC signing secret (nikad u GET responsu)
    events           JSONB NOT NULL,         -- list[str] npr. ["kpi.calculated"]
    is_active        BOOLEAN DEFAULT TRUE,
    description      VARCHAR(255),
    last_triggered_at TIMESTAMPTZ,
    failure_count    INTEGER DEFAULT 0,      -- auto-deactivate pri >= 10 uzastopnih grešaka
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Podržani webhook eventi:**
- `kpi.calculated` — KPI + score kalkulacija završena
- `report.processed` — PDF parsiranje završeno
- `ai_report.generated` — AI izvještaj generisan

### Indeksi

```sql
CREATE INDEX idx_companies_org ON companies(org_id);
CREATE INDEX idx_reports_company_year ON financial_reports(company_id, fiscal_year);
CREATE INDEX idx_kpi_company_year ON kpi_snapshots(company_id, fiscal_year);
CREATE INDEX idx_scores_company_year ON company_scores(company_id, fiscal_year);
CREATE INDEX idx_scores_risk ON company_scores(risk_level);
CREATE INDEX idx_webhooks_org ON webhooks(org_id);
```

---

## Autentifikacija i autorizacija

```
Registracija → bcrypt hash lozinke → JWT (access 60min + refresh 30 dana)

Authorization: Bearer <access_token>
    │
    ▼
FastAPI Dependency: get_current_user()
    │  decode JWT → user_id → DB lookup → User object
    ▼
Ruta dobija: current_user: User
    │
    ▼
Sve operacije filtrirane po: org_id = current_user.org_id
```

**Role-based pristup:**
- `admin` — sve operacije uključujući brisanje i korisničke postavke
- `analyst` — upload, generisanje izvještaja, čitanje svega
- `viewer` — samo čitanje (scoreovi, KPI, AI izvještaji)

---

## Celery task flow

```python
# 1. PDF upload API → odmah vrati response, task ide u queue
process_pdf_report.delay(report_id, file_path)

# 2. Worker obrađuje PDF
@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_pdf_report(self, report_id, file_path):
    raw_data = extract_financial_data(file_path)   # PDF → dict
    # update FinancialReport.raw_data, .status = "done"
    calculate_kpis_and_score.delay(company_id, fiscal_year)   # chain
    dispatch_webhook_event.delay("report.processed", org_id, {...})

# 3. KPI + Score kalkulacija
def calculate_kpis_and_score(company_id, fiscal_year):
    kpi_data = calculate_all(raw_data, prev_raw)  # 25+ metrika
    score    = calc_score(kpi_data, fs, industry)  # 0–100
    # upsert KPISnapshot + CompanyScore
    invalidate_company_sync(company_id, fiscal_year)  # Redis cache
    dispatch_webhook_event.delay("kpi.calculated", org_id, {...})

# 4. AI izvještaj (on demand)
def generate_ai_report_task(company_id, fiscal_year):
    report = generate(company, kpis, score, trend)  # LLM call
    # upsert AIReport
    dispatch_webhook_event.delay("ai_report.generated", org_id, {...})

# 5. Forecasting (on demand)
def generate_forecast_task(company_id, horizon):
    snapshots = fetch_kpi_snapshots(company_id, order_by=fiscal_year ASC)
    result = forecast(company_id, historical_points, horizon)
    # upsert Forecast (jedan red po kompaniji)

# 6. Webhook dostava (async, po organizaciji)
def dispatch_webhook_event(event, org_id, payload):
    hooks = fetch_active_webhooks(org_id, event)
    for hook in hooks:
        success, status, err = deliver(hook.url, hook.secret, event, payload)
        if not success:
            hook.failure_count += 1
            if hook.failure_count >= 10:
                hook.is_active = False   # auto-deactivate
```

**Retry logika:** max 3 pokušaja, 30s delay između pokušaja. Greške se loguju i status se postavlja na `"error"`.

**Redis cache invalidacija** radi se sinhrono iz Celery context-a (`redis` sync klijent):
```python
def invalidate_company_sync(company_id: str, fiscal_year: int):
    r = redis.Redis.from_url(settings.SYNC_DATABASE_URL)
    keys_to_delete = [kpi_key(...), score_key(...), ...]
    r.delete(*keys_to_delete)
```

---

## Monitoring i observability

### Structured logging

`app/core/logging_config.py` — `JSONFormatter` zapisuje svaki log record kao JSON liniju:

```json
{
  "timestamp": "2025-05-11T10:31:05.123Z",
  "level": "INFO",
  "logger": "bilansia.http",
  "message": "POST /api/v1/companies/abc/reports → 201 (312.4ms)",
  "request_id": "a1b2c3d4"
}
```

Za `DEBUG` i `ERROR` level dodaju se `module`, `funcName`, `lineno` i traceback.

### Request logging middleware

`RequestLoggingMiddleware` (Starlette BaseHTTPMiddleware):
- Generiše kratki UUID (`request_id`) za svaki zahtjev
- Loguje metodu, path, HTTP status i trajanje
- Dodaje `X-Request-ID` i `X-Response-Time` headere u response
- Preskače health check / docs endpointe

### Sentry

Inicijalizuje se pri startu ako je `SENTRY_DSN` postavljen:
- FastAPI integracija (tracing po endpoint-u)
- SQLAlchemy integracija
- Celery integracija
- 20% traces sample rate, 5% profiling
- `send_default_pii=False`

### Rate limiting

`slowapi` sa Redis storage:
- **Globalno:** 120 zahtjeva/minuti po IP
- **Upload endpoint:** 20 zahtjeva/minuti po IP
- Prekoračenje vraća `429 Too Many Requests`

---

## Frontend arhitektura

### App Router struktura (Next.js 15)

```
src/app/
├── (auth)/           # Public routes — nema sidebar-a
│   ├── login/
│   └── register/
├── (dashboard)/      # Protected routes — omotane sa Sidebar-om
│   ├── layout.tsx    # Auth guard + Sidebar layout
│   ├── dashboard/    # Pregled — company grid, stat kartice
│   └── companies/
│       ├── page.tsx  # Lista kompanija s pretragom
│       ├── new/      # Forma za novu kompaniju
│       └── [id]/
│           ├── page.tsx          # Detalji: score gauge, KPI, trend
│           ├── kpi/              # Kompletan KPI breakdown
│           ├── reports/          # Upload i status PDF-ova
│           ├── ai-report/        # AI narativni izvještaj + Q&A
│           ├── benchmarks/       # Industry benchmarks (p25/p50/p75, percentili)
│           └── forecast/         # ML prognoza (grafikon + CI + tabela)
└── page.tsx          # Redirect → /dashboard
```

### Tok podataka

```
Zustand (auth store)
    │  accessToken, user, setAuth(), logout()
    ▼
lib/api.ts
    │  req<T>(path, options) → fetch + Bearer token + error handling
    │  Namespaces: auth, companies, reports, kpi, score, aiReports,
    │              benchmarks, forecast
    ▼
React component
    │  useEffect() ili TanStack Query
    ▼
UI komponente
    │  Card, Badge, ScoreGauge, CategoryScoreBar, ScoreRadar,
    │  KPITrendChart, OverallGauge, PercentileBar,
    │  ComposedChart (forecast CI Area + Line)
```

### Forecast grafikon (Recharts)

CI band se postiže stacking trikom jer Recharts nema native range area:

```
Area[1] rev_band[0] — transparentna osnova (do donje granice CI)
Area[2] rev_band[1]-rev_band[0] — obojena površina (širina CI intervala)
        stacked="1" na oba → vizualni efekt CI band-a
Line[3] rev_hist — puna linija (historija)
Line[4] rev_pred — isprekidana linija (prognoza, strokeDasharray="5 4")
ReferenceLine x={base_year} — vertikalna linija = podjela historija/prognoza
```

**Bridge point:** zadnja historijska godina dobija i prve prognozne vrijednosti u `buildChartData()` tako da linije budu kontinuirane (nema praznine na spoju historije i prognoze).

### Keyframe animacije (tailwind.config.ts)

| Klasa | Efekat |
|---|---|
| `animate-fade-in-up` | Fade + translateY(18px→0) |
| `animate-slide-right` | Fade + translateX(-14px→0) |
| `animate-scale-in` | Fade + scale(0.94→1) |
| `animate-float` | Vertikalni float (gore-dolje, 5s) |
| `animate-glow-pulse` | Opacity + scale pulsiranje (2.5s) |
| `animate-ping-slow` | CSS ping, 2s interval |
| `animate-shimmer` | Skeleton shimmer efekat |
| `.delay-{75..500}` | `animation-delay` utility klase |
