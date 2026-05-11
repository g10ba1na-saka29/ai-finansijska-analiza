# Development Guide

## Preduslovi

| Alat | Verzija | Napomena |
|---|---|---|
| Docker Desktop | ≥ 4.20 | Uključuje Docker Compose v2 |
| Git | ≥ 2.40 | |
| Node.js | ≥ 20 | Samo ako radiš frontend van Docker-a |
| Python | ≥ 3.12 | Samo ako radiš backend van Docker-a |

---

## Postavljanje dev okruženja

### 1. Kloniranje i env setup

```bash
git clone <repo-url>
cd ai-finansijska-analiza
cp .env.example .env
```

Uredi `.env` — minimalni skup za dev:

```env
# Baza
POSTGRES_USER=finuser
POSTGRES_PASSWORD=finpass
POSTGRES_DB=finanaliza
DATABASE_URL=postgresql+asyncpg://finuser:finpass@db:5432/finanaliza

# Redis
REDIS_URL=redis://redis:6379/0

# JWT (promijeni u produkciji!)
SECRET_KEY=dev-secret-key-minimalno-32-karaktera-12345
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# LLM (opciono za lokalni dev)
LLM_PROVIDER=local        # ili openai/anthropic
LLM_MODEL=llama3
# OPENAI_API_KEY=sk-...   # ako koristiš OpenAI

# Upload
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=50

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Pokretanje

```bash
make dev        # Svi servisi sa hot-reload
```

Čeka se dok se ne pojavi:
```
fin_frontend  | ✓ Ready in 6.1s
fin_api       | INFO:     Application startup complete.
```

### 3. Inicijalizacija baze

```bash
make migrate    # Pokreni Alembic migracije
```

### 4. Provjera

```bash
curl http://localhost:8000/health
# {"status":"ok","db":"connected","redis":"connected"}
```

---

## Struktura docker-compose servisa

| Servis | Port | Hot-reload |
|---|---|---|
| `frontend` | 3000 | ✅ (`WATCHPACK_POLLING=true`) |
| `api` | 8000 | ✅ (`--reload`) |
| `worker` | — | ✅ (volume mount) |
| `beat` | — | ✅ (volume mount) |
| `flower` | 5555 | — |
| `db` | 5432 | — |
| `redis` | 6379 | — |
| `pgadmin` | 5050 | — |

---

## Backend development

### Dodavanje novog API endpointa

1. Kreiraj ili otvori odgovarajući route fajl u `backend/app/api/routes/`
2. Definiraj Pydantic sheme za request/response
3. Implementiraj handler funkciju (async)
4. Registriraj router u `backend/app/main.py`

```python
# Primjer: backend/app/api/routes/companies.py
@router.get("/{company_id}/summary")
async def get_company_summary(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanySummaryResponse:
    # Filtriraj po org_id za multi-tenant sigurnost!
    company = await get_company_or_404(db, company_id, current_user.org_id)
    ...
```

### Dodavanje nove KPI metrike

1. Dodaj field u model `backend/app/models/kpi_snapshot.py`
2. Implementiraj kalkulaciju u odgovarajućem modulu (`kpi/liquidity.py` itd.)
3. Dodaj `flat.get("nova_metrika")` u `backend/app/workers/tasks/kpi_calculation.py`
4. Dodaj threshold u `backend/app/modules/scoring/thresholds.py` (ako ulazi u scoring)
5. Generiši novu migraciju: `make shell-api` → `alembic revision --autogenerate -m "add nova_metrika"`
6. Pokreni migraciju: `make migrate`

### Kreiranje Alembic migracije

```bash
make shell-api
# Unutar kontejnera:
alembic revision --autogenerate -m "opis_promjene"
exit
make migrate
```

### Pokretanje testova (backend)

```bash
make shell-api
pytest tests/ -v
# Za specifičan modul:
pytest tests/test_kpi/ -v
```

### Inspekcija Celery taskova

- Web UI: http://localhost:5555 (Flower)
- CLI: `make shell-api` → `celery -A app.workers.celery_app inspect active`

---

## Frontend development

### Struktura komponenti

```
src/components/
├── ui/           # Bazne komponente (Button, Card, Badge, Input, Spinner)
├── charts/       # Recharts vizualizacije
│   ├── ScoreGauge.tsx        # SVG gauge
│   ├── CategoryScoreBar.tsx  # Horizontalni bar chart
│   ├── ScoreRadar.tsx        # Radar chart
│   └── KPITrendChart.tsx     # Multi-line trend
└── layout/
    └── Sidebar.tsx            # Navigacijski sidebar
```

### Dodavanje nove stranice

```bash
# Primjer: nova stranica /companies/{id}/benchmarks
# 1. Kreiraj fajl:
touch frontend/src/app/\(dashboard\)/companies/\[id\]/benchmarks/page.tsx

# 2. Dodaj 'use client' ako koristiš hooks/state
# 3. Dodaj link u Sidebar.tsx ili navigaciju

# Hot-reload automatski prikazuje promjene
```

### Dodavanje novog API call-a

U `frontend/src/lib/api.ts`:

```typescript
export const benchmarks = {
  get: (companyId: string, year: number) =>
    req<BenchmarkResponse>(`/companies/${companyId}/benchmarks/${year}`),
  compare: (companyId: string, year: number, industryCode: string) =>
    req<ComparisonResponse>(`/companies/${companyId}/benchmarks/${year}/compare`, {
      method: 'POST',
      body: JSON.stringify({ industry_code: industryCode }),
    }),
}
```

### Dodavanje novih tipova

U `frontend/src/types/index.ts`:

```typescript
export interface BenchmarkResponse {
  company_id: string
  fiscal_year: number
  industry: string
  percentile_rank: number
  metrics: Record<string, { company: number | null; industry_avg: number | null; percentile: number }>
}
```

### TailwindCSS konvencije

- Koristiti `shadow-card`, `shadow-card-md`, `shadow-card-lg` (definirani u `tailwind.config.ts`)
- Sidebar boje: `text-sidebar-text`, `bg-sidebar-hover`, `bg-sidebar-active`
- Risk boje: `text-risk-excellent`, `text-risk-critical` itd.
- Animacije: `animate-fade-in-up`, `animate-slide-right`, stagger s `.delay-{75..500}`
- Gradijenti: inline `style={{ background: 'linear-gradient(...)' }}` za dinamičke boje

---

## Coding standardi

### Backend (Python)

- **Type hints** na svim funkcijama
- **async/await** za sve DB i HTTP operacije
- **Pydantic v2** za request/response validaciju
- **Dependency Injection** za DB sesije i auth
- Sve DB upite filtrirati po `org_id` (multi-tenant sigurnost)
- Greške vraćati kao `HTTPException(status_code=..., detail="...")`

```python
# Dobro:
async def get_company(
    company_id: UUID,
    db: AsyncSession,
    org_id: UUID,
) -> Company:
    result = await db.execute(
        select(Company).where(
            Company.id == company_id,
            Company.org_id == org_id,  # ← UVIJEK filtriraj po org_id
        )
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company
```

### Frontend (TypeScript)

- **Strict TypeScript** — nema `any`
- **`'use client'`** samo gdje je neophodan (interaktivnost/hooks)
- **Rules of Hooks** — svi hooks moraju biti PRIJE conditional return-a
- API pozivi u `useEffect` ili TanStack Query (ne direktno u render)
- Sve boje iz TailwindCSS tokena ili `RISK_COLORS` iz `lib/utils.ts`

```typescript
// Dobro: svi hooks na vrhu, prije early return
export default function MyPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const count = useCountUp(data?.value ?? 0)  // ← hook mora biti ovdje

  if (loading) return <PageSpinner />  // ← early return tek nakon SVIH hooks
  // ...
}
```

---

## Environment varijable — referenca

| Varijabla | Obavezna | Default | Opis |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL async connection string |
| `REDIS_URL` | ✅ | — | Redis connection string |
| `SECRET_KEY` | ✅ | — | JWT signing key (min 32 chars) |
| `JWT_ALGORITHM` | — | `HS256` | JWT algoritam |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | `60` | Access token trajanje |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | `30` | Refresh token trajanje |
| `LLM_PROVIDER` | ✅ | `openai` | `openai`, `anthropic`, `local` |
| `LLM_MODEL` | ✅ | `gpt-4o` | Model naziv |
| `OPENAI_API_KEY` | ⚠️ | — | Obavezan ako `LLM_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | ⚠️ | — | Obavezan ako `LLM_PROVIDER=anthropic` |
| `UPLOAD_DIR` | — | `/app/uploads` | Direktorij za PDF fajlove |
| `MAX_FILE_SIZE_MB` | — | `50` | Max veličina PDF-a |
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:8000` | API URL za browser |
| `ENABLE_FORECASTING` | — | `false` | ML forecasting feature flag |
| `ENABLE_BENCHMARKS` | — | `false` | Industry benchmarks feature flag |

---

## Česti problemi

### Worker ne preuzima promjene koda

```bash
docker compose restart worker
# Worker forkuje procese pri startu — bytecode se cacheuje
# Svaka promjena modula zahtijeva restart worker-a
```

### Frontend ne vidi promjene

```bash
docker logs fin_frontend --tail 5
# Ako nema "✓ Compiled" — provjeri je li WATCHPACK_POLLING=true
# Možeš i ručno triggerisati: touch frontend/src/app/page.tsx
```

### DB migracija pada

```bash
make shell-api
alembic history        # Provjeri historiju
alembic current        # Trenutna verzija
alembic downgrade -1   # Vrati jednu verziju nazad
```

### API vraća 401 Unauthorized

- Provjeri je li access token još validan (60min)
- Frontend automatski refresh-a token — provjeri `src/store/auth.ts`
- Ako i dalje pada: `localStorage.removeItem('access_token')` i ponovo se prijavi

### Camelot ne može parsirati PDF

Camelot zahtijeva `ghostscript` i `opencv`:
```bash
make shell-api
apt-get install -y ghostscript  # ako nedostaje
# Za scanirane PDF-ove:
# Provjeri ENABLE_OCR=true u .env i tesseract instaliran
```
