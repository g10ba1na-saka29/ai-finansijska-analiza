# AI Finansijska Analiza — Project Plan

> Platforma za AI-powered finansijsku analizu kompanija.
> Parsira finansijske izvještaje, računa KPI metrike, vrši forecasting i rizik analizu,
> te generiše prirodnjezički izvještaj sa score-om firme.
>
> **Target korisnici:** Pravna lica (kompanije, računovodstvene agencije, investitori, banke)

---

## Sadržaj

1. [Arhitektura sistema](#1-arhitektura-sistema)
2. [Moduli](#2-moduli)
3. [Baza podataka — shema](#3-baza-podataka--shema)
4. [API Endpointi](#4-api-endpointi)
5. [KPI Metrike](#5-kpi-metrike)
6. [Score Model](#6-score-model)
7. [AI / LLM integracija](#7-ai--llm-integracija)
8. [Faze razvoja](#8-faze-razvoja)
9. [Infrastruktura](#9-infrastruktura)
10. [Dokumentacija za korisnike](#10-dokumentacija-za-korisnike)

---

## 1. Arhitektura sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        KLIJENTI                             │
│          Web App (Next.js)  │  API klijenti (B2B)           │
└──────────────────┬──────────────────────┬───────────────────┘
                   │                      │
                   ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI (REST API)                      │
│   Auth │ Upload │ Reports │ Analytics │ Webhooks            │
└────────┬──────────────┬──────────────────────────┬──────────┘
         │              │                          │
         ▼              ▼                          ▼
  ┌─────────┐   ┌──────────────┐         ┌────────────────┐
  │  Redis  │   │ Celery Workers│         │  PostgreSQL     │
  │ (cache/ │   │               │         │                │
  │  queue) │   │ - PDF parsing │         │ companies      │
  └─────────┘   │ - KPI calc    │         │ reports        │
                │ - ML pipeline │         │ kpi_snapshots  │
                │ - LLM call    │         │ users / orgs   │
                └──────┬────────┘         └────────────────┘
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
   ┌────────────┐ ┌─────────┐  ┌──────────────┐
   │  PDF       │ │ ML /    │  │  LLM         │
   │  Parser    │ │ XGBoost │  │  (OpenAI /   │
   │ (camelot + │ │ Forecast│  │   local)     │
   │ pdfplumber)│ └─────────┘  └──────────────┘
   └────────────┘
```

**Flow — analiza jedne kompanije:**

```
1. Korisnik uploada PDF (finansijski izvještaj)
           │
2. Celery worker: PDF parsing → strukturirani podaci
           │
3. KPI engine: računa sve metrike
           │
4. ML pipeline: forecasting + anomaly detection
           │
5. Score engine: kompozitni score (0–100)
           │
6. LLM: generira prirodnjezički izvještaj
           │
7. Rezultati → PostgreSQL, cache u Redis
           │
8. Frontend: dashboard + downloadable PDF report
```

---

## 2. Moduli

### 2.1 PDF Parser (`modules/pdf_parser/`)

**Biblioteke:** `camelot-py` (primarna), `pdfplumber` (fallback + tekst)

```
pdf_parser/
├── extractor.py        # Glavni entry point
├── table_parser.py     # camelot integracija, lattice + stream mode
├── text_parser.py      # pdfplumber za tekst i metadata
├── normalizer.py       # Normalizacija naziva kolona (BiH/RS/HR kontekst)
└── validators.py       # Provjera kompletnosti izvučenih podataka
```

Podržani tipovi dokumenata:
- Bilans stanja (Balance Sheet)
- Bilans uspjeha / P&L (Income Statement)
- Cash Flow izvještaj
- Poreski bilans
- Revizorski izvještaji (tekst ekstrakcija)

### 2.2 KPI Engine (`modules/kpi/`)

```
kpi/
├── liquidity.py        # Current ratio, Quick ratio, Cash ratio
├── profitability.py    # EBITDA margin, ROE, ROA, Net margin
├── leverage.py         # D/E ratio, Interest coverage, Debt ratio
├── growth.py           # YoY revenue, CAGR, Asset growth
├── cashflow.py         # FCF, OCF margin, Cash conversion cycle
├── efficiency.py       # Asset turnover, Inventory turnover, DSO
└── calculator.py       # Agregator — računa sve metrike odjednom
```

### 2.3 ML Pipeline (`modules/ml/`)

```
ml/
├── forecasting.py      # XGBoost time-series forecasting (revenue, EBITDA)
├── anomaly.py          # Isolation Forest — detekcija anomalija u podacima
├── risk_model.py       # Logistička regresija / XGBoost — bankruptcy risk (Altman Z-score + ML)
├── benchmarking.py     # Poređenje sa industrijskim prosjekom
└── preprocessing.py    # Feature engineering za ML modele
```

### 2.4 Score Engine (`modules/scoring/`)

```
scoring/
├── composite_score.py  # Kompozitni 0–100 score
├── weights.py          # Konfigurabilni ponderi po kategorijama
├── thresholds.py       # Granične vrijednosti (kritično / upozorenje / dobro)
└── history.py          # Praćenje score-a kroz vrijeme
```

### 2.5 LLM Modul (`modules/llm/`)

```
llm/
├── client.py           # OpenAI / lokalni LLM adapter (jednaki interface)
├── prompts.py          # Prompt templates za različite tipove izvještaja
├── report_generator.py # Generiše strukturirani izvještaj iz KPI + score
└── qa.py               # Q&A — korisnik može pitati o izvještaju
```

### 2.6 API (`api/`)

```
api/
├── routes/
│   ├── auth.py
│   ├── companies.py
│   ├── reports.py
│   ├── analytics.py
│   └── webhooks.py
├── schemas/            # Pydantic modeli
├── dependencies.py     # Auth, DB session, rate limiting
└── middleware.py       # Logging, CORS, error handling
```

---

## 3. Baza podataka — shema

### Tablice

```sql
-- Organizacije (B2B klijenti platforme)
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50) NOT NULL DEFAULT 'basic', -- basic, pro, enterprise
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Korisnici
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'analyst', -- admin, analyst, viewer
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Analizirane kompanije
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),
    name            VARCHAR(255) NOT NULL,
    tax_id          VARCHAR(50),           -- JIB / PIB / OIB
    industry        VARCHAR(100),
    country         CHAR(2) DEFAULT 'BA', -- ISO 3166 (BA, RS, HR...)
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Finansijski izvještaji (uploadovani dokumenti)
CREATE TABLE financial_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id),
    fiscal_year     INTEGER NOT NULL,
    report_type     VARCHAR(50) NOT NULL,  -- balance_sheet, income, cash_flow
    source_file     VARCHAR(500),          -- S3 / lokalni path
    raw_data        JSONB,                 -- izvučeni podaci iz PDF-a
    status          VARCHAR(50) DEFAULT 'pending', -- pending, processing, done, error
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

-- KPI snimci (jedna kompanija, jedna godina)
CREATE TABLE kpi_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id),
    fiscal_year     INTEGER NOT NULL,
    -- Likvidnost
    current_ratio   NUMERIC(10,4),
    quick_ratio     NUMERIC(10,4),
    cash_ratio      NUMERIC(10,4),
    -- Profitabilnost
    ebitda_margin   NUMERIC(10,4),
    net_margin      NUMERIC(10,4),
    roe             NUMERIC(10,4),
    roa             NUMERIC(10,4),
    -- Zaduženost
    debt_to_equity  NUMERIC(10,4),
    interest_coverage NUMERIC(10,4),
    -- Rast (YoY)
    revenue_growth  NUMERIC(10,4),
    ebitda_growth   NUMERIC(10,4),
    -- Cash flow
    fcf             NUMERIC(20,2),
    ocf_margin      NUMERIC(10,4),
    -- Raw vrijednosti (za custom kalkulacije)
    raw_financials  JSONB,
    calculated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, fiscal_year)
);

-- Score historija
CREATE TABLE company_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id),
    fiscal_year     INTEGER NOT NULL,
    total_score     NUMERIC(5,2),          -- 0–100
    liquidity_score NUMERIC(5,2),
    profitability_score NUMERIC(5,2),
    leverage_score  NUMERIC(5,2),
    growth_score    NUMERIC(5,2),
    cashflow_score  NUMERIC(5,2),
    risk_level      VARCHAR(20),           -- low, medium, high, critical
    score_version   VARCHAR(10) DEFAULT '1.0',
    calculated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, fiscal_year)
);

-- AI Izvještaji
CREATE TABLE ai_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id),
    fiscal_year     INTEGER NOT NULL,
    summary         TEXT,                  -- kratak sažetak (2–3 rečenice)
    full_report     TEXT,                  -- kompletan LLM izvještaj
    key_findings    JSONB,                 -- lista ključnih nalaza (strukturirano)
    recommendations JSONB,                 -- lista preporuka
    model_used      VARCHAR(100),          -- gpt-4o, claude-3, llama3...
    generated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Forecasting rezultati
CREATE TABLE forecasts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id),
    metric          VARCHAR(100),          -- revenue, ebitda, net_income...
    forecast_year   INTEGER,
    predicted_value NUMERIC(20,2),
    confidence_low  NUMERIC(20,2),
    confidence_high NUMERIC(20,2),
    model_used      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (sve akcije korisnika)
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100),              -- report.upload, score.calculate...
    entity_type VARCHAR(50),
    entity_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API Endpointi

### Auth
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout
```

### Kompanije
```
GET    /api/v1/companies                    # Lista kompanija organizacije
POST   /api/v1/companies                    # Dodaj kompaniju
GET    /api/v1/companies/{id}               # Detalji kompanije
PUT    /api/v1/companies/{id}               # Ažuriraj
DELETE /api/v1/companies/{id}               # Obriši
GET    /api/v1/companies/{id}/summary       # Kratak pregled + zadnji score
```

### Izvještaji / Upload
```
POST   /api/v1/companies/{id}/reports       # Upload PDF → pokreće Celery job
GET    /api/v1/companies/{id}/reports       # Lista izvještaja
GET    /api/v1/reports/{report_id}          # Status + podaci izvještaja
DELETE /api/v1/reports/{report_id}          # Obriši
GET    /api/v1/reports/{report_id}/raw      # Sirovi izvučeni podaci (JSON)
```

### Analitika / KPI
```
GET    /api/v1/companies/{id}/kpi/{year}           # KPI za godinu
GET    /api/v1/companies/{id}/kpi/trend            # Trend više godina
GET    /api/v1/companies/{id}/score/{year}          # Score breakdown
GET    /api/v1/companies/{id}/score/history         # Score kroz vrijeme
GET    /api/v1/companies/{id}/benchmarks            # Poređenje sa industrijom
```

### AI Izvještaji
```
POST   /api/v1/companies/{id}/ai-report/{year}     # Generiši AI izvještaj
GET    /api/v1/companies/{id}/ai-report/{year}     # Dohvati izvještaj
POST   /api/v1/companies/{id}/qa                   # Q&A o kompaniji
GET    /api/v1/companies/{id}/ai-report/{year}/pdf # Downloadable PDF izvještaj
```

### Forecasting
```
GET    /api/v1/companies/{id}/forecast              # Forecast sljedeće 1–3 god.
POST   /api/v1/companies/{id}/forecast/custom       # Custom forecast parametri
```

### Admin / Organizacija
```
GET    /api/v1/org/users
POST   /api/v1/org/users/invite
PUT    /api/v1/org/users/{user_id}/role
GET    /api/v1/org/audit-log
GET    /api/v1/org/usage                            # API usage, quota
```

### Webhooks
```
POST   /api/v1/webhooks                    # Registruj webhook
GET    /api/v1/webhooks                    # Lista webhooks
DELETE /api/v1/webhooks/{id}
```

---

## 5. KPI Metrike

### Likvidnost
| Metrika | Formula | Zdrava vrijednost |
|---|---|---|
| Current Ratio | Obrtna imovina / Kratkoročne obaveze | > 1.5 |
| Quick Ratio | (Obrtna - Zalihe) / Kratkoročne obaveze | > 1.0 |
| Cash Ratio | Gotovina / Kratkoročne obaveze | > 0.5 |

### Profitabilnost
| Metrika | Formula | Zdrava vrijednost |
|---|---|---|
| EBITDA Margin | EBITDA / Prihod | > 15% |
| Net Profit Margin | Neto dobit / Prihod | > 5% |
| ROE | Neto dobit / Vlastiti kapital | > 12% |
| ROA | Neto dobit / Ukupna imovina | > 5% |
| Gross Margin | (Prihod - COGS) / Prihod | > 30% |

### Zaduženost
| Metrika | Formula | Zdrava vrijednost |
|---|---|---|
| Debt-to-Equity | Ukupan dug / Vlastiti kapital | < 2.0 |
| Interest Coverage | EBIT / Kamate | > 3.0 |
| Debt Ratio | Ukupne obaveze / Ukupna imovina | < 0.5 |

### Rast (YoY)
| Metrika | Formula |
|---|---|
| Revenue Growth | (Prihod_t - Prihod_t-1) / Prihod_t-1 |
| EBITDA Growth | YoY promjena EBITDA |
| Asset Growth | YoY promjena ukupne imovine |
| CAGR (3-god) | (Prihod_n / Prihod_0)^(1/3) - 1 |

### Cash Flow
| Metrika | Formula | Zdrava vrijednost |
|---|---|---|
| Free Cash Flow | OCF - CapEx | Pozitivan |
| OCF Margin | Operativni CF / Prihod | > 10% |
| Cash Conversion | 365 / (Prihod / Neto obrtni kapital) | Što niži |

### Efikasnost
| Metrika | Formula |
|---|---|
| Asset Turnover | Prihod / Ukupna imovina |
| Receivables Turnover | Prihod / Potraživanja |
| Days Sales Outstanding | 365 / Receivables Turnover |

---

## 6. Score Model

**Kompozitni score: 0–100 bodova**

```
Score kategorije:
├── Likvidnost           (max 20 bodova)
├── Profitabilnost       (max 25 bodova)
├── Zaduženost           (max 20 bodova)
├── Rast                 (max 20 bodova)
└── Cash Flow            (max 15 bodova)

Risk nivoi:
  80–100 → EXCELLENT  (zelena)
  60–79  → GOOD       (plava)
  40–59  → WARNING    (žuta)
  20–39  → HIGH RISK  (narandžasta)
   0–19  → CRITICAL   (crvena)
```

**Altman Z-Score** integriran kao dodatni signal za bankrotski rizik:
```
Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
X1 = Obrtni kapital / Aktiva
X2 = Zadržana dobit / Aktiva
X3 = EBIT / Aktiva
X4 = Tr. vrijednost kapitala / Obaveze
X5 = Prihod / Aktiva

Z > 2.9  → Sigurna zona
Z 1.8–2.9 → Siva zona
Z < 1.8  → Zona opasnosti
```

---

## 7. AI / LLM integracija

### Prompt arhitektura

```python
# Strukturirani input za LLM
{
  "company": "Naziv kompanije d.o.o.",
  "fiscal_year": 2024,
  "industry": "Manufacturing",
  "kpis": { ...sve KPI vrijednosti... },
  "score": { "total": 72, "breakdown": {...} },
  "trend": "rast prihoda 3 god, pad marže 2024",
  "risk_flags": ["visok D/E ratio", "pad FCF"],
  "benchmarks": { "industry_avg_ebitda": 0.14 }
}
```

### Output format

```json
{
  "summary": "Kompanija X pokazuje solidnu likvidnost uz znakove pritiska...",
  "score_explanation": "Score od 72/100 reflektuje...",
  "strengths": ["Stabilan prihod rast 12% YoY", "Dobra likvidnost"],
  "weaknesses": ["Pad EBITDA margine", "Povećanje duga"],
  "recommendations": ["Optimizovati troškove", "Razmotriti refinansiranje"],
  "risk_assessment": "Umjeren rizik. Altman Z=2.4 (siva zona).",
  "outlook": "Kratkoročno stabilan, dugoročno zahtijeva pažnju."
}
```

### LLM provideri (swappable adapter)

```python
class LLMClient:
    providers = {
        "openai": OpenAIProvider,    # gpt-4o
        "anthropic": AnthropicProvider,  # claude-3-5-sonnet
        "local": OllamaProvider,     # llama3, mistral (self-hosted)
    }
```

---

## 8. Faze razvoja

### Faza 1 — Foundation (2–3 sedmice)
- [ ] Projekt setup: FastAPI, PostgreSQL, Docker Compose
- [ ] Auth sistem (JWT + refresh tokeni)
- [ ] Company & Organization CRUD
- [ ] PDF upload + Celery job queue
- [ ] camelot + pdfplumber integracija
- [ ] Osnovna normalizacija podataka

### Faza 2 — KPI & Score Engine (2–3 sedmice)
- [ ] Implementacija svih KPI metrika
- [ ] Kompozitni score model
- [ ] Altman Z-Score
- [ ] KPI trend analiza
- [ ] PostgreSQL snimci + historija

### Faza 3 — ML & Forecasting (2 sedmice)
- [ ] XGBoost forecasting (revenue, EBITDA)
- [ ] Anomaly detection (Isolation Forest)
- [ ] Bankruptcy risk model
- [ ] Industry benchmarking dataset

### Faza 4 — LLM Izvještaji (1–2 sedmice)
- [ ] OpenAI integracija + prompt engineering
- [ ] Strukturirani izvještaj generator
- [ ] PDF export izvještaja (WeasyPrint / reportlab)
- [ ] Q&A endpoint

### Faza 5 — Frontend (3–4 sedmice)
- [ ] Next.js projekt setup + Tailwind
- [ ] Auth flow (login, register, org management)
- [ ] Company dashboard + KPI kartice
- [ ] Score visualization (gauge chart, breakdown)
- [ ] Recharts: trend grafikoni, radar chart, bar charts
- [ ] AI izvještaj viewer
- [ ] PDF download

### Faza 6 — Polish & Production (2 sedmice)
- [ ] Redis caching strategija
- [ ] Rate limiting + quota management
- [ ] Audit log
- [ ] Webhook system
- [ ] Monitoring (Sentry, logging)
- [ ] Dokumentacija za korisnike

---

## 9. Infrastruktura

### Docker Compose (development)

```yaml
services:
  api:        # FastAPI (uvicorn)
  worker:     # Celery worker
  beat:       # Celery beat (scheduled tasks)
  db:         # PostgreSQL 16
  redis:      # Redis 7
  flower:     # Celery monitoring UI
  nginx:      # Reverse proxy (production)
```

### Environment varijable

```env
# API
DATABASE_URL=postgresql://user:pass@db:5432/finanaliza
REDIS_URL=redis://redis:6379/0
SECRET_KEY=...
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# LLM
OPENAI_API_KEY=...
LLM_PROVIDER=openai       # openai | anthropic | local
LLM_MODEL=gpt-4o

# File storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=50

# Feature flags
ENABLE_FORECASTING=true
ENABLE_BENCHMARKS=true
```

---

## 10. Dokumentacija za korisnike

### Struktura korisničke dokumentacije

```
docs/
├── getting-started/
│   ├── onboarding.md          # Registracija, kreiranje organizacije
│   ├── first-analysis.md      # Kako analizirati prvu kompaniju
│   └── pdf-requirements.md    # Zahtjevi za PDF fajlove
│
├── features/
│   ├── kpi-metrics.md         # Objašnjenje svih KPI metrika
│   ├── score-model.md         # Kako funkcioniše score (0–100)
│   ├── ai-reports.md          # AI izvještaji — šta znače nalazi
│   ├── forecasting.md         # Forecasting — metodologija
│   └── risk-assessment.md     # Procjena rizika, Altman Z-score
│
├── api/
│   ├── authentication.md      # API ključevi, JWT
│   ├── endpoints.md           # API referenca
│   └── webhooks.md            # Webhook integracije
│
└── changelog/
    └── CHANGELOG.md           # Sve promjene verzija
```

### CHANGELOG format

```markdown
## [1.1.0] — 2025-06-01
### Dodano
- Altman Z-Score integriran u risk assessment
- Export izvještaja u PDF

### Promijenjeno
- Score kalibracija za manufacturing sektor

### Ispravljeno
- PDF parser greška za tabele bez okvira
```

---

## Napomene

- **Lokalizacija:** Podržati finansijske izvještaje po BiH/RS/HR računovodstvenim standardima (MRS/MSFI)
- **Privatnost podataka:** Finansijski podaci su povjerljivi — org-level izolacija u bazi, enkripcija fajlova
- **Auditabilnost:** Svaka kalkulacija mora biti reproducibilna i traceable — čuvati raw inpute
- **LLM fallback:** Ako LLM API nije dostupan, sistem vraća strukturirani JSON bez narativnog dijela
- **Verzioniranje score modela:** Svaki score čuva `score_version` — promjene modela ne retroaktivno mijenjaju historiju

---

*Dokument se ažurira uz svaki sprint. Zadnja izmjena: 2026-05-08*
