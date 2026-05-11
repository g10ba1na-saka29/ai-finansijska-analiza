"""
Generira downloadable PDF finansijski izvještaj koristeći reportlab.
"""

import io
import logging
from datetime import date
from typing import Any

logger = logging.getLogger(__name__)

# ── Boje ──────────────────────────────────────────────────────────────────────
COLORS = {
    "primary":    (0.13, 0.29, 0.53),   # Tamno plava
    "accent":     (0.20, 0.60, 0.86),   # Svijetlo plava
    "excellent":  (0.18, 0.64, 0.33),   # Zelena
    "good":       (0.20, 0.60, 0.86),   # Plava
    "warning":    (0.95, 0.77, 0.06),   # Žuta
    "high_risk":  (0.91, 0.50, 0.15),   # Narandžasta
    "critical":   (0.80, 0.15, 0.15),   # Crvena
    "light_gray": (0.95, 0.95, 0.95),
    "mid_gray":   (0.70, 0.70, 0.70),
    "text":       (0.15, 0.15, 0.15),
}

RISK_LABELS_BS = {
    "excellent": "ODLIČNO",
    "good": "DOBRO",
    "warning": "UPOZORENJE",
    "high_risk": "VISOK RIZIK",
    "critical": "KRITIČNO",
}


def _rl_color(key: str):
    from reportlab.lib.colors import Color
    r, g, b = COLORS.get(key, COLORS["text"])
    return Color(r, g, b)


def _score_bar(canvas, x: float, y: float, score: float, width: float = 300, height: float = 18):
    """Crta horizontalni score bar."""
    from reportlab.lib.colors import Color
    # Pozadina
    canvas.setFillColor(Color(*COLORS["light_gray"]))
    canvas.rect(x, y, width, height, fill=1, stroke=0)
    # Popunjeni dio
    risk = _score_to_risk(score)
    canvas.setFillColor(_rl_color(risk))
    canvas.rect(x, y, width * score / 100, height, fill=1, stroke=0)
    # Tekst
    canvas.setFillColor(Color(*COLORS["text"]))
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(x + width + 8, y + 4, f"{score:.1f}/100")


def _score_to_risk(score: float) -> str:
    if score >= 80:
        return "excellent"
    if score >= 60:
        return "good"
    if score >= 40:
        return "warning"
    if score >= 20:
        return "high_risk"
    return "critical"


def _kpi_table(elements, styles, kpi_rows: list[tuple[str, str, str]], title: str):
    """Kreira formatiranu KPI tabelu."""
    from reportlab.platypus import Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.colors import Color

    elements.append(Paragraph(title, styles["SectionHeader"]))
    elements.append(Spacer(1, 4))

    data = [["Metrika", "Vrijednost", "Referentna"]]
    for label, value, reference in kpi_rows:
        data.append([label, value, reference])

    t = Table(data, colWidths=[200, 100, 150])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), Color(*COLORS["primary"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), Color(1, 1, 1)),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [Color(*COLORS["light_gray"]), Color(1, 1, 1)]),
        ("GRID", (0, 0), (-1, -1), 0.5, Color(*COLORS["mid_gray"])),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 12))


def _fmt(val: Any, pct: bool = False, dec: int = 2) -> str:
    if val is None:
        return "N/A"
    if pct:
        return f"{float(val) * 100:.1f}%"
    return f"{float(val):.{dec}f}"


def generate_pdf(
    company_name: str,
    industry: str | None,
    country: str,
    fiscal_year: int,
    kpi: dict[str, Any],
    score: dict[str, Any],
    ai_report: dict[str, Any],
) -> bytes:
    """
    Vraća PDF kao bytes koji se šalje kao HTTP response.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib.colors import Color
    except ImportError:
        raise RuntimeError("reportlab nije instaliran. Dodaj ga u requirements.txt")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle(
            "ReportTitle", parent=base["Title"],
            fontSize=22, textColor=Color(*COLORS["primary"]),
            spaceAfter=4, alignment=TA_CENTER,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle", parent=base["Normal"],
            fontSize=11, textColor=Color(*COLORS["mid_gray"]),
            spaceAfter=16, alignment=TA_CENTER,
        ),
        "SectionHeader": ParagraphStyle(
            "SectionHeader", parent=base["Heading2"],
            fontSize=12, textColor=Color(*COLORS["primary"]),
            spaceBefore=12, spaceAfter=4,
            borderPad=2,
        ),
        "Body": ParagraphStyle(
            "Body", parent=base["Normal"],
            fontSize=10, leading=14,
            textColor=Color(*COLORS["text"]),
        ),
        "BulletItem": ParagraphStyle(
            "BulletItem", parent=base["Normal"],
            fontSize=10, leading=14, leftIndent=12,
            textColor=Color(*COLORS["text"]),
        ),
        "RiskLabel": ParagraphStyle(
            "RiskLabel", parent=base["Normal"],
            fontSize=14, fontName="Helvetica-Bold",
            textColor=Color(*_score_to_risk_color(score.get("risk_level", ""))),
            alignment=TA_CENTER,
        ),
    }

    elements = []

    # ── Zaglavlje ──────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(company_name, styles["Title"]))
    elements.append(Paragraph(
        f"Finansijska analiza • {fiscal_year} • {industry or 'N/A'} • {country}",
        styles["Subtitle"],
    ))
    elements.append(HRFlowable(width="100%", thickness=2, color=Color(*COLORS["primary"])))
    elements.append(Spacer(1, 0.5 * cm))

    # ── Score kartica ──────────────────────────────────────────────────────────
    risk = score.get("risk_level", "")
    elements.append(Paragraph("UKUPNI SCORE", styles["SectionHeader"]))
    risk_label = RISK_LABELS_BS.get(risk, risk.upper())
    elements.append(Paragraph(
        f"{score.get('total_score', 0):.1f} / 100 — {risk_label}",
        styles["RiskLabel"],
    ))
    elements.append(Spacer(1, 8))

    # Score tabela po kategorijama
    from reportlab.platypus import Table, TableStyle
    score_rows = [
        ["Kategorija", "Score", "Ponder"],
        ["Likvidnost",    _fmt(score.get("liquidity_score"), dec=1), "20%"],
        ["Profitabilnost", _fmt(score.get("profitability_score"), dec=1), "25%"],
        ["Zaduženost",    _fmt(score.get("leverage_score"), dec=1), "20%"],
        ["Rast",          _fmt(score.get("growth_score"), dec=1), "20%"],
        ["Cash Flow",     _fmt(score.get("cashflow_score"), dec=1), "15%"],
    ]
    st = Table(score_rows, colWidths=[200, 100, 100])
    st.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), Color(*COLORS["primary"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), Color(1, 1, 1)),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [Color(*COLORS["light_gray"]), Color(1, 1, 1)]),
        ("GRID", (0, 0), (-1, -1), 0.5, Color(*COLORS["mid_gray"])),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(st)
    elements.append(Spacer(1, 16))

    # ── AI Sažetak ─────────────────────────────────────────────────────────────
    if ai_report.get("summary"):
        elements.append(Paragraph("SAŽETAK ANALIZE", styles["SectionHeader"]))
        elements.append(Paragraph(ai_report["summary"], styles["Body"]))
        elements.append(Spacer(1, 8))

    if ai_report.get("score_explanation"):
        elements.append(Paragraph("OBRAZLOŽENJE SCORE-A", styles["SectionHeader"]))
        elements.append(Paragraph(ai_report["score_explanation"], styles["Body"]))
        elements.append(Spacer(1, 8))

    # ── KPI Tabele ─────────────────────────────────────────────────────────────
    _kpi_table(elements, styles, [
        ("Current Ratio",  _fmt(kpi.get("current_ratio")), "> 1.5"),
        ("Quick Ratio",    _fmt(kpi.get("quick_ratio")), "> 1.0"),
        ("Cash Ratio",     _fmt(kpi.get("cash_ratio")), "> 0.5"),
    ], "LIKVIDNOST")

    _kpi_table(elements, styles, [
        ("EBITDA Margin",  _fmt(kpi.get("ebitda_margin"), pct=True), "> 15%"),
        ("Net Margin",     _fmt(kpi.get("net_margin"), pct=True), "> 5%"),
        ("ROE",            _fmt(kpi.get("roe"), pct=True), "> 12%"),
        ("ROA",            _fmt(kpi.get("roa"), pct=True), "> 5%"),
    ], "PROFITABILNOST")

    _kpi_table(elements, styles, [
        ("Debt/Equity",       _fmt(kpi.get("debt_to_equity")), "< 2.0"),
        ("Interest Coverage", _fmt(kpi.get("interest_coverage")), "> 3.0"),
        ("Debt Ratio",        _fmt(kpi.get("debt_ratio")), "< 0.5"),
    ], "ZADUŽENOST")

    _kpi_table(elements, styles, [
        ("Rast prihoda",   _fmt(kpi.get("revenue_growth"), pct=True), "-"),
        ("Rast EBITDA",    _fmt(kpi.get("ebitda_growth"), pct=True), "-"),
        ("Free Cash Flow", _fmt(kpi.get("free_cash_flow"), dec=0), "Pozitivan"),
        ("OCF Margin",     _fmt(kpi.get("ocf_margin"), pct=True), "> 10%"),
    ], "RAST & CASH FLOW")

    # ── Altman Z-Score ─────────────────────────────────────────────────────────
    altman = score.get("altman_data") or {}
    if altman.get("z_score") is not None:
        elements.append(Paragraph("ALTMAN Z''-SCORE", styles["SectionHeader"]))
        elements.append(Paragraph(
            f"Z'' = {altman['z_score']:.2f}  →  {altman.get('interpretation', '')}",
            styles["Body"],
        ))
        elements.append(Spacer(1, 8))

    # ── Snage i Slabosti ───────────────────────────────────────────────────────
    for section_key, section_title in [
        ("strengths", "SNAGE"),
        ("weaknesses", "SLABOSTI"),
        ("key_risks", "KLJUČNI RIZICI"),
    ]:
        items = ai_report.get(section_key, [])
        if items:
            elements.append(Paragraph(section_title, styles["SectionHeader"]))
            for item in items:
                elements.append(Paragraph(f"• {item}", styles["BulletItem"]))
            elements.append(Spacer(1, 8))

    # ── Preporuke ──────────────────────────────────────────────────────────────
    recommendations = ai_report.get("recommendations", [])
    if recommendations:
        elements.append(Paragraph("PREPORUKE RUKOVODSTVU", styles["SectionHeader"]))
        for i, rec in enumerate(recommendations, 1):
            elements.append(Paragraph(f"{i}. {rec}", styles["BulletItem"]))
        elements.append(Spacer(1, 8))

    # ── Outlook ────────────────────────────────────────────────────────────────
    if ai_report.get("outlook"):
        elements.append(Paragraph("OUTLOOK", styles["SectionHeader"]))
        elements.append(Paragraph(ai_report["outlook"], styles["Body"]))

    # ── Red flags ──────────────────────────────────────────────────────────────
    red_flags = ai_report.get("red_flags", [])
    if red_flags:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph("⚠ CRVENE ZASTAVICE", styles["SectionHeader"]))
        for flag in red_flags:
            elements.append(Paragraph(f"⚠ {flag}", styles["BulletItem"]))

    # ── Footer ─────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, cm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=Color(*COLORS["mid_gray"])))
    elements.append(Paragraph(
        f"Generisano: {date.today().strftime('%d.%m.%Y')} | Bilansia — AI Finansijska Analiza | Score verzija 1.0",
        ParagraphStyle("Footer", parent=base["Normal"], fontSize=8,
                       textColor=Color(*COLORS["mid_gray"]), alignment=TA_CENTER),
    ))

    doc.build(elements)
    return buffer.getvalue()


def _score_to_risk_color(risk: str) -> tuple:
    return COLORS.get(risk, COLORS["text"])
