"""
Q&A modul — korisnik može postavljati pitanja o finansijskom stanju kompanije.
"""

import logging
from typing import Any

from app.modules.llm.client import LLMClient
from app.modules.llm.prompts import QA_SYSTEM_TEMPLATE, fmt_pct, fmt_num, fmt_currency

logger = logging.getLogger(__name__)

MAX_HISTORY = 10  # Čuvamo max 10 prethodnih poruka u kontekstu


def answer(
    question: str,
    company_name: str,
    fiscal_year: int,
    kpi: dict[str, Any],
    score: dict[str, Any],
    ai_summary: str = "",
    history: list[dict[str, str]] | None = None,
) -> str:
    """
    Args:
        history: Lista prethodnih {role, content} poruka za multi-turn razgovor.
    """
    altman = score.get("altman_data") or {}

    system = QA_SYSTEM_TEMPLATE.format(
        company_name=company_name,
        fiscal_year=fiscal_year,
        total_score=fmt_num(score.get("total_score"), 1),
        risk_level=score.get("risk_level", "N/A"),
        ebitda_margin=fmt_pct(kpi.get("ebitda_margin")),
        net_margin=fmt_pct(kpi.get("net_margin")),
        current_ratio=fmt_num(kpi.get("current_ratio")),
        debt_to_equity=fmt_num(kpi.get("debt_to_equity")),
        interest_coverage=fmt_num(kpi.get("interest_coverage")),
        revenue_growth=fmt_pct(kpi.get("revenue_growth")),
        free_cash_flow=fmt_currency(kpi.get("free_cash_flow")),
        altman_z=fmt_num(altman.get("z_score")),
        altman_zone=altman.get("zone", "N/A"),
        ai_summary=ai_summary or "Nije dostupan.",
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]

    # Dodaj historiju razgovora (zadnjih MAX_HISTORY poruka)
    if history:
        messages.extend(history[-MAX_HISTORY:])

    messages.append({"role": "user", "content": question})

    client = LLMClient.from_settings()
    logger.info(f"Q&A upit za {company_name} ({fiscal_year}): {question[:80]}")
    return client.complete_text(messages)
