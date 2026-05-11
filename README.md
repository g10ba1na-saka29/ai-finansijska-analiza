# Bilansia — AI Finansijska Analiza

> Platforma za automatsku finansijsku analizu i AI izvještavanje malih i srednjih preduzeća na prostoru Bosne i Hercegovine, Srbije i Hrvatske.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com)

---

## Šta je ovo?

**Bilansia** je SaaS platforma koja transformiše standardne finansijske izvještaje (PDF) u strukturirane podatke, izračunate KPI metrike, composite risk score, AI-generisani narativni izvještaj i višegodišnje prognoze — sve u jednom automatizovanom pipeline-u.

Namijenjena je finansijskim analitičarima, računovođama, bankama i investitorima koji rade sa finansijskim izvještajima prema BiH/RS/HR računovodstvenim standardima (APIF, FIA, FINA format).

---

## Ključne funkcionalnosti

| Funkcionalnost | Opis |
|---|---|
| **📄 PDF Ekstrakcija** | Automatsko parsiranje bilansa stanja, bilansa uspjeha i cash flow izvještaja (Camelot + pdfplumber + OCR) |
| **📊 25+ KPI Metrika** | Likvidnost, profitabilnost, zaduženost, rast prihoda, cash flow efikasnost |
| **🎯 Risk Scoring (0–100)** | Composite score iz 5 kategorija + Altman Z-Score za prognoziranje bankrota |
| **🤖 AI Izvještaji** | Narativni izvještaj generisan putem GPT-4o ili Claude-a: summary, snage, slabosti, preporuke |
| **💬 Q&A Chat** | Real-time pitanja o finansijskim podacima kompanije |
| **📈 Višegodišnji trend** | Praćenje KPI metrika kroz godine, YoY analiza |
| **🏭 Industry Benchmarks** | Poređenje 14 KPI metrika sa prosjekom industrije i percentilnim rangom (p25/p50/p75) |
| **🔮 ML Forecasting** | OLS linearna regresija s 95% intervalom povjerenja — prognoza prihoda, EBITDA i neto dobiti za 1–3 godine |
| **⚡ Redis Caching** | Cache-aside pattern za sve analitičke endpoint-e (TTL 1–2h), invalidacija pri svakom novom izračunu |
| **🔔 Webhooks** | Notifikacije na vaš URL pri `kpi.calculated`, `report.processed` i `ai_report.generated` eventima, potpisane HMAC-SHA256 |
| **🏢 Multi-tenant** | Izolacija po organizacijama, role-based pristup (admin, analyst, viewer) |
| **📥 PDF Export** | Preuzimanje AI izvještaja kao formatiranog PDF dokumenta |
| **📡 Monitoring** | Sentry integracija, strukturirani JSON logovi, rate limiting (120/min globalno, 20/min upload) |

---

## Brzi start (5 minuta)

### Preduslovi
- Docker Desktop
- Git

### 1. Kloniraj repozitorij
```bash
git clone <repo-url>
cd ai-finansijska-analiza
```

### 2. Postavi environment varijable
```bash
cp .env.example .env
```
Uredi `.env` i popuni:
```env
SECRET_KEY=tvoj-tajni-kljuc-min-32-karaktera
LLM_PROVIDER=openai          # ili: anthropic, local
LLM_MODEL=gpt-4o             # ili: claude-3-5-sonnet, llama3
OPENAI_API_KEY=sk-...        # ako koristiš OpenAI

# Opcionalno — monitoring
SENTRY_DSN=https://...       # Sentry projekt DSN
LOG_JSON=false               # false za development (human-readable logovi)
```

### 3. Pokreni sve servise
```bash
make dev       # development mode sa hot-reload
# ili
docker compose up -d
```

### 4. Inicijalizuj bazu
```bash
make migrate
```

### 5. Otvori aplikaciju
| Servis | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **Flower (task monitor)** | http://localhost:5555 |
| **pgAdmin** | http://localhost:5050 |

### Registracija
Otvori http://localhost:3000 → registruj prvi nalog → dodaj kompaniju → upload finansijski izvještaj.

---

## Arhitektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 15)                       │
│  Login → Dashboard → Company Grid → Detail → AI Report → Q&A       │
│                      → Benchmarks → Forecast                        │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTPS / REST API
┌─────────────────────────▼───────────────────────────────────────────┐
│                       BACKEND (FastAPI)                             │
│  Auth │ Companies │ Reports │ Analytics │ AI Reports │ Benchmarks  │
│       │           │         │           │            │ Forecast    │
│                             │           │            │ Webhooks    │
│                Rate Limiting (slowapi) + Request Logging            │
└────┬────────────┬───────────┬──────────────────────┬────────────────┘
     │            │           │                      │
     ▼            ▼           ▼                      ▼
┌─────────┐  ┌────────┐  ┌──────────────┐     ┌──────────────┐
│Postgres │  │ Redis  │  │ Celery Worker│     │  LLM Client  │
│   DB    │  │ Broker │  │  Pipeline:   │     │ (GPT/Claude/ │
│         │  │ Cache  │  │ PDF→KPI→Score│     │  Ollama)     │
└─────────┘  └────────┘  │  →Webhooks  │     └──────────────┘
                          └──────┬───────┘
                   ┌─────────────▼───────────────┐
                   │      Processing Modules     │
                   │  ┌─────────────────────┐   │
                   │  │ PDF Parser          │   │
                   │  │ (Camelot+pdfplumber)│   │
                   │  ├─────────────────────┤   │
                   │  │ KPI Calculator      │   │
                   │  │ (25+ metrika)       │   │
                   │  ├─────────────────────┤   │
                   │  │ Score Engine        │   │
                   │  │ (0-100 + Altman Z)  │   │
                   │  ├─────────────────────┤   │
                   │  │ ML Forecasting      │   │
                   │  │ (OLS + 95% CI)      │   │
                   │  ├─────────────────────┤   │
                   │  │ AI Report Generator │   │
                   │  │ (LLM prompting)     │   │
                   │  └─────────────────────┘   │
                   └─────────────────────────────┘
```

### Pipeline obrade dokumenta

```
PDF upload
    │
    ▼
process_pdf_report (Celery)
    │  Camelot → tabele, pdfplumber → tekst, Tesseract → OCR
    │  Normalizacija BiH/RS/HR kolona
    ▼
raw_data JSON → FinancialReport.raw_data
    │  dispatch webhook: report.processed
    ▼
calculate_kpis_and_score (Celery)
    │  FinancialStatement ekstrakcija
    │  25+ KPI kalkulacija
    │  Composite score + Altman Z-Score
    │  Invalidacija Redis cache-a
    │  dispatch webhook: kpi.calculated
    ▼
KPISnapshot + CompanyScore → PostgreSQL
    │
    ▼ (opciono, on demand)
generate_ai_report_task (Celery)
    │  Context building (KPI + score + trend)
    │  LLM call (JSON mode)
    │  dispatch webhook: ai_report.generated
    ▼
AIReport → PostgreSQL
    │
    ▼ (opciono, on demand)
generate_forecast_task (Celery)
    │  OLS regresija na historijskim godinama
    │  95% CI iz RMSE reziduala
    ▼
Forecast → PostgreSQL (upsert, jedan red po kompaniji)
```

---

## Tehnički stack

### Backend
| Komponenta | Tehnologija |
|---|---|
| REST Framework | FastAPI 0.115 (async) |
| ORM | SQLAlchemy 2.0 (asyncpg) |
| Task Queue | Celery 5.4 + Redis |
| PDF Parser | Camelot 0.11, pdfplumber 0.11, Pytesseract 0.3 |
| LLM Integracija | OpenAI SDK 1.58, Anthropic SDK 0.40 |
| ML Forecasting | NumPy (OLS linearna regresija) |
| Webhooks | httpx (HMAC-SHA256 signing) |
| PDF Export | ReportLab 4.2 |
| Auth | JWT (HS256), Bcrypt |
| Migracije | Alembic 1.14 |
| Rate Limiting | slowapi 0.1.9 |
| Monitoring | Sentry SDK 2.19, structlog JSON |

### Frontend
| Komponenta | Tehnologija |
|---|---|
| Framework | Next.js 15, React 18 |
| Styling | TailwindCSS 3.4 |
| Charts | Recharts 2.13 (ComposedChart za forecast CI) |
| Forms | React Hook Form 7 + Zod |
| State | Zustand 4.5 |
| Server state | TanStack Query 5 |

### Infrastruktura
| Servis | Svrha |
|---|---|
| PostgreSQL 16 | Primarna baza podataka |
| Redis 7 | Celery broker + rezultati + API cache (TTL 1–2h) |
| Docker Compose | Lokalna orkestracija |
| Flower | Monitoring Celery taskova |
| pgAdmin | Web UI za bazu |

---

## Struktura projekta

```
ai-finansijska-analiza/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # FastAPI route handleri
│   │   │   ├── auth.py
│   │   │   ├── companies.py
│   │   │   ├── reports.py     # PDF upload (rate limited: 20/min)
│   │   │   ├── analytics.py   # KPI + score (Redis cache-aside)
│   │   │   ├── ai_reports.py
│   │   │   ├── benchmarks.py  # Industry benchmarks
│   │   │   ├── forecasting.py # ML prognoze
│   │   │   └── webhooks.py    # Webhook CRUD + test
│   │   ├── models/            # SQLAlchemy modeli
│   │   ├── modules/
│   │   │   ├── kpi/           # KPI kalkulatori (6 kategorija)
│   │   │   ├── scoring/       # Composite score + Altman Z
│   │   │   ├── pdf_parser/    # PDF ekstrakcija i normalizacija
│   │   │   ├── llm/           # LLM client + prompts + report gen
│   │   │   ├── ml/            # OLS forecasting (NumPy)
│   │   │   │   └── forecasting.py
│   │   │   └── webhooks/      # HMAC signing + HTTP delivery
│   │   │       └── dispatcher.py
│   │   ├── workers/tasks/     # Celery taskovi
│   │   │   ├── pdf_processing.py
│   │   │   ├── kpi_calculation.py  # + cache invalidation + webhook
│   │   │   ├── report_generation.py
│   │   │   ├── forecasting_task.py
│   │   │   └── webhook_delivery.py
│   │   └── core/
│   │       ├── cache.py       # AsyncCacheClient (Redis, TTL 1–2h)
│   │       ├── middleware.py  # RequestLoggingMiddleware
│   │       ├── logging_config.py  # JSON structured logging
│   │       └── security.py
│   └── alembic/               # DB migracije
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router stranice
│       │   ├── (auth)/        # login, register
│       │   └── (dashboard)/
│       │       └── companies/[id]/
│       │           ├── page.tsx       # Detalji: score, KPI, trend
│       │           ├── kpi/           # KPI breakdown
│       │           ├── reports/       # PDF upload
│       │           ├── ai-report/     # AI izvještaj + Q&A
│       │           ├── benchmarks/    # Industry benchmarks
│       │           └── forecast/      # ML prognoza
│       ├── components/        # UI komponente + charts
│       ├── lib/               # API client, utils
│       └── store/             # Zustand auth store
├── docker-compose.yml
├── Makefile
└── docs/                      # Detaljna dokumentacija
    ├── ARCHITECTURE.md
    ├── API.md
    ├── DEVELOPMENT.md
    └── VISION.md
```

---

## KPI kategorije i težine

| Kategorija | Težina | Metrike |
|---|---|---|
| **Likvidnost** | 20% | Current ratio, Quick ratio, Cash ratio |
| **Profitabilnost** | 25% | EBITDA margin, Net margin, ROE, ROA |
| **Zaduženost** | 20% | Debt/Equity, Interest coverage, Debt ratio |
| **Rast** | 20% | Revenue growth, EBITDA growth, Net income growth |
| **Cash Flow** | 15% | OCF margin, Free cash flow, Cash-to-debt |

**Risk nivoi:**
- 🟢 **Odlično** (≥ 80): Stabilna, zdrava kompanija
- 🔵 **Dobro** (60–79): Solidna financijska pozicija
- 🟡 **Upozorenje** (40–59): Postoje rizici, potreban monitoring
- 🟠 **Visok rizik** (20–39): Ozbiljni problemi, hitna akcija
- 🔴 **Kritično** (< 20): Opasnost od insolvencije

---

## Konfigurisanje LLM providera

Platforma podržava tri LLM providera — mijenja se samo `.env`:

```env
# OpenAI (default)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...

# Anthropic Claude
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...

# Lokalni Ollama (bez troškova)
LLM_PROVIDER=local
LLM_MODEL=llama3
# Ollama mora biti pokrenut na hostu: ollama serve
```

---

## Makefile komande

```bash
make dev          # Pokreni dev okruženje sa hot-reload
make up           # Produkcijski mod
make down         # Zaustavi servise
make down-v       # Zaustavi + obriši volume-e (PAZI: briše podatke)
make migrate      # Pokreni DB migracije
make logs         # Svi logovi
make logs-api     # API logovi
make logs-worker  # Worker logovi
make shell-api    # Bash shell u API kontejneru
make shell-db     # psql u DB kontejneru
make clean        # Potpuno čišćenje (images + volumes)
```

---

## Doprinošenje

Pogledaj [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) za detaljan development setup, coding standarde i upute za kreiranje pull request-ova.

---

## Dokumentacija

| Dokument | Sadržaj |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Detaljna arhitektura, moduli, data modeli |
| [docs/API.md](docs/API.md) | Kompletan API reference sa primjerima |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev setup, testiranje, coding standardi |
| [docs/VISION.md](docs/VISION.md) | Vizija projekta, roadmap, buduće funkcionalnosti |

---

## Licenca

Privatni projekat — sva prava zadržana.
