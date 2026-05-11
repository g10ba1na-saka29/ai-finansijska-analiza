"""
Mapiranje lokalnih naziva (BiH/RS/HR) na standardizovane engleske ključeve.
Podržava MRS/MSFI standarde.
"""

import re

COLUMN_MAP: dict[str, str] = {
    # ── Income Statement ───────────────────────────────────────────────────────
    "prihodi od prodaje": "revenue",
    "prihodi od prodaje robe i usluga": "revenue",
    "poslovni prihodi": "revenue",
    "ukupni prihodi": "total_revenue",
    "ukupni poslovni prihodi": "total_revenue",
    "neto prihodi": "revenue",
    "neto prihodi od prodaje": "revenue",
    "bruto dobit": "gross_profit",
    "bruto profit": "gross_profit",
    "troškovi prodaje": "cogs",
    "troskovi prodaje": "cogs",
    "troškovi robe": "cogs",
    "nabavna vrijednost": "cogs",
    "nabavna vrijednost prodanih učinaka": "cogs",
    "poslovni rashodi": "operating_expenses",
    "ukupni poslovni rashodi": "operating_expenses",
    "troškovi uprave": "operating_expenses",
    "troškovi marketinga": "operating_expenses",
    "ebitda": "ebitda",
    "amortizacija": "depreciation_amortization",
    "amortizacija i deprecijacija": "depreciation_amortization",
    "deprecijacija": "depreciation_amortization",
    "ebit": "ebit",
    "poslovni rezultat": "ebit",
    "dobit iz poslovanja": "ebit",
    "finansijski prihodi": "financial_income",
    "finansijski rashodi": "financial_expenses",
    "kamate": "interest_expense",
    "troškovi kamata": "interest_expense",
    "rashodi kamata": "interest_expense",
    "dobit prije poreza": "ebt",
    "dobitgubitak prije poreza": "ebt",        # '/' stripped by normalize_key
    "dobit ili gubitak prije poreza": "ebt",
    "gubitak prije poreza": "ebt",
    "porez na dobit": "income_tax",
    "porez na profit": "income_tax",
    "porez na dohodak": "income_tax",
    "neto dobit": "net_income",
    "neto dobitgubitak": "net_income",          # '/' stripped
    "neto dobit ili gubitak": "net_income",
    "čista dobit": "net_income",
    "dobit poslovne godine": "net_income",
    "gubitak poslovne godine": "net_income",
    # ── Balance Sheet — Assets ─────────────────────────────────────────────────
    "ukupna imovina": "total_assets",
    "ukupna aktiva": "total_assets",
    "ukupno aktiva": "total_assets",
    "stalna imovina": "non_current_assets",
    "dugotrajna imovina": "non_current_assets",
    "dugoročna imovina": "non_current_assets",
    "nematerijalna imovina": "intangible_assets",
    "nematerijalna stalna imovina": "intangible_assets",
    "materijalna imovina": "property_plant_equipment",
    "materijalna stalna imovina": "property_plant_equipment",
    "nekretnine postrojenja i oprema": "property_plant_equipment",
    "nekretnine oprema i ostala materijalna imovina": "property_plant_equipment",
    "dugoročne finansijske investicije": "long_term_investments",
    "dugoročni finansijski plasmani": "long_term_investments",
    "obrtna imovina": "current_assets",
    "kratkotrajna imovina": "current_assets",
    "tekuća imovina": "current_assets",
    "zalihe": "inventories",
    "potraživanja od kupaca": "receivables",
    "kratkoročna potraživanja": "receivables",
    "kratkoročna potraživanja i plasmani": "receivables",
    "potraživanja": "receivables",
    "gotovina i gotovinski ekvivalenti": "cash",
    "gotovina i ekvivalenti gotovine": "cash",
    "gotovina": "cash",
    "novac i novčani ekvivalenti": "cash",
    "novac": "cash",
    # ── Balance Sheet — Liabilities & Equity ──────────────────────────────────
    "ukupne obaveze i kapital": "total_liabilities",
    "ukupna pasiva": "total_assets",           # pasiva = aktiva (bilans stanja)
    "ukupno pasiva": "total_assets",
    "vlastiti kapital": "equity",
    "kapital": "equity",
    "kapital i rezerve": "equity",
    "dionički kapital": "share_capital",
    "upisani kapital": "share_capital",
    "osnovni kapital": "share_capital",
    "zadržana dobit": "retained_earnings",
    "zadržani dobitak": "retained_earnings",
    "nerasporedjeni dobitak": "retained_earnings",
    "ukupne obaveze": "total_liabilities",
    "ukupno obaveze": "total_liabilities",
    "dugoročne obaveze": "long_term_liabilities",
    "dugoročne finansijske obaveze": "long_term_debt",
    "dugoročni krediti": "long_term_debt",
    "dugoročni zajmovi": "long_term_debt",
    "kratkoročne obaveze": "current_liabilities",
    "kratkoročne finansijske obaveze": "short_term_debt",
    "kratkoročni krediti": "short_term_debt",
    "kratkoročni zajmovi": "short_term_debt",
    "obaveze prema dobavljačima": "accounts_payable",
    "dobavljači": "accounts_payable",
    "obaveze iz poslovanja": "accounts_payable",
    # ── Cash Flow ─────────────────────────────────────────────────────────────
    "novčani tok iz poslovnih aktivnosti": "operating_cf",
    "neto novčani tok iz poslovnih aktivnosti": "operating_cf",
    "operativni novčani tok": "operating_cf",
    "novčani tok iz investicijskih aktivnosti": "investing_cf",
    "investicijski novčani tok": "investing_cf",
    "novčani tok iz finansijskih aktivnosti": "financing_cf",
    "finansijski novčani tok": "financing_cf",
    "neto promjena gotovine": "net_change_in_cash",
    "kapex": "capex",
    "kapitalni izdaci": "capex",
}


# ── AOP kod mapiranje (BiH/FBiH Pravilnik o kontnom okviru) ───────────────────
# Bilans stanja — Aktiva
# Bilans stanja — Pasiva
# Bilans uspjeha (skraćeni)
AOP_MAP: dict[str, str] = {
    # ── Aktiva (AOP kodovi koji se koriste u oba oblika — mali i veliki subjekti) ─
    "001": "non_current_assets",         # STALNA / DUGOTRAJNA IMOVINA
    "002": "intangible_assets",          # NEMATERIJALNA SREDSTVA
    "005": "property_plant_equipment",   # NEKRETNINE, POSTROJENJA I OPREMA (mali)
    "008": "property_plant_equipment",   # NEKRETNINE, POSTROJENJA I OPREMA (veliki)
    "012": "long_term_investments",      # DUGOROČNI FINANSIJSKI PLASMANI (mali)
    "022": "long_term_investments",      # DUGOROČNI FINANSIJSKI PLASMANI (veliki)
    "020": "current_assets",             # OBRTNA / TEKUĆA IMOVINA (mali)
    "021": "inventories",                # ZALIHE (mali)
    "027": "receivables",                # KRATKOROČNA POTRAŽIVANJA (mali)
    "028": "cash",                       # GOTOVINA (mali)
    "033": "total_assets",               # UKUPNA AKTIVA (mali)
    "036": "current_assets",             # TEKUĆA SREDSTVA (veliki)
    "037": "inventories",                # ZALIHE (veliki)
    "040": "receivables",                # KRATKOROČNA POTRAŽIVANJA (veliki)
    "043": "cash",                       # GOTOVINA I EKVIVALENTI (veliki)
    "045": "total_assets",               # UKUPNA AKTIVA (veliki)
    # ── Pasiva (mali subjekti) ─────────────────────────────────────────────────
    "034": "equity",
    "035": "share_capital",
    # "038" izbačeno — u velikom obrascu FBiH AOP 38 = zalihe materijala (ne zadržana dobit)
    "048": "long_term_liabilities",
    "050": "long_term_debt",
    "058": "current_liabilities",
    "059": "accounts_payable",
    "064": "short_term_debt",
    "070": "total_liabilities",
    "071": "total_assets",               # Ukupna pasiva = Ukupna aktiva
    # ── Pasiva (veliki subjekti) ───────────────────────────────────────────────
    "046": "equity",
    "047": "share_capital",
    "051": "retained_earnings",
    "060": "long_term_liabilities",
    "061": "long_term_debt",
    "072": "current_liabilities",
    "073": "accounts_payable",
    "077": "short_term_debt",
    "081": "total_liabilities",
    "082": "total_assets",               # Ukupna pasiva (veliki)
    # ── Bilans uspjeha ─────────────────────────────────────────────────────────
    "100": "total_revenue",
    "102": "revenue",
    "110": "revenue",
    "120": "cogs",
    "125": "gross_profit",
    "150": "operating_expenses",
    "155": "depreciation_amortization",
    "160": "depreciation_amortization",
    "200": "ebit",
    "210": "financial_income",
    "220": "financial_expenses",
    "225": "interest_expense",
    "230": "ebt",
    "235": "income_tax",
    "240": "net_income",
}


def normalize_key(raw: str) -> str:
    cleaned = raw.strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    return COLUMN_MAP.get(cleaned, cleaned.replace(" ", "_"))


def normalize_table(table: dict) -> dict:
    return {normalize_key(k): v for k, v in table.items()}
