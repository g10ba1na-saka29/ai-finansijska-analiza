# API Referenca

**Base URL:** `http://localhost:8000/api/v1`  
**Auth:** Bearer JWT token u `Authorization` headeru  
**Format:** JSON request i response (osim file upload)

> Interaktivna Swagger dokumentacija dostupna na: http://localhost:8000/docs

---

## Autentifikacija

### `POST /auth/register`
Registracija novog korisnika (kreira i organizaciju).

**Request:**
```json
{
  "email": "korisnik@email.com",
  "password": "mojalozinka123",
  "org_name": "Moja Firma d.o.o."
}
```

**Response `201`:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

---

### `POST /auth/login`
Prijava i dobijanje tokena.

**Request:** `application/x-www-form-urlencoded`
```
username=korisnik@email.com&password=mojalozinka123
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

---

### `GET /auth/me`
Podaci o trenutnom korisniku.

**Response `200`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "korisnik@email.com",
  "role": "analyst",
  "org_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

---

### `POST /auth/refresh`
Obnavljanje access tokena korištenjem refresh tokena.

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

> Refresh token se rotira pri svakom pozivu (one-time use). Stari token postaje nevalidan.

---

### `DELETE /auth/logout`
Odjava — invalidacija refresh tokena na serveru.

**Headers:** `Authorization: Bearer <access_token>`

**Response `204`:** (no content)

---

## Kompanije

### `GET /companies`
Lista kompanija organizacije (paginirano).

**Query params:**
- `skip` (int, default 0)
- `limit` (int, default 20, max 100)

**Response `200`:**
```json
{
  "items": [
    {
      "id": "...",
      "name": "Kompanija ABC d.o.o.",
      "tax_id": "4200000000003",
      "industry": "manufacturing",
      "country": "BA",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

### `POST /companies`
Kreiranje nove kompanije.

**Request:**
```json
{
  "name": "Nova Kompanija d.o.o.",
  "tax_id": "4200000000003",
  "industry": "manufacturing",
  "country": "BA"
}
```

**Industry vrijednosti:** `manufacturing`, `retail`, `services`, `construction`, `agriculture`, `technology`, `finance`, `healthcare`, `energy`, `other`

**Response `201`:**
```json
{
  "id": "550e8400-...",
  "name": "Nova Kompanija d.o.o.",
  "industry": "manufacturing",
  "country": "BA"
}
```

---

### `GET /companies/{id}`
Detalji jedne kompanije.

### `PUT /companies/{id}`
Ažuriranje kompanije (parcijalno).

### `DELETE /companies/{id}`
Brisanje kompanije i svih povezanih podataka.

---

### `GET /companies/{id}/summary`
Brzi pregled kompanije — zadnji score, risk level i osnovni KPI.

**Response `200`:**
```json
{
  "id": "...",
  "name": "Kompanija ABC d.o.o.",
  "industry": "manufacturing",
  "country": "BA",
  "latest_fiscal_year": 2024,
  "total_score": 71.4,
  "risk_level": "good",
  "reports_count": 3,
  "last_updated": "2024-03-15T09:31:15Z"
}
```

> Vraća `null` za score polja ako kompanija još nema obrađenih izvještaja.

---

## Finansijski izvještaji

### `POST /companies/{id}/reports`
Upload PDF finansijskog izvještaja.

> ⚠️ **Rate limit:** 20 zahtjeva/minuti po IP.

**Content-Type:** `multipart/form-data`

**Form fields:**
| Polje | Tip | Obavezno | Opis |
|---|---|---|---|
| `file` | File | ✅ | PDF fajl (max 50 MB) |
| `fiscal_year` | int | ✅ | Fiskalna godina (npr. 2024) |
| `report_type` | str | ✅ | Tip izvještaja |

**Tipovi izvještaja:** `balance_sheet`, `income`, `cash_flow`, `tax`, `audit`

**Response `201`:**
```json
{
  "id": "...",
  "company_id": "...",
  "fiscal_year": 2024,
  "report_type": "balance_sheet",
  "status": "pending",
  "uploaded_at": "2024-03-15T09:30:00Z"
}
```

> Obrada je asinhrona — pratite status putem `GET /reports/{report_id}`

---

### `GET /companies/{id}/reports`
Lista svih izvještaja za kompaniju.

**Query params:** `skip` (int, default 0), `limit` (int, default 50)

**Response `200`:**
```json
{
  "items": [
    {
      "id": "...",
      "fiscal_year": 2024,
      "report_type": "balance_sheet",
      "status": "done",
      "uploaded_at": "2024-03-15T09:30:00Z",
      "processed_at": "2024-03-15T09:31:15Z"
    }
  ],
  "total": 3
}
```

**Status vrijednosti:** `pending` → `processing` → `done` | `error`

---

### `GET /reports/{report_id}`
Detalji jednog izvještaja.

### `POST /reports/{report_id}/reparse`
Ponovi parsiranje (bez ponovnog uploada) — koristi originalni PDF fajl.

**Response `200`:** Ažurirani report objekat sa `status: "pending"`.

### `DELETE /reports/{report_id}`
Brisanje izvještaja i PDF fajla.

**Response `204`:** (no content)

---

## KPI Podaci

> Svi KPI endpoint-i koriste Redis cache (TTL 3600s). Cache se invalidira pri svakom novom KPI izračunu.

### `GET /companies/{id}/kpi/{fiscal_year}`
Sve KPI metrike za godinu.

**Response `200`:**
```json
{
  "company_id": "...",
  "fiscal_year": 2024,
  "liquidity": {
    "current_ratio": 1.85,
    "quick_ratio": 1.23,
    "cash_ratio": 0.45
  },
  "profitability": {
    "gross_margin": 0.38,
    "ebitda_margin": 0.22,
    "ebit_margin": 0.18,
    "net_margin": 0.14,
    "roe": 0.21,
    "roa": 0.09
  },
  "leverage": {
    "debt_to_equity": 1.45,
    "interest_coverage": 4.8,
    "debt_ratio": 0.59,
    "equity_ratio": 0.41
  },
  "growth": {
    "revenue_growth": 0.12,
    "ebitda_growth": 0.08,
    "net_income_growth": 0.15,
    "asset_growth": 0.06
  },
  "cashflow": {
    "free_cash_flow": 1250000.0,
    "ocf_margin": 0.19,
    "cash_to_debt": 0.22,
    "ocf_to_current_liabilities": 0.38
  },
  "efficiency": {
    "asset_turnover": 0.92,
    "receivables_turnover": 8.4,
    "days_sales_outstanding": 43.5,
    "inventory_turnover": 5.2,
    "days_inventory_outstanding": 70.2
  },
  "calculated_at": "2024-03-15T09:31:15Z"
}
```

> Sva polja mogu biti `null` ako nije bilo dovoljno podataka.

---

### `GET /companies/{id}/kpi/trend`
Historijski trend KPI metrika (sve dostupne godine).

**Response `200`:**
```json
{
  "company_id": "...",
  "points": [
    {
      "fiscal_year": 2022,
      "ebitda_margin": 0.18,
      "net_margin": 0.11,
      "current_ratio": 1.65,
      "debt_to_equity": 1.82,
      "revenue_growth": null,
      "total_score": 62.4
    },
    {
      "fiscal_year": 2023,
      "ebitda_margin": 0.20,
      "net_margin": 0.12,
      "current_ratio": 1.72,
      "debt_to_equity": 1.68,
      "revenue_growth": 0.08,
      "total_score": 65.8
    }
  ]
}
```

---

## Scoring

### `GET /companies/{id}/score/{fiscal_year}`
Detaljni composite score.

**Response `200`:**
```json
{
  "company_id": "...",
  "fiscal_year": 2024,
  "total_score": 71.4,
  "risk_level": "good",
  "liquidity_score": 68.2,
  "profitability_score": 74.5,
  "leverage_score": 69.1,
  "growth_score": 72.8,
  "cashflow_score": 73.3,
  "altman": {
    "z_score": 2.94,
    "zone": "safe",
    "components": {
      "x1": 0.241,
      "x2": 0.183,
      "x3": 0.097,
      "x4": 0.692,
      "x5": 0.921
    },
    "interpretation": "Kompanija je u sigurnoj zoni. Rizik bankrota je nizak."
  },
  "breakdown": {
    "liquidity": {
      "current_ratio": 62.4,
      "quick_ratio": 71.8,
      "cash_ratio": 45.0
    }
  },
  "score_version": "v1",
  "calculated_at": "2024-03-15T09:31:15Z"
}
```

**Risk nivoi:** `excellent` (≥80), `good` (60–79), `warning` (40–59), `high_risk` (20–39), `critical` (<20)

---

### `GET /companies/{id}/score/history`
Historija scoreva za sve godine (rastući redoslijed).

**Response `200`:**
```json
{
  "company_id": "...",
  "history": [
    {
      "fiscal_year": 2022,
      "total_score": 58.3,
      "risk_level": "warning",
      "liquidity_score": 52.1,
      "profitability_score": 61.4,
      "leverage_score": 55.8,
      "growth_score": null,
      "cashflow_score": 64.2
    }
  ]
}
```

---

### `POST /companies/{id}/calculate/{fiscal_year}`
Ručno pokretanje KPI + score kalkulacije (triggeruje Celery task).

**Response `202`:**
```json
{
  "task_id": "cel-task-xyz789",
  "status": "pending"
}
```

---

## Industry Benchmarks

> Feature flag: `ENABLE_BENCHMARKS=true` (default: uključeno).

### `GET /industries`
Lista svih podržanih industrija.

**Response `200`:**
```json
{
  "industries": [
    "manufacturing", "retail", "services", "construction",
    "agriculture", "technology", "finance", "healthcare",
    "energy", "other"
  ]
}
```

---

### `GET /companies/{id}/benchmarks/{fiscal_year}`
Poređenje KPI metrika kompanije sa industrijskim prosjekom za zadatu godinu.

**Response `200`:**
```json
{
  "company_id": "...",
  "fiscal_year": 2024,
  "industry": "manufacturing",
  "metrics": [
    {
      "metric": "ebitda_margin",
      "label": "EBITDA Margin",
      "company_value": 0.22,
      "industry_p25": 0.09,
      "industry_median": 0.14,
      "industry_p75": 0.20,
      "percentile": 78,
      "higher_is_better": true,
      "assessment": "strong",
      "assessment_label": "Odlično"
    },
    {
      "metric": "debt_to_equity",
      "label": "Dug/Kapital",
      "company_value": 1.45,
      "industry_p25": 0.80,
      "industry_median": 1.10,
      "industry_p75": 1.70,
      "percentile": 42,
      "higher_is_better": false,
      "assessment": "avg",
      "assessment_label": "Prosjek"
    }
  ],
  "overall_percentile": 73,
  "strengths": ["EBITDA Margin", "Current Ratio"],
  "weaknesses": ["Dug/Kapital"]
}
```

**Ocjene (assessment):** `strong` (≥75. pct), `above_avg` (60–74), `avg` (40–59), `below_avg` (25–39), `weak` (<25), `neutral` (nema podataka)

**Uključene metrike:** ebitda_margin, net_margin, roe, roa, current_ratio, quick_ratio, debt_to_equity, debt_ratio, interest_coverage, revenue_growth, asset_growth, ocf_margin, asset_turnover, free_cash_flow

---

## Forecasting

> Feature flag: `ENABLE_FORECASTING=true` (default: uključeno).
>
> Metoda: OLS linearna regresija (NumPy lstsq). Zahtijeva minimum 2 historijska KPI snapshot-a.

### `GET /companies/{id}/forecast`
Preuzimanje pohranjene prognoze za kompaniju.

**Response `200`:**
```json
{
  "company_id": "...",
  "base_year": 2024,
  "horizon": 3,
  "method": "ols_linear",
  "data_points": 4,
  "predictions": [
    {
      "year": 2025,
      "revenue": 9280000,
      "revenue_low": 8100000,
      "revenue_high": 10460000,
      "ebitda": 2041600,
      "ebitda_low": 1782000,
      "ebitda_high": 2301200,
      "net_income": 1299200,
      "net_income_low": 1134400,
      "net_income_high": 1464000,
      "ebitda_margin": 0.22,
      "net_margin": 0.14
    }
  ],
  "historical": [
    {
      "year": 2021,
      "revenue": 7200000,
      "ebitda": 1440000,
      "net_income": 864000,
      "total_assets": 4800000
    }
  ],
  "revenue_r_squared": 0.984,
  "revenue_cagr": 0.089,
  "generated_at": "2025-05-11T10:00:00Z"
}
```

> Vraća `404` ako prognoza još nije generisana. Koristite `POST .../generate` za pokretanje.

---

### `POST /companies/{id}/forecast/generate`
Pokretanje (ili ponovnog pokretanja) generisanja prognoze u pozadini.

**Request:**
```json
{
  "horizon": 3
}
```

**horizon:** 1, 2 ili 3 (default: 3)

**Response `202`:**
```json
{
  "status": "queued",
  "message": "Forecast generation started"
}
```

> Nakon ~2–5 sekundi prognoza je dostupna putem `GET /companies/{id}/forecast`.

---

## AI Izvještaji

### `POST /companies/{id}/ai-report/{fiscal_year}`
Pokretanje generisanja AI izvještaja (asinhrono).

**Response `202`:**
```json
{
  "report_id": "...",
  "task_id": "cel-task-...",
  "status": "generating"
}
```

---

### `GET /companies/{id}/ai-report/{fiscal_year}`
Preuzimanje generisanog AI izvještaja.

**Response `200` (kada je `status: done`):**
```json
{
  "id": "...",
  "company_id": "...",
  "fiscal_year": 2024,
  "status": "done",
  "summary": "Kompanija ABC d.o.o. pokazuje solidne finansijske rezultate...",
  "score_explanation": "Ukupni score od 71.4 reflektuje...",
  "risk_assessment": "Glavni rizici uključuju...",
  "outlook": "Kratkoročno se očekuje...",
  "strengths": [
    "Stabilan rast prihoda od 12% YoY",
    "Zdravi pokazatelji likvidnosti"
  ],
  "weaknesses": [
    "Visok D/E ratio u odnosu na prosjek industrije",
    "Pad marže bruto profita"
  ],
  "key_risks": ["Izloženost promjenama kamatnih stopa", "..."],
  "recommendations": ["Razmatranje refinansiranja kratkoročnog duga", "..."],
  "red_flags": [],
  "model_used": "gpt-4o",
  "generated_at": "2024-03-15T10:05:22Z"
}
```

**Status vrijednosti:** `pending` → `generating` → `done` | `error`

---

### `GET /companies/{id}/ai-report/{fiscal_year}/pdf`
Preuzimanje AI izvještaja kao PDF fajla.

**Response:** `application/pdf` binary stream

---

### `POST /companies/{id}/qa/{fiscal_year}`
Real-time Q&A o finansijskim podacima.

**Request:**
```json
{
  "question": "Koji je najveći rizik za ovu kompaniju?",
  "history": [
    {"role": "user", "content": "Kako izgleda likvidnost?"},
    {"role": "assistant", "content": "Current ratio od 1.85 je iznad prosjeka..."}
  ]
}
```

**Response `200`:**
```json
{
  "answer": "Najznačajniji rizik je visoki nivo zaduženosti (D/E 1.45)...",
  "model_used": "gpt-4o"
}
```

---

## Webhooks

Webhook sistem šalje HTTP POST na vašu URL adresu svaki put kad se dogodi odabrani event u organizaciji. Svaki zahtjev je potpisan HMAC-SHA256.

**Podržani eventi:**
| Event | Okidač |
|---|---|
| `kpi.calculated` | KPI + score kalkulacija završena za kompaniju |
| `report.processed` | PDF parsiranje završeno (uspješno ili s greškom) |
| `ai_report.generated` | AI izvještaj generisan |

**Maksimum webhookova po organizaciji:** 20

---

### `POST /webhooks`
Registracija novog webhook endpointa.

**Request:**
```json
{
  "url": "https://vasa-app.com/webhook",
  "events": ["kpi.calculated", "report.processed"],
  "description": "Prodajni CRM integracija"
}
```

**Response `201`:**
```json
{
  "id": "...",
  "url": "https://vasa-app.com/webhook",
  "events": ["kpi.calculated", "report.processed"],
  "description": "Prodajni CRM integracija",
  "is_active": true,
  "secret": "wh_sec_abc123xyz...",
  "created_at": "2024-03-15T10:00:00Z"
}
```

> ⚠️ Polje `secret` se prikazuje **samo jednom** pri kreiranju. Sačuvajte ga odmah — u svim narednim odgovorima neće biti uključeno.

---

### `GET /webhooks`
Lista svih registrovanih webhookova za organizaciju (bez `secret` polja).

**Response `200`:**
```json
{
  "items": [
    {
      "id": "...",
      "url": "https://vasa-app.com/webhook",
      "events": ["kpi.calculated"],
      "description": "Prodajni CRM",
      "is_active": true,
      "failure_count": 0,
      "last_triggered_at": "2024-03-15T09:31:00Z",
      "created_at": "2024-03-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `GET /webhooks/{id}`
Detalji jednog webhoooka.

---

### `PATCH /webhooks/{id}`
Ažuriranje webhoooka (URL, eventi, opis, aktivan/neaktivan).

**Request:** (sva polja su opcionalna)
```json
{
  "url": "https://nova-adresa.com/hook",
  "events": ["kpi.calculated", "ai_report.generated"],
  "is_active": true,
  "description": "Ažurirani opis"
}
```

**Response `200`:** Ažurirani webhook objekat.

---

### `DELETE /webhooks/{id}`
Brisanje webhook registracije.

**Response `204`:** (no content)

---

### `POST /webhooks/{id}/test`
Slanje test payloada na webhook URL da biste provjerili konekciju.

**Response `200`:**
```json
{
  "success": true,
  "status_code": 200,
  "error": null
}
```

```json
{
  "success": false,
  "status_code": 503,
  "error": "Connection timeout"
}
```

---

### Verifikacija potpisa

Svaki webhook zahtjev sadrži header:
```
X-Bilansia-Signature: sha256=<hex_hmac_sha256>
X-Bilansia-Event: kpi.calculated
X-Bilansia-Delivery: <uuid>
```

Primjer verifikacije u Python-u:
```python
import hmac, hashlib

def verify_signature(payload_bytes: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header)
```

**Auto-deactivacija:** Webhook se automatski deaktivira ako ima 10 uzastopnih grešaka dostave (`is_active = false`, `failure_count >= 10`).

**Payload format:**
```json
{
  "event": "kpi.calculated",
  "webhook_id": "...",
  "org_id": "...",
  "company_id": "...",
  "data": {
    "company_name": "ABC d.o.o.",
    "fiscal_year": 2024,
    "total_score": 71.4,
    "risk_level": "good"
  },
  "timestamp": "2024-03-15T10:00:00Z"
}
```

---

## Greške

| HTTP status | Opis |
|---|---|
| `400 Bad Request` | Nevalidni podaci (validacijska greška, npr. nepoznat report_type) |
| `401 Unauthorized` | Neispravan ili istekao token |
| `403 Forbidden` | Nema prava pristupa resursu (resurs pripada drugoj organizaciji) |
| `404 Not Found` | Resurs ne postoji |
| `409 Conflict` | Resurs već postoji (npr. dupli score za godinu) |
| `413 Payload Too Large` | Veličina PDF-a premašuje 50 MB limit |
| `422 Unprocessable Entity` | FastAPI validacijska greška (pogrešan tip polja) |
| `429 Too Many Requests` | Rate limit prekoračen (120/min globalno, 20/min za upload) |
| `500 Internal Server Error` | Neočekivana greška servera |

**Format greške:**
```json
{
  "detail": "Company not found"
}
```

**Format 429 greške:**
```json
{
  "error": "Rate limit exceeded: 20 per 1 minute"
}
```

---

## Primjer: kompletan workflow

```bash
# 1. Login — sačuvaj i access i refresh token
RESP=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=test@email.com&password=lozinka")
TOKEN=$(echo $RESP | jq -r .access_token)
REFRESH=$(echo $RESP | jq -r .refresh_token)

# 1b. Refresh access tokena (kada istekne nakon 60 min)
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | jq -r .access_token)

# 2. Kreiraj kompaniju
CO_ID=$(curl -s -X POST http://localhost:8000/api/v1/companies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test d.o.o.","industry":"manufacturing","country":"BA"}' | jq -r .id)

# 3. Upload PDF
curl -X POST http://localhost:8000/api/v1/companies/$CO_ID/reports \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@bilans_2024.pdf" \
  -F "fiscal_year=2024" \
  -F "report_type=balance_sheet"

# 4. Provjeri score (nakon 30-60s)
curl -s http://localhost:8000/api/v1/companies/$CO_ID/score/2024 \
  -H "Authorization: Bearer $TOKEN" | jq '{score: .total_score, risk: .risk_level}'

# 5. Generiši AI izvještaj
curl -X POST http://localhost:8000/api/v1/companies/$CO_ID/ai-report/2024 \
  -H "Authorization: Bearer $TOKEN"

# 6. Pogledaj benchmarks
curl -s http://localhost:8000/api/v1/companies/$CO_ID/benchmarks/2024 \
  -H "Authorization: Bearer $TOKEN" | jq '{percentil: .overall_percentile, snage: .strengths}'

# 7. Generiši prognozu (3 godine)
curl -X POST http://localhost:8000/api/v1/companies/$CO_ID/forecast/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"horizon": 3}'

# 8. Preuzmi prognozu
curl -s http://localhost:8000/api/v1/companies/$CO_ID/forecast \
  -H "Authorization: Bearer $TOKEN" | jq '.predictions[0]'

# 9. Registruj webhook (sačuvaj secret!)
curl -X POST http://localhost:8000/api/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://moja-app.com/hook","events":["kpi.calculated"]}'

# 10. Odjava
curl -X DELETE http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```
