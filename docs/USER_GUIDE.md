# Bilansia — Vodič za korisnike

> AI platforma za finansijsku analizu kompanija

---

## 1. Registracija i prijava

### Registracija nove organizacije

1. Otvorite aplikaciju na `http://localhost:3000`
2. Kliknite **"Registruj se"**
3. Unesite e-mail, šifru i naziv vaše organizacije
4. Nakon registracije automatski dobijate **Admin** rolu

### Prijava

1. Unesite e-mail i šifru
2. Kliknite **"Prijavi se"**
3. Bićete preusmjereni na dashboard

### Odjava

Kliknite vaše ime u donjem lijevom uglu sidebara → **Odjava**

---

## 2. Dashboard

Pregled prikazuje:
- **Ukupan broj kompanija** u vašoj organizaciji
- **Distribuciju rizika** — koliko kompanija je u kojoj kategoriji (Excellent, Good, Warning, High Risk, Critical)
- **Top kompanije** po finansijskom scoreu
- **Najnovije aktivnosti** (uploadovani izvještaji, pokrenute analize)

---

## 3. Kompanije

### Dodavanje kompanije

1. Idite na **Kompanije** → **+ Nova kompanija**
2. Unesite naziv, PIB (opcionalno), industriju i državu
3. Kliknite **Sačuvaj**

### Pregled kompanije

Kliknite na naziv kompanije da vidite:
- **Ukupni finansijski score** (0–100) sa gauge grafom
- **Score po kategorijama**: Likvidnost, Profitabilnost, Zaduženost, Rast, Cash Flow
- **Radar pregled** — radar chart svih kategorija
- **KPI summary** — 4 ključna indikatora sa statusom
- **Trend marži** — EBITDA, neto i rast margin kroz godine

### Navigacioni gumbi (gornji desni ugao kompanije)

| Gumb | Funkcija |
|------|---------|
| ✏️ Uredi | Promijeni naziv, PIB, industriju, državu |
| Izvještaji | Upload i upravljanje finansijskim izvještajima |
| KPI detalji | Detaljni pregled svih 30+ KPI-ova |
| Benchmarks | Poređenje sa industrijskim prosjekom |
| 📈 Prognoza | ML prognoza prihoda, EBITDA i neto dobiti |
| 🔬 Analiza rizika | Anomaly detection i bankruptcy risk |
| ✨ AI Izvještaj | Generisanje AI analize sa Q&A chatom |

---

## 4. Finansijski izvještaji

### Upload izvještaja

1. Idite na **Izvještaji** za kompaniju
2. Prevucite PDF fajl ili kliknite za odabir
3. Odaberite **fiskalnu godinu** i **tip izvještaja**:
   - Bilans stanja
   - Račun dobitka i gubitka
   - Cash flow izvještaj
   - Porezni izvještaj
   - Revizorski izvještaj
4. Kliknite **Upload**

### Obrada izvještaja

Nakon uploada sistem automatski:
1. Parsira PDF i ekstrahuje finansijske podatke
2. Izračunava **30+ KPI-ova** (likvidnost, profitabilnost, zaduženost, rast, efikasnost)
3. Generira **finansijski score** (0–100) s Altman Z-Score
4. Čuva rezultate za historijsku analizu

**Statusi:**
- 🟡 **Na čekanju** — u redu za obradu
- 🔵 **Obrada** — Celery worker aktivno procesira
- ✅ **Završeno** — KPI-ovi i score dostupni
- ❌ **Greška** — pogledajte poruku greške, pokušajte **Reparse**

---

## 5. KPI detalji

Stranica prikazuje sve financijske indikatore grupisane po kategorijama:

| Kategorija | Ključni KPI-ovi |
|------------|----------------|
| **Likvidnost** | Current ratio, Quick ratio, Cash ratio |
| **Profitabilnost** | Gross margin, EBITDA margin, ROE, ROA |
| **Zaduženost** | Debt/Equity, Interest coverage, Debt ratio |
| **Rast** | Revenue growth, EBITDA growth, Asset growth |
| **Cash Flow** | Free cash flow, OCF margin, Cash-to-debt |
| **Efikasnost** | Asset turnover, DSO, Inventory turnover |

**Year selector** — odaberite fiskalnu godinu za prikaz.

Svaki KPI prikazuje:
- Trenutnu vrijednost
- Trend u odnosu na prethodnu godinu
- Boju (zelena = dobro, narandžasta = ispod cilja)

---

## 6. Benchmarks

Poređenje KPI-ova vaše kompanije sa industrijskim prosjekom:

- **Percentil** — gdje se kompanija nalazi u industriji (npr. 75. percentil = bolja od 75% kompanija)
- **P25 / Medijana / P75** — industrijski raspon
- **Snage i slabosti** — automatski generisana lista
- **Ukupni percentil** — prosječna pozicija u industriji

Dostupno za **10 industrija**: Banking, Manufacturing, Retail, Technology, Healthcare, Energy, Real Estate, Telecommunications, Transport, Food & Beverage.

---

## 7. ML Prognoza

### Generisanje prognoze

1. Idite na **📈 Prognoza** za kompaniju
2. Odaberite **horizont** (1, 2 ili 3 godine)
3. Kliknite **Generiši prognozu**

### Prikaz prognoze

- **Linijski grafovi** sa confidence intervalima (95% CI) za:
  - Prihode
  - EBITDA
  - Neto dobit
- **Historijski podaci** (pune linije) + **prognoza** (isprekidane linije)
- **CAGR** — godišnja stopa rasta prihoda
- **R²** — preciznost modela (0–1, veće = bolje)

> Prognoza koristi OLS linearnu regresiju. Za pouzdane rezultate potrebno je min. 2–3 historijska perioda.

---

## 8. Analiza rizika

### Anomaly detection

Sistem automatski detektuje neobične promjene u finansijskim podacima:

- **Kritično** — izuzetno alarmantne anomalije
- **Visoko** — značajne anomalije koje zahtijevaju pažnju
- **Srednje** — umjerene nepravilnosti
- **Nisko** — minor odstupanja

**Metode detekcije:**
- Apsolutni pragovi (npr. Current ratio < 0.5)
- YoY promjena (npr. >100% pad prihoda)
- IQR industrijsko poređenje
- Isolation Forest (ML, zahtijeva ≥5 peer kompanija)

### Bankruptcy risk

- **Piotroski F-Score** (0–9) — 9 binarnih signala o finansijskom zdravlju
  - 7–9: Jaka kompanija
  - 3–6: Neutralna
  - 0–2: Slaba kompanija
- **Altman Z''-Score** — zonama: Safe, Grey, Distress
- **Vjerovatnoća finansijskog sloma** (gauge, 0–100%)

---

## 9. AI Izvještaj

### Generisanje

1. Kliknite **✨ AI Izvještaj** za kompaniju
2. Odaberite fiskalnu godinu
3. Kliknite **Generiši AI izvještaj**
4. Sačekajte 15–30 sekundi

### Sadržaj izvještaja

| Sekcija | Opis |
|---------|------|
| **Sažetak** | Narativni pregled finansijskog stanja |
| **Procjena rizika** | Detaljna analiza rizikofaktora |
| **Snage** | Lista pozitivnih aspekata |
| **Slabosti** | Oblasti koje zahtijevaju pažnju |
| **Red flags** | Kritična upozorenja |
| **Preporuke** | Konkretne akcije za poboljšanje |
| **Outlook** | Kratkoročna prognoza i perspektiva |

### Q&A chat

Nakon generisanja izvještaja možete postavljati pitanja poput:
- *"Koji je glavni razlog pada profitabilnosti?"*
- *"Uporedi likvidnost sa industrijskim prosjekom"*
- *"Koje su opcije za smanjenje zaduženosti?"*

### PDF export

Kliknite **⬇ Preuzmi PDF** za download formatiranog izvještaja.

---

## 10. Organizacija

### Upravljanje članovima (samo Admin)

Idite na **Organizacija** u sidebaru:

**Dodavanje člana:**
1. Kliknite **Novi član**
2. Unesite e-mail, šifru i rolu
3. Kliknite **Dodaj člana**

**Promjena role:**
- Direktno iz tabele — dropdown selektor

**Deaktivacija:**
- Kliknite **Deaktiviraj** — korisnik ne može pristupiti, podaci ostaju

**Uklanjanje:**
- Kliknite ikonu za brisanje → **Potvrdi**
- Posljednji admin ne može biti uklonjen

### Dnevnik aktivnosti (samo Admin)

Tab **Dnevnik aktivnosti** prikazuje sve akcije u organizaciji:
- Prijave korisnika
- Kreirane i obrisane kompanije
- Promjene u timu

---

## 11. Postavke profila

Idite na **Postavke** u sidebaru:

- **Profilna slika** — uploadujte foto ili odaberite gradient boju
- **Ime i prezime** — prikazuje se u sidebaru
- **Promjena šifre** — unesite trenutnu i novu šifru

---

## 12. Česti problemi

| Problem | Rješenje |
|---------|---------|
| Izvještaj ne može biti parsiran | Provjerite da li je PDF čitljiv (ne skeniran). Probajte **Reparse** |
| Score nije dostupan | Uploadajte i sačekajte procesiranje izvještaja, zatim osvježite |
| Prognoza nije precizna | Potrebno min. 2-3 godine historije. Više podataka = bolja prognoza |
| AI izvještaj traje dugo | Normalno 15–30s. Ako traje duže od 2 min, osvježite stranicu |
| Anomaly detection nema ML rezultata | Isolation Forest zahtijeva min. 5 kompanija iste industrije u org-u |

---

## 13. Uloge i dozvole

| Akcija | Admin | Analitičar |
|--------|-------|-----------|
| Pregled kompanija | ✅ | ✅ |
| Upload izvještaja | ✅ | ✅ |
| Pokretanje analize | ✅ | ✅ |
| Kreiranje kompanije | ✅ | ✅ |
| Brisanje kompanije | ✅ | ❌ |
| Upravljanje članovima | ✅ | ❌ |
| Pregled audit loga | ✅ | ❌ |
| Generisanje AI izvještaja | ✅ | ✅ |

---

*Bilansia v1.0 — Maj 2026*
