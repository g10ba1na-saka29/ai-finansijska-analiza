"""
Mapiranje lokalnih naziva (BiH/RS/HR) na standardizovane engleske ključeve.
Podržava MRS/MSFI standarde.
"""

import re

COLUMN_MAP: dict[str, str] = {
    # ── Income Statement ───────────────────────────────────────────────────────
    "prihodi od prodaje": "revenue",
    "poslovni prihodi": "revenue",
    "ukupni prihodi": "total_revenue",
    "neto prihodi": "net_revenue",
    "bruto dobit": "gross_profit",
    "troškovi prodaje": "cogs",
    "troškovi robe": "cogs",
    "nabavna vrijednost": "cogs",
    "bruto profit": "gross_profit",
    "poslovni rashodi": "operating_expenses",
    "troškovi uprave": "admin_expenses",
    "troškovi marketinga": "marketing_expenses",
    "ebitda": "ebitda",
    "amortizacija": "depreciation_amortization",
    "deprecijacija": "depreciation_amortization",
    "ebit": "ebit",
    "poslovni rezultat": "ebit",
    "finansijski prihodi": "financial_income",
    "finansijski rashodi": "financial_expenses",
    "kamate": "interest_expense",
    "troškovi kamata": "interest_expense",
    "dobit prije poreza": "ebt",
    "dobit/gubitak prije poreza": "ebt",
    "porez na dobit": "income_tax",
    "porez na profit": "income_tax",
    "neto dobit": "net_income",
    "neto dobit/gubitak": "net_income",
    "čista dobit": "net_income",
    # ── Balance Sheet — Assets ─────────────────────────────────────────────────
    "ukupna imovina": "total_assets",
    "ukupna aktiva": "total_assets",
    "stalna imovina": "non_current_assets",
    "dugotrajna imovina": "non_current_assets",
    "nematerijalna imovina": "intangible_assets",
    "materijalna imovina": "property_plant_equipment",
    "nekretnine postrojenja i oprema": "property_plant_equipment",
    "dugoročne finansijske investicije": "long_term_investments",
    "obrtna imovina": "current_assets",
    "kratkotrajna imovina": "current_assets",
    "zalihe": "inventories",
    "potraživanja od kupaca": "receivables",
    "kratkoročna potraživanja": "receivables",
    "potraživanja": "receivables",
    "gotovina i gotovinski ekvivalenti": "cash",
    "gotovina": "cash",
    "novac i novčani ekvivalenti": "cash",
    # ── Balance Sheet — Liabilities & Equity ──────────────────────────────────
    "ukupne obaveze i kapital": "total_liabilities_equity",
    "ukupna pasiva": "total_liabilities_equity",
    "vlastiti kapital": "equity",
    "kapital i rezerve": "equity",
    "dionički kapital": "share_capital",
    "zadržana dobit": "retained_earnings",
    "ukupne obaveze": "total_liabilities",
    "dugoročne obaveze": "long_term_liabilities",
    "dugoročni krediti": "long_term_debt",
    "kratkoročne obaveze": "current_liabilities",
    "kratkoročni krediti": "short_term_debt",
    "obaveze prema dobavljačima": "accounts_payable",
    "dobavljači": "accounts_payable",
    # ── Cash Flow ─────────────────────────────────────────────────────────────
    "novčani tok iz poslovnih aktivnosti": "operating_cf",
    "operativni novčani tok": "operating_cf",
    "novčani tok iz investicijskih aktivnosti": "investing_cf",
    "investicijski novčani tok": "investing_cf",
    "novčani tok iz finansijskih aktivnosti": "financing_cf",
    "finansijski novčani tok": "financing_cf",
    "neto promjena gotovine": "net_change_in_cash",
    "kapex": "capex",
    "kapitalni izdaci": "capex",
}


def normalize_key(raw: str) -> str:
    cleaned = raw.strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    return COLUMN_MAP.get(cleaned, cleaned.replace(" ", "_"))


def normalize_table(table: dict) -> dict:
    return {normalize_key(k): v for k, v in table.items()}
