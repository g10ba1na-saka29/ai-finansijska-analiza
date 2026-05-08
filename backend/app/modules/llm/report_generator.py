"""
Generira AI finansijski izvještaj iz KPISnapshot + CompanyScore.
Koristi se iz Celery taska — sve operacije su sync.
"""

import logging
from dataclasses import dataclass
from typing import Any

from app.modules.llm.client import LLMClient
from app.modules.llm.prompts import (
    SYSTEM_ANALYST, REPORT_USER_TEMPLATE,
    RISK_LEVELS_BS, fmt_pct, fmt_num, fmt_currency,
)

logger = logging.getLogger(__name__)


@dataclass
class ReportData:
    summary: str
    score_explanation: str
    strengths: list[str]
    weaknesses: list[str]
    key_risks: list[str]
    recommendations: list[str]
    risk_assessment: str
    outlook: str
    red_flags: list[str]
    model_used: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "score_explanation": self.score_explanation,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "key_risks": self.key_risks,
            "recommendations": self.recommendations,
            "risk_assessment": self.risk_assessment,
            "outlook": self.outlook,
            "red_flags": self.red_flags,
        }


def _build_trend_section(trend_points: list[dict]) -> str:
    if not trend_points:
        return ""
    lines = ["## TREND (prethodne godine)"]
    for p in trend_points[-3:]:  # Max 3 godine
        lines.append(
            f"  {p.get('fiscal_year')}: Score={p.get('total_score', 'N/A')}, "
            f"EBITDA margin={fmt_pct(p.get('ebitda_margin'))}, "
            f"Rev. growth={fmt_pct(p.get('revenue_growth'))}"
        )
    return "\n".join(lines)


def generate(
    company_name: str,
    industry: str | None,
    country: str,
    fiscal_year: int,
    kpi: dict[str, Any],
    score: dict[str, Any],
    trend_points: list[dict] | None = None,
) -> ReportData:
    """
    Args:
        kpi:    Flat dict KPI vrijednosti (iz KPISnapshot)
        score:  Dict score breakdown (iz CompanyScore)
        trend_points: Lista [{fiscal_year, total_score, ebitda_margin, ...}, ...]
    """
    from app.config import settings

    altman = score.get("altman_data") or {}

    prompt = REPORT_USER_TEMPLATE.format(
        company_name=company_name,
        industry=industry or "Nije navedeno",
        country=country,
        fiscal_year=fiscal_year,
        total_score=fmt_num(score.get("total_score"), 1),
        risk_level_label=RISK_LEVELS_BS.get(score.get("risk_level", ""), score.get("risk_level", "N/A")),
        liquidity_score=fmt_num(score.get("liquidity_score"), 1) or "N/A",
        profitability_score=fmt_num(score.get("profitability_score"), 1) or "N/A",
        leverage_score=fmt_num(score.get("leverage_score"), 1) or "N/A",
        growth_score=fmt_num(score.get("growth_score"), 1) or "N/A",
        cashflow_score=fmt_num(score.get("cashflow_score"), 1) or "N/A",
        current_ratio=fmt_num(kpi.get("current_ratio")),
        quick_ratio=fmt_num(kpi.get("quick_ratio")),
        cash_ratio=fmt_num(kpi.get("cash_ratio")),
        ebitda_margin=fmt_pct(kpi.get("ebitda_margin")),
        net_margin=fmt_pct(kpi.get("net_margin")),
        roe=fmt_pct(kpi.get("roe")),
        roa=fmt_pct(kpi.get("roa")),
        debt_to_equity=fmt_num(kpi.get("debt_to_equity")),
        interest_coverage=fmt_num(kpi.get("interest_coverage")),
        debt_ratio=fmt_num(kpi.get("debt_ratio")),
        revenue_growth=fmt_pct(kpi.get("revenue_growth")),
        ebitda_growth=fmt_pct(kpi.get("ebitda_growth")),
        net_income_growth=fmt_pct(kpi.get("net_income_growth")),
        free_cash_flow=fmt_currency(kpi.get("free_cash_flow")),
        ocf_margin=fmt_pct(kpi.get("ocf_margin")),
        altman_z=fmt_num(altman.get("z_score")),
        altman_zone=altman.get("zone", "N/A"),
        altman_interpretation=altman.get("interpretation", ""),
        trend_section=_build_trend_section(trend_points or []),
    )

    client = LLMClient.from_settings()
    messages = [
        {"role": "system", "content": SYSTEM_ANALYST},
        {"role": "user", "content": prompt},
    ]

    logger.info(f"Generišem AI izvještaj za {company_name} ({fiscal_year})")
    raw = client.complete_json(messages)

    return ReportData(
        summary=raw.get("summary", ""),
        score_explanation=raw.get("score_explanation", ""),
        strengths=raw.get("strengths", []),
        weaknesses=raw.get("weaknesses", []),
        key_risks=raw.get("key_risks", []),
        recommendations=raw.get("recommendations", []),
        risk_assessment=raw.get("risk_assessment", ""),
        outlook=raw.get("outlook", ""),
        red_flags=raw.get("red_flags", []),
        model_used=settings.LLM_MODEL,
    )
