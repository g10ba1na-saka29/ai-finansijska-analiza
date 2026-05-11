# Vizija projekta

> *"Svaki finansijski izvještaj krije priču — naš posao je da je ispričamo jasno, brzo i tačno."*

---

## Misija

**Bilansia** nastala je iz jednog jednostavnog uvida: mali i srednji privrednici na prostoru Bosne i Hercegovine, Srbije i Hrvatske godišnje predaju stotine stranica finansijskih izvještaja — a gotovo nitko ne dobije pravu sliku šta te brojke zapravo znače.

Naša misija je da automatizujemo cijeli lanac vrijednosti finansijske analize:

```
PDF izvještaj  →  Strukturirani podaci  →  KPI metrike  →  Risk score  →  AI narativ  →  Odluka
```

i tako znanje koje je nekad zahtijevalo seniora finansijskog analitičara dostupnim učinimo u sekundi, za svakoga.

---

## Ciljni korisnici

| Segment | Problem koji rješavamo |
|---|---|
| **Finansijski analitičari** | Sate ručnog unosa i kalkulacije svodimo na sekunde |
| **Računovođe i revizori** | Automatski red flags i anomalije koji se inače propuste |
| **Banke i leasing kuće** | Brza kreditna analiza i scoring pri aplikaciji za kredit |
| **Private equity i investitori** | Due diligence u minutama umjesto sedmica |
| **Upravljački timovi** | Razumljivi izvještaji bez finansijskog žargona |
| **Državne agencije (APF, FIA)** | Masovna analiza portfolija kompanija |

---

## Tržišni kontekst

### Zašto BiH/RS/HR?

Prostor jugoistočne Evrope ima specifičnosti koje globalna rješenja (Refinitiv, Bloomberg) ne adresiraju:

- **Lokalni računovodstveni standardi** — MSFI adaptacije, lokalni MRS, specifični APIF/FIA/FINA formati
- **Jezička barijera** — dokumenti na bosanskom, srpskom, hrvatskom jeziku
- **Regulatorna heterogenost** — tri različita poreska i računovodstvena sistema
- **Nepokrivenost alatkama** — dominacija Excela i ručnog rada

Ovo je ujedno i naša zaštitna barijera: lokalna ekspertiza u kombinaciji s AI-om.

### Tržišna veličina (procjena)

- ~130.000 aktivnih pravnih lica u BiH
- ~350.000 u Srbiji
- ~200.000 u Hrvatskoj

Godišnje svi predaju finansijske izvještaje. Samo 5% tržišnog udjela = 34.000 korisnika.

---

## Roadmap

### ✅ Faza 1 — Osnovna platforma (ZAVRŠENA)

Stabilna osnova za produkcijsku upotrebu.

- ✅ **PDF Ekstrakcija** — Camelot + pdfplumber + Pytesseract OCR
- ✅ **KPI kalkulator** — 25+ metrika u 6 kategorija
- ✅ **Risk Scoring** — Composite score (0–100) + Altman Z-Score
- ✅ **AI Izvještaji** — GPT-4o / Claude / Ollama narativni izvještaji
- ✅ **Q&A Chat** — pitanja o finansijskim podacima
- ✅ **Multi-tenant** — izolacija po organizacijama, role-based pristup
- ✅ **PDF Export** — preuzimanje AI izvještaja kao PDF

---

### ✅ Faza 2 — Proširene analitike (ZAVRŠENA)

Dublja analitička vrijednost za korisnike.

- ✅ **Industry Benchmarks** — poređenje 14 KPI metrika s prosjekom industrije (p25/p50/p75 percentili, bodovi snaga/slabosti)
- ✅ **Višegodišnji trend** — praćenje KPI metrika kroz godine, YoY analiza
- ✅ **Višegodišnji score historija** — praćenje risk profile-a kroz vrijeme

---

### ✅ Faza 3 — ML Forecasting + Integracije (ZAVRŠENA)

Prediktivna analitika i automatizacija.

- ✅ **ML Forecasting** — OLS linearna regresija (NumPy lstsq) s 95% intervalom povjerenja; prognoza prihoda, EBITDA i neto dobiti za 1–3 godine; CAGR + R² metrike; vizualizacija CI band-a u Recharts
- ✅ **Redis Caching** — cache-aside pattern za sve analitičke endpoint-e (TTL 1–2h), automatska invalidacija pri novim izračunima
- ✅ **Webhook sistem** — HMAC-SHA256 potpisane notifikacije za `kpi.calculated`, `report.processed`, `ai_report.generated`; auto-deactivation pri 10+ grešaka
- ✅ **Monitoring** — Sentry (FastAPI + Celery + SQLAlchemy), JSON structured logging, rate limiting (slowapi: 120/min globalno, 20/min upload), RequestLoggingMiddleware s X-Request-ID headerom

---

### Faza 4 — Skaliranje i ekosistem (Q3–Q4 2026)

Platforma postaje jezgro finansijskog ekosistema.

#### API integracije s javnim registrima

| Integracija | Vrijednost |
|---|---|
| **APIF web servis** | Automatski pull zvaničnih izvještaja bez PDF upload-a |
| **FIA (Srbija)** | Direktna integracija s bazom FIA |
| **FINA (Hrvatska)** | Pull javnih finansijskih podataka |
| **ERP sistemi** (SAP, Pantheon) | Real-time feed umjesto godišnjeg izvještaja |

#### Parser robustnost

- Poboljšanje prepoznavanja tabela za nestandardne PDF formate (skenirani dokumenti, stari APIF export)
- Automatska validacija podataka (aktiva = pasiva, cash flow konzistentnost)
- Manuelna korekcija raw_data JSON-a putem UI

#### Monitoring i alerting

- Konfigurisanje thresholdova po kompaniji ("obavijesti me kad D/E pređe 2.5")
- Email / Slack notifikacije
- Scheduled izvještaji (monthly digest za portfolio menadžere)

---

### Faza 5 — White-Label i Embedded (2027)

Platforma postaje infrastruktura za treće strane.

#### White-Label rješenje

Banke i revizorske kuće mogu deployati platformu pod vlastitim brendom:

```
Raiffeisen Banka  →  "Raiffeisen Financial Intelligence"
Deloitte BiH      →  "Deloitte Analytics Portal"
```

Konfigurabilno: logo, boje, vlastiti LLM prompt persona, custom scoring thresholds po industriji.

#### Embedded Analytics

JavaScript widget koji se embeduje u druge aplikacije:

```html
<FinAnalyticsWidget
  company_id="..."
  api_key="..."
  theme="dark"
  metrics={["score", "altman", "trend"]}
/>
```

#### Mobile aplikacija

- Native iOS/Android app za pregledanje izvještaja
- Push notifikacije za alert sistem
- Offline mode za sačuvane izvještaje

---

## Poslovni model

### SaaS pretplatni model

| Plan | Cijena/mj | Korisnici | Kompanije | AI izvještaji |
|---|---|---|---|---|
| **Free** | 0 € | 1 | 3 | 2/mj |
| **Starter** | 49 € | 3 | 25 | 20/mj |
| **Pro** | 149 € | 10 | 100 | neograničeno |
| **Enterprise** | po dogovoru | neograničeno | neograničeno | neograničeno + white-label |

### Dodatne usluge

- **API access** — per-call naplate za integracije
- **Custom model training** — kalibracija scoring modela za specifičnu instituciju
- **Professional services** — onboarding i implementacija za enterprise klijente
- **Data marketplace** — anonimizirana industry benchmark data za istraživačke institucije

---

## Tehnološka vizija

### Od rule-based ka ML-based scoring

Trenutni scoring sistem je baziran na ekspertski definisanim thresholdovima:

```python
# Danas (v1):
if current_ratio > 2.0:  score = 100
elif current_ratio > 1.5: score = 80
...
```

Buduća verzija (v2) će koristiti ML model treniran na historijskim ishodima:

```python
# Budućnost (v2):
score = xgb_model.predict(kpi_features)  # kontinuirana kalibracija
```

Forecasting modul (već implementiran) koristi OLS regresiju kao proof-of-concept. Sljedeći korak je proširenje na XGBoost/LightGBM s makroekonomskim featurama.

### Multimodalni input

Pored PDF-a, platforma će podržavati:
- **Excel/CSV upload** — direktan import strukturiranih podataka
- **Foto/scan** — mobilna kamera → OCR → analiza
- **API pull** — automatski refresh iz računovodstvenih sistema

### Lokalni LLM

Za klijente s visokim zahtjevima privatnosti (banke, državne institucije):
- Deployment on-premises lokalnih modela (LLaMA, Mistral fine-tuned)
- Fine-tuning na domenski specijaliziranim finansijskim podacima za BiH/RS/HR

---

## Principi razvoja

### 1. Lokalna relevantnost iznad globalnih generalizacija
Svaka feature mora imati smisla u kontekstu BiH/RS/HR tržišta. Scoring thresholdovi, benchmark podaci i AI prompts moraju biti kalibrisani na lokalnim podacima.

### 2. Transparentnost u AI odlukama
Svaki score, svaka AI preporuka mora biti objašnjiva. Korisnik uvijek može vidjeti "zašto" — koji KPI vukao score gore ili dolje.

### 3. Privacy by design
Finansijski podaci su visoko osjetljivi. Multi-tenant izolacija nije kompromis — to je osnova arhitekture. GDPR/ZZOP usklađenost od prvog dana.

### 4. Postupno uvođenje AI-a
AI ne donosi odluke — pomaže ljudima da ih donesu bolje. Uvijek human-in-the-loop za kritične finansijske ocjene.

### 5. Open za integracije, zatvoreni za podatke
API-first arhitektura omogućava ekosistem, ali podaci klijenata su strogo izolirani i nikad ne izlaze iz njihove organizacije bez eksplicitne dozvole.

---

## Metrike uspjeha

| Metrika | Cilj (kraj 2025) | Cilj (kraj 2026) |
|---|---|---|
| Registrirane organizacije | 50 | 500 |
| Analizirane kompanije | 500 | 10.000 |
| Uploaded izvještaji/mj | 200 | 5.000 |
| Parse uspješnost | > 90% | > 95% |
| Korisničko zadovoljstvo (NPS) | > 40 | > 60 |
| MRR | 2.000 € | 30.000 € |

---

## Inspiracija i pozicioniranje

Globalni igrači u sličnom prostoru:
- **Visible.vc** — investor reporting (ne fokus na BiH/RS/HR, ne PDF parser)
- **Finbox** — finansijska analiza (samo US/EU javne kompanije)
- **Dun & Bradstreet** — kreditni scoring (skupo, nije za SME)
- **Kompletno manuelni Excel modeli** — dominantno rješenje u regiji

Naša razlika:
- Jedini koji razumiju lokalne formate (APIF/FIA/FINA)
- Jedini koji kombinuju PDF ekstrakciju + KPI + AI narativ + benchmarks + prognoze u jednom toku
- Cjenovno dostupno za SME segment
- AI na lokalnom jeziku

---

*Dokument ažuriran: Maj 2026.*  
*Sljedeći review: Q3 2026.*
