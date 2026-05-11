"""
Glavni entry point za PDF ekstrakciju.
Redosljed pokušaja:
  1. camelot lattice  — PDF sa tabelama i linijama
  2. camelot stream   — PDF sa tabelama bez linija (whitespace)
  3. Tesseract OCR    — skenirani PDF (fotografije/slike)
"""

import logging
from typing import Any

from app.modules.pdf_parser.table_parser import extract_tables_camelot
from app.modules.pdf_parser.text_parser import extract_text
from app.modules.pdf_parser.normalizer import normalize_table

logger = logging.getLogger(__name__)


def _is_scanned(text_data: dict, tables: list) -> bool:
    """
    Heuristika: PDF je skeniran ako nema tabela i ima malo teksta.
    """
    if tables:
        return False
    raw_text = text_data.get("raw_text", "") or text_data.get("preview", "")
    # Manje od 100 znakova teksta = vjerovatno skenirani PDF
    return len(raw_text.strip()) < 100


def extract_financial_data(file_path: str) -> dict[str, Any]:
    """
    Vraća strukturirani dict sa tabelama, tekstom i metapodacima.

    Struktura outputa:
    {
        "tables": [...],       # Lista normalizovanih tabela
        "text": {...},         # Tekst + metapodaci
        "summary": {...}       # Pregled ekstrakcije
    }
    """
    logger.info(f"Počinjem ekstrakciju: {file_path}")

    # ── Korak 1: camelot (lattice + stream fallback) ───────────────────────────
    tables_raw = extract_tables_camelot(file_path)
    text_data = extract_text(file_path)

    extraction_method = "camelot+pdfplumber"

    # ── Korak 2: OCR fallback za skenirane PDF-ove ────────────────────────────
    if _is_scanned(text_data, tables_raw):
        logger.info("Detektovan skenirani PDF — pokrećem OCR (Tesseract)")
        try:
            from app.modules.pdf_parser.ocr_parser import (
                extract_tables_ocr,
                extract_text_ocr,
            )
            tables_raw = extract_tables_ocr(file_path)
            ocr_text = extract_text_ocr(file_path)

            # Spoji OCR tekst sa pdfplumber metapodacima
            text_data = {
                **text_data,
                "raw_text": ocr_text.get("raw_text", ""),
                "detected_years": ocr_text.get("detected_years", text_data.get("detected_years", [])),
                "ocr": True,
            }
            extraction_method = "ocr_tesseract"
            logger.info(f"OCR završen: {len(tables_raw)} tabela, {len(text_data.get('raw_text',''))} znakova")

        except Exception as e:
            logger.error(f"OCR fallback greška: {e}")

    # ── Korak 3: Normalizacija ─────────────────────────────────────────────────
    normalized_tables = []
    for table in tables_raw:
        normalized_rows = [normalize_table(row) for row in table.get("rows", [])]
        normalized_tables.append({
            **table,
            "rows_normalized": normalized_rows,
        })

    return {
        "tables": normalized_tables,
        "text": text_data,
        "summary": {
            "tables_found": len(normalized_tables),
            "pages": text_data.get("page_count", 0),
            "detected_years": text_data.get("detected_years", []),
            "extraction_method": extraction_method,
            "ocr_used": extraction_method == "ocr_tesseract",
        },
    }
