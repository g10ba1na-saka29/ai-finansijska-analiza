"""
FinancialStatement dataclass + parser koji izvlači finansijske cifre iz
normalizovanog raw_data (output PDF parsera).

Podržava tri formata tabela:
  1. Flat format: {fs_field: value, ...}
  2. Label-value format: {"pozicija": "Ukupna imovina", "aop": "033", "neto_tekuća": 1000000}
  3. BiH collapsed multi-line: camelot kolapsira 8 kolona u 1 sa '\n' separatorima
     Vrijednost svakog reda: "Grupa|POZICIJA|AOP|[Nap]|Bruto|[Ispravka]|Neto|Prethodna"
"""

import logging
import re
from dataclasses import dataclass, fields
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class FinancialStatement:
    # ── Income Statement ───────────────────────────────────────────────────────
    revenue: float | None = None
    total_revenue: float | None = None
    gross_profit: float | None = None
    cogs: float | None = None
    ebitda: float | None = None
    ebit: float | None = None
    net_income: float | None = None
    interest_expense: float | None = None
    income_tax: float | None = None
    depreciation_amortization: float | None = None
    operating_expenses: float | None = None
    financial_income: float | None = None
    financial_expenses: float | None = None
    ebt: float | None = None

    # ── Balance Sheet — Assets ─────────────────────────────────────────────────
    total_assets: float | None = None
    non_current_assets: float | None = None
    property_plant_equipment: float | None = None
    intangible_assets: float | None = None
    long_term_investments: float | None = None
    current_assets: float | None = None
    inventories: float | None = None
    receivables: float | None = None
    cash: float | None = None

    # ── Balance Sheet — Liabilities & Equity ──────────────────────────────────
    equity: float | None = None
    share_capital: float | None = None
    retained_earnings: float | None = None
    total_liabilities: float | None = None
    long_term_liabilities: float | None = None
    long_term_debt: float | None = None
    current_liabilities: float | None = None
    short_term_debt: float | None = None
    accounts_payable: float | None = None

    # ── Cash Flow ─────────────────────────────────────────────────────────────
    operating_cf: float | None = None
    investing_cf: float | None = None
    financing_cf: float | None = None
    capex: float | None = None

    def effective_revenue(self) -> float | None:
        return self.revenue or self.total_revenue

    def total_debt(self) -> float | None:
        lt = self.long_term_debt or 0.0
        st = self.short_term_debt or 0.0
        if lt == 0.0 and st == 0.0:
            return None
        return lt + st

    def working_capital(self) -> float | None:
        if self.current_assets is not None and self.current_liabilities is not None:
            return self.current_assets - self.current_liabilities
        return None

    def to_dict(self) -> dict[str, float | None]:
        return {f.name: getattr(self, f.name) for f in fields(self)}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_amount(value: Any) -> float | None:
    """
    Parsira finansijski iznos iz stringa.

    Podržava formate:
    - BiH/DE sa više tačaka: 1.425.012.756 ili 1.283.134
    - BiH/DE sa zarezom:     1.234.567,89
    - EN format:             1,234,567.89
    - Čisti integer:         1425012756
    """
    if value is None:
        return None
    raw = str(value).strip()
    if raw in ("", "-", "/", "N/A", "n/a", "—"):
        return None

    negative = raw.startswith("(") or raw.startswith("-")
    cleaned = re.sub(r"[()%\s]", "", raw).lstrip("+-")

    if not cleaned:
        return None

    dot_pos   = cleaned.rfind(".")
    comma_pos = cleaned.rfind(",")

    if dot_pos > comma_pos and comma_pos != -1:
        # EN format: 1,234,567.89 — ukloni sve zareze
        cleaned = cleaned.replace(",", "")

    elif comma_pos > dot_pos and dot_pos != -1:
        # BiH/DE format: 1.234.567,89 — ukloni tačke, zamijeni zarez tačkom
        cleaned = cleaned.replace(".", "").replace(",", ".")

    elif comma_pos != -1 and dot_pos == -1:
        # Samo zarez — hiljada (3 iza zareza) ili decimal
        after_comma = len(cleaned) - comma_pos - 1
        if after_comma == 3:
            cleaned = cleaned.replace(",", "")
        else:
            cleaned = cleaned.replace(",", ".")

    elif dot_pos != -1 and comma_pos == -1:
        # Samo tačke — provjeri da li su sve na svakih 3 cifre (hiljadni separatori)
        # npr. 1.425.012.756 → sve tačke su separatori
        # npr. 1.283 → tačka na 3 od kraja → separator
        # npr. 12.5 → decimalni separator
        if re.match(r'^\d{1,3}(\.\d{3})+$', cleaned):
            # Svi razmaci po 3 cifre → hiljadni separatori
            cleaned = cleaned.replace(".", "")
        elif cleaned.count(".") == 1:
            after_dot = len(cleaned) - dot_pos - 1
            if after_dot == 3:
                # Jedina tačka na 3 od kraja → hiljadni separator
                cleaned = cleaned.replace(".", "")
            # inače: decimalni separator, ostavi

    try:
        result = float(cleaned)
        return -result if negative else result
    except ValueError:
        return None


def _is_formatted_amount(s: str) -> bool:
    """Provjeri da li string izgleda kao finansijski iznos s hiljadama separatorima."""
    s = s.strip()
    if len(s) < 3:
        return False
    if not ('.' in s or ',' in s):
        return False
    if re.search(r'[a-zA-Z]', s):
        return False
    v = _parse_amount(s)
    return v is not None and abs(v) >= 100


_FS_FIELDS = {f.name for f in fields(FinancialStatement)}

# Poznati nazivi kolona sa labelama (nakon normalize_key)
_LABEL_COLS = frozenset({
    "pozicija", "naziv", "naziv_pozicije", "opis", "opis_pozicije",
    "stavka", "position", "description", "item",
})

_AOP_COLS = frozenset({"aop", "rbr", "r_b", "aop_broj", "sifra"})

_VALUE_COL_PREFER = ("neto_tek", "tekuć", "tekuca", "neto", "iznos", "amount", "value", "vrijednost")
_VALUE_COL_AVOID  = ("prethod", "previous", "prior", "lanjsk", "bazn")

# Ključne riječi u header-u camelot tabele (za prepoznavanje formata)
_BILANS_HEADER_WORDS = frozenset({
    'pozicija', 'aop', 'nap', 'bruto', 'ispravka', 'neto', 'prethodna',
    'gruparanuna', 'gruparacuna', 'tekuna', 'tekuca', 'godina', 'vrijednosti',
})


# ── Format 2: Label-value tabela ───────────────────────────────────────────────

def _find_label_value_cols(sample_keys: list[str]) -> tuple[str | None, str | None, str | None]:
    label_col = aop_col = value_col = None

    for k in sample_keys:
        if label_col is None and k in _LABEL_COLS:
            label_col = k
        if aop_col is None and k in _AOP_COLS:
            aop_col = k

    if label_col is None:
        return None, None, None

    candidates = [k for k in sample_keys if k not in (label_col, aop_col) and k]
    for k in candidates:
        k_l = k.lower()
        if (any(p in k_l for p in _VALUE_COL_PREFER)
                and not any(a in k_l for a in _VALUE_COL_AVOID)):
            value_col = k
            break

    if value_col is None:
        for k in candidates:
            if not any(a in k.lower() for a in _VALUE_COL_AVOID):
                value_col = k
                break

    return label_col, aop_col, value_col


def _extract_label_value_table(table: dict, collected: dict) -> None:
    from app.modules.pdf_parser.normalizer import AOP_MAP, COLUMN_MAP, normalize_key

    rows_norm = table.get("rows_normalized", [])
    if not rows_norm:
        return

    sample_keys = [k for k in rows_norm[0].keys() if k]
    label_col, aop_col, value_col = _find_label_value_cols(sample_keys)

    if label_col is None or value_col is None:
        return

    col_map_norm: dict[str, str] = {
        re.sub(r"[^\w\s]", "", k.strip().lower()).replace(" ", "_"): v
        for k, v in COLUMN_MAP.items()
    }

    for row in rows_norm:
        label   = str(row.get(label_col, "")).strip()
        aop_raw = re.sub(r"\D", "", str(row.get(aop_col, ""))) if aop_col else ""
        val     = row.get(value_col)

        if not label and not aop_raw:
            continue

        fs_field: str | None = None
        if aop_raw:
            fs_field = AOP_MAP.get(aop_raw.zfill(3))

        if not fs_field and label:
            label_norm = normalize_key(label)
            if label_norm in _FS_FIELDS:
                fs_field = label_norm
            else:
                label_stripped = re.sub(r"[^\w\s]", "", label.strip().lower()).replace(" ", "_")
                fs_field = col_map_norm.get(label_stripped)

        if fs_field and fs_field in _FS_FIELDS and fs_field not in collected:
            parsed = _parse_amount(val)
            if parsed is not None:
                collected[fs_field] = parsed


# ── Format 3: BiH collapsed multi-line (camelot lattice na BiH bilans stanja) ──

def _is_bilans_header_line(line: str) -> bool:
    """Provjeri da li linija izgleda kao zaglavlje kolone bilansa stanja."""
    l = re.sub(r'[^\w]', '', line.lower().strip())
    return any(kw in l for kw in _BILANS_HEADER_WORDS)


def _parse_bih_cell_record(cell: str) -> tuple[str | None, float | None]:
    """
    Parsira jedan collapsed višelinijski red BiH bilansa stanja.
    Format vrijednosti: [Grupa|POZICIJA|AOP|[Nap]|Bruto|[Ispravka]|Neto|Prethodna]

    Vraća (aop_code_padded, neto_tekuca_value).

    Pravila za Neto tekuću poziciju:
    - 4 iznosa [Bruto, Ispravka, Neto, Preth]   → iznosi[2]
    - 3 iznosa [Bruto, Neto, Preth]              → iznosi[1]
    - 2 iznosa [Tekuća, Preth]                   → iznosi[0]
    - 1 iznos                                     → iznosi[0]
    """
    parts = [p.strip() for p in cell.split('\n') if p.strip()]
    if not parts:
        return None, None

    # Pronađi sve formatirane finansijske iznose
    amounts: list[float] = []
    amt_indices: list[int] = []
    for i, p in enumerate(parts):
        if _is_formatted_amount(p):
            v = _parse_amount(p)
            if v is not None:
                amounts.append(v)
                amt_indices.append(i)

    if not amounts:
        return None, None

    first_amt_idx = amt_indices[0]

    # Kratki čisti numerici prije prvog iznosa:
    # [Grupa_računa(kratki), POZICIJA(dugi), AOP(kratki), [Nap(kratki)], iznosi...]
    # 2. kratki numeric = AOP
    short_nums = [p for p in parts[:first_amt_idx] if re.match(r'^\d{1,3}$', p)]

    aop_code: str | None = None
    if len(short_nums) >= 2:
        aop_code = short_nums[1].zfill(3)
    elif len(short_nums) == 1:
        aop_code = short_nums[0].zfill(3)

    n = len(amounts)
    if n >= 4:
        neto_val = amounts[2]
    elif n == 3:
        neto_val = amounts[1]
    else:
        neto_val = amounts[0]

    return aop_code, neto_val


def _store_from_cell(aop: str | None, cell: str, val: float | None, collected: dict) -> None:
    """Upiši ekstrahovanu vrijednost koristeći AOP ili label mapping."""
    if val is None:
        return

    from app.modules.pdf_parser.normalizer import AOP_MAP, COLUMN_MAP, normalize_key

    fs_field = AOP_MAP.get(aop) if aop else None

    if not fs_field:
        col_map_norm = {
            re.sub(r"[^\w\s]", "", k.strip().lower()).replace(" ", "_"): v
            for k, v in COLUMN_MAP.items()
        }
        for p in cell.split('\n'):
            p = p.strip()
            if len(p) > 8 and not re.match(r'^[\d.,()+-]+$', p):
                label_norm = normalize_key(p)
                if label_norm in _FS_FIELDS:
                    fs_field = label_norm
                    break
                label_stripped = re.sub(r"[^\w\s]", "", p.lower()).replace(" ", "_")
                mapped = col_map_norm.get(label_stripped)
                if mapped and mapped in _FS_FIELDS:
                    fs_field = mapped
                    break

    if fs_field and fs_field in _FS_FIELDS and fs_field not in collected:
        collected[fs_field] = val
        logger.debug(f"Ekstrahovano: {fs_field} = {val} (AOP={aop})")


def _extract_multiline_bih_table(table: dict, collected: dict) -> None:
    """
    Rukovodi BiH bilans stanja tabelama gdje je camelot spakovao 8 kolona
    u 1-2 kolone s '\n'-separiranim vrijednostima.

    Podržava:
    A) Tabele gdje VRIJEDNOSTI sadrže višelinijske zapise (standard table 0)
    B) Tabele gdje KLJUČ sadrži ugrađeni prvi red podataka (prvi red pogrešno uzet kao header)
    C) Kontni okvir tabele: prazan ključ '' = vrijednost, ostali ključ = oznaka računa
    """
    rows = table.get("rows", [])
    if not rows:
        return

    all_keys = list(rows[0].keys())

    # Pronađi ključeve: prazan '' i jedan dugi ključ
    empty_key_present = "" in all_keys
    long_keys = [k for k in all_keys if k and len(k) > 20]
    short_keys = [k for k in all_keys if k and len(k) <= 20]

    if not long_keys and not short_keys:
        return

    # Preferiraj ključ koji ima višelinijske vrijednosti (sadrži '\n')
    # → camelot može koristiti kratki ili dugi ključ ovisno o parsiranoj verziji
    def _has_multiline_values(key: str, n: int = 5) -> bool:
        for row in rows[:n]:
            v = str(row.get(key, '') or '')
            if '\n' in v:
                return True
        return False

    multiline_candidates = [k for k in (long_keys + short_keys) if _has_multiline_values(k)]
    if multiline_candidates:
        data_key = multiline_candidates[0]
    else:
        data_key = long_keys[0] if long_keys else short_keys[0]

    # ── Tip C: Kontni okvir format (kratke oznake + vrijednosti u '') ────────
    # Detektuj: '' ima numeričke vrijednosti, data_key ima kratke šifre računa
    if empty_key_present:
        sample_vals = [str(r.get('', '')) for r in rows[:5] if r.get('', '')]
        sample_lbls = [str(r.get(data_key, '')) for r in rows[:5]]
        val_count = sum(1 for v in sample_vals if _parse_amount(v) is not None and abs(_parse_amount(v)) > 100)
        lbl_looks_acct = sum(1 for l in sample_lbls if re.match(r'^[\d, ]+$', l.strip()) if l.strip())

        if val_count >= 2 and lbl_looks_acct >= 2:
            _extract_from_account_group_table(rows, data_key, collected)
            return

    # ── Tip A+B: Višelinijski zapisi ─────────────────────────────────────────
    # B: Provjeri da li SAM KLJUČ sadrži ugrađeni prvi red (sadrži numerike i labele)
    if '\n' in data_key:
        key_parts = data_key.split('\n')
        # Preskoči zaglavlja, uzmi ostatak kao ugrađeni prvi red
        data_start = None
        for idx, line in enumerate(key_parts):
            if not _is_bilans_header_line(line) and re.match(r'^\d{1,3}$', line.strip()):
                if idx + 1 < len(key_parts) and len(key_parts[idx + 1].strip()) > 8:
                    data_start = idx
                    break

        if data_start is not None:
            embedded = '\n'.join(key_parts[data_start:])
            aop, val = _parse_bih_cell_record(embedded)
            _store_from_cell(aop, embedded, val, collected)

    # A: Parsiraj VRIJEDNOST svakog reda kao višelinijski zapis
    for row in rows:
        cell = str(row.get(data_key, '') or '').strip()
        if not cell or '\n' not in cell:
            continue
        aop, val = _parse_bih_cell_record(cell)
        _store_from_cell(aop, cell, val, collected)


def _extract_from_account_group_table(rows: list, data_key: str, collected: dict) -> None:
    """
    Kontni okvir tabele: '' = vrijednost, data_key = šifra računa.
    FBiH kontni okvir mapping (pouzdani ključni nalozi).

    FBiH klasa konta (velika preduzeća):
      30 = Upisani kapital (share capital)
      31 = Neraspoređena dobit / akumulirani gubitak (retained earnings)
      33 = Dugoročna rezervisanja (long-term provisions → long_term_liabilities)
      34 = Dugoročne finansijske obaveze (long-term debt)
      35 = Kratkoročne finansijske obaveze (short-term debt)
      dio 40 = Dobavljači — parcijalni zbirni red (accounts payable)
      42 = Obaveze prema organima vlasti (tax liabilities → current_liabilities approx)
    """
    _AG_MAP = {
        # Kapital
        '30':  'share_capital',
        '300': 'share_capital',
        '301': 'share_capital',
        '31':  'retained_earnings',
        '310': 'retained_earnings',
        '311': 'retained_earnings',
        # Dugoročne obaveze
        'dio 33': 'long_term_liabilities',
        '33':     'long_term_liabilities',
        '34':     'long_term_debt',
        # Kratkoročne finansijske obaveze (krediti)
        '35':     'short_term_debt',
        # Kratkoročne obaveze prema dobavljačima (zbirni redovi)
        'dio 40': 'accounts_payable',
        '40':     'accounts_payable',
    }

    for row in rows:
        val_str = str(row.get('', '') or '').strip()
        lbl_str = str(row.get(data_key, '') or '').strip().split('\n')[0].strip()

        if not val_str:
            continue
        val = _parse_amount(val_str)
        if val is None:
            continue

        fs_field = _AG_MAP.get(lbl_str)
        if fs_field and fs_field in _FS_FIELDS and fs_field not in collected:
            collected[fs_field] = val
            logger.debug(f"AG tabela: {fs_field} = {val:.0f} (konto={lbl_str!r})")


def _extract_8col_bilans_table(table: dict, collected: dict) -> None:
    """
    Ekstrakcija iz pravilno strukturiranih 8-kolonskih bilans stanja tabela.

    Ovaj format nastaje kada novi table_parser pravilno parsira višelinijska zaglavlja.
    Standardni redosljed kolona (FBiH veliki subjekti):
      [0] Grupa računa  → 'Grupa ranuna' ili slično
      [1] POZICIJA      → '' (prazno ime)
      [2] AOP           → '_1'
      [3] Napomena      → '_2'
      [4] Bruto         → '_3'
      [5] Ispravka      → '_4'
      [6] Neto tekuća   → '_5'  ← ovo uzimamo
      [7] Prethodna     → '_6'

    NAPOMENA: Koristi ISKLJUČIVO mapiranje po POZICIJI (imenu), ne po AOP kodu,
    jer se AOP kodovi 100-170 preklapaju sa bilans uspjeha kodovima.
    """
    rows = table.get("rows", [])
    if len(rows) < 2:
        return

    cols = table.get("columns", [])
    if len(cols) < 6:
        return

    # Provjeri da li kolone izgledaju kao 8-col bilans (kratka imena + '_N' pattern)
    has_numbered = any(re.match(r'^_\d+$', c) for c in cols)
    if not has_numbered:
        return

    val_col   = '_5' if '_5' in cols else ('_4' if '_4' in cols else None)
    label_col = '' if '' in cols else None  # '' je validan ključ, provjera mora biti "is None"

    if label_col is None or val_col is None:
        return

    # Mapiranje po ključnim riječima u POZICIJI (case-insensitive, djelimično podudaranje)
    # Pouzdane agregatne pozicije (zbirni redovi koji ne mijenjaju predznak)
    # NAPOMENA: PDF enkodira 'č'/'ć' → 'n', npr. 'dugoročna' → 'dugoronna', 'tekuće' → 'tekune'
    _POZICIJA_KEYWORDS: list[tuple[list[str], str]] = [
        # Dugoročne obaveze i rezervisanja (agregat B.) — mora biti PRIJE sub-stavki
        (["rezervisanja", "dugoronne", "obaveze"],   "long_term_liabilities"),
        # Dugoročne finansijske obaveze (sub-stavka II)
        (["ii", "dugoronne", "obaveze"],             "long_term_debt"),
        # Kratkoročne obaveze (agregat G.) — mora biti PRIJE kratkoročnih sub-stavki
        (["kratkoronne", "obaveze", "rezervisan"],   "current_liabilities"),
        # Kratkoročne finansijske obaveze (sub-stavka)
        (["kratkoronne", "finansij", "obaveze"],     "short_term_debt"),
        # Obaveze iz poslovanja (dobavljači i sl.)
        (["obaveze", "poslovan"],                    "accounts_payable"),
        # Equity = BILANSNA PASIVA A. KAPITAL (sadrži i 'kapital')
        (["bilansna pasiva", "kapital"],             "equity"),
        # Bilansna pasiva TOTAL (= total assets) — 'D.' prefix → 'd  bilansna pasiva' normalizovano
        # Nije 'VANBILANSNA PASIVA' ni 'A. KAPITAL' dio
        (["d  bilansna pasiva"],                     "total_assets"),
        (["ukupna pasiva"],                          "total_assets"),
        # Neraspoređena dobit (pozitivna)
        (["nerasporenena dobit"],                    "retained_earnings"),
        # Gubitak tekuće godine → neto prihod (negativan)
        (["gubitak tekune"],                         "_net_loss_current"),  # tekuće → tekune
        (["gubitak teku"],                           "_net_loss_current"),  # fallback
        # Gubitak ranijih godina → zadržana dobit (negativna)
        (["gubitak ranij"],                          "_net_loss_prior"),
    ]

    def _label_matches(label: str, keywords: list[str]) -> bool:
        """Provjeri da li label sadrži SVE ključne riječi (case-insensitive)."""
        l = re.sub(r'[^\w\s]', ' ', label.lower()).strip()
        return all(kw in l for kw in keywords)

    for row in rows:
        val_str = str(row.get(val_col, '') or '').strip()
        label   = str(row.get(label_col, '') or '').strip()

        if not label or not val_str:
            continue

        val = _parse_amount(val_str)
        if val is None or val == 0:
            continue

        matched_field: str | None = None
        for kw_list, field_name in _POZICIJA_KEYWORDS:
            if _label_matches(label, kw_list):
                matched_field = field_name
                break

        if matched_field is None:
            continue

        # Posebna obrada negativnih stavki
        if matched_field == '_net_loss_current':
            if 'net_income' not in collected:
                collected['net_income'] = -val
                logger.debug(f"8col: net_income = {-val:.0f} (gubitak tekuće godine)")
        elif matched_field == '_net_loss_prior':
            if 'retained_earnings' not in collected:
                collected['retained_earnings'] = -val
                logger.debug(f"8col: retained_earnings = {-val:.0f} (gubitak ranijih)")
        elif matched_field in _FS_FIELDS and matched_field not in collected:
            collected[matched_field] = val
            logger.debug(f"8col: {matched_field} = {val:.0f} (label={label[:40]!r})")


# ── Glavni entry point ─────────────────────────────────────────────────────────

def extract_from_raw(raw_data: dict[str, Any]) -> FinancialStatement:
    """
    Ekstrahuje FinancialStatement iz raw_data-a PDF parsera.

    Pokušava tri pristupa za svaku tabelu:
    1. Flat format — normalizovani ključevi su direktno FS polja
    2. Label-value format — tipično za standardne AOP tabele
    3. BiH collapsed multi-line — camelot spakuje 8+ kolona u 1 kolonu s '\n'
    """
    collected: dict[str, float] = {}

    for table in raw_data.get("tables", []):
        # Pristup 1: direktno preslikavanje
        for row in table.get("rows_normalized", []):
            for key, val in row.items():
                if key in _FS_FIELDS and key not in collected:
                    parsed = _parse_amount(val)
                    if parsed is not None:
                        collected[key] = parsed

        # Pristup 2: label-value tabela
        _extract_label_value_table(table, collected)

        # Pristup 3: BiH collapsed multi-line
        _extract_multiline_bih_table(table, collected)

        # Pristup 4: Pravilno strukturirana 8-kolonska bilans stanja tabela
        _extract_8col_bilans_table(table, collected)

    # Post-processing: procijeni ukupnu imovinu ako nije direktno pronađena
    if "total_assets" not in collected:
        nca = collected.get("non_current_assets")
        ca  = collected.get("current_assets")
        if nca is not None and ca is not None:
            collected["total_assets"] = nca + ca
            logger.debug(f"total_assets procijenjen: {nca} + {ca} = {nca + ca}")

    # Post-processing: procijeni kapital ako nije direktno pronađen
    if "equity" not in collected:
        sc  = collected.get("share_capital")
        re_ = collected.get("retained_earnings")
        if sc is not None and re_ is not None:
            collected["equity"] = sc + re_
            logger.debug(f"equity procijenjen: {sc} + {re_} = {sc + re_}")

    # Post-processing: procijeni ukupne obaveze
    if "total_liabilities" not in collected:
        ta = collected.get("total_assets")
        eq = collected.get("equity")
        if ta is not None and eq is not None:
            collected["total_liabilities"] = ta - eq
            logger.debug(f"total_liabilities procijenjen: {ta} - {eq} = {ta - eq}")
        else:
            # Alternativa: zbroji dugoročne i kratkoročne obaveze
            lt = collected.get("long_term_liabilities", 0.0) or 0.0
            cl = collected.get("current_liabilities", 0.0) or 0.0
            if lt > 0 or cl > 0:
                collected["total_liabilities"] = lt + cl
                logger.debug(f"total_liabilities = LT+CL = {lt} + {cl} = {lt + cl}")

    # Post-processing: procijeni equity iz bilansne jednačine
    if "equity" not in collected:
        ta = collected.get("total_assets")
        tl = collected.get("total_liabilities")
        if ta is not None and tl is not None:
            collected["equity"] = ta - tl
            logger.debug(f"equity procijenjen iz jednačine: {ta} - {tl} = {ta - tl}")

    # Post-processing: procijeni kratkoročne obaveze iz dostupnih komponenti
    if "current_liabilities" not in collected:
        st_debt = collected.get("short_term_debt", 0.0) or 0.0
        ap      = collected.get("accounts_payable", 0.0) or 0.0
        # Samo ako imamo barem jednu kratkoročnu komponentu
        if st_debt > 0 or ap > 0:
            # Ovo je donja granica — stvarne kratkoročne obaveze su veće
            # (nedostaju: porezne, zaposlenici, primljeni avansi, itd.)
            # Ne postavljamo ovu vrijednost jer bi dala lažno visok current ratio
            pass

    # Post-processing: procijeni long_term_liabilities iz long_term_debt ako nedostaje
    if "long_term_liabilities" not in collected and "long_term_debt" in collected:
        collected["long_term_liabilities"] = collected["long_term_debt"]
        logger.debug(f"long_term_liabilities = long_term_debt = {collected['long_term_debt']:.0f}")

    logger.info(
        f"extract_from_raw pronašao {len(collected)} polja: "
        + ", ".join(f"{k}={v:.0f}" for k, v in list(collected.items())[:8])
    )

    return FinancialStatement(**{k: v for k, v in collected.items() if k in _FS_FIELDS})
