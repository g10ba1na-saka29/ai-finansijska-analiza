"""
pdfplumber-based ekstrakcija teksta i metapodataka.
Koristi se za kontekst, audit nalaze i kao fallback kad camelot ne nađe tabele.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Regex za prepoznavanje finansijskih iznosa (npr. "1.234.567" ili "1,234,567.00")
AMOUNT_PATTERN = re.compile(r"-?\s*[\d]{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?")
YEAR_PATTERN = re.compile(r"\b(20\d{2})\b")


def extract_text(file_path: str) -> dict[str, Any]:
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber nije instaliran")
        return {"pages": [], "metadata": {}}

    pages_text = []
    metadata = {}

    try:
        with pdfplumber.open(file_path) as pdf:
            metadata = pdf.metadata or {}
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages_text.append({"page": i + 1, "text": text})
    except Exception as e:
        logger.error(f"pdfplumber ekstrakcija failed: {e}")

    full_text = " ".join(p["text"] for p in pages_text)

    return {
        "pages": pages_text,
        "full_text": full_text[:5000],  # Prvih 5000 znakova za AI kontekst
        "metadata": {k: str(v) for k, v in metadata.items()},
        "detected_years": list(set(YEAR_PATTERN.findall(full_text))),
        "page_count": len(pages_text),
    }
