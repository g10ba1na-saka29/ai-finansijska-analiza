"""
Glavni entry point za PDF ekstrakciju.
Kombinuje camelot (tabele) + pdfplumber (tekst) i normalizuje rezultate.
"""

import logging
from typing import Any

from app.modules.pdf_parser.table_parser import extract_tables_camelot
from app.modules.pdf_parser.text_parser import extract_text
from app.modules.pdf_parser.normalizer import normalize_table

logger = logging.getLogger(__name__)


def extract_financial_data(file_path: str) -> dict[str, Any]:
    """
    Vraća strukturirani dict sa tabelama, tekstom i metapodacima.

    Struktura outputa:
    {
        "tables": [...],           # Lista normalizovanih tabela
        "text": {...},             # Tekst + metapodaci
        "summary": {...}           # Kratak pregled ekstrakcije
    }
    """
    logger.info(f"Počinjem ekstrakciju: {file_path}")

    tables_raw = extract_tables_camelot(file_path)
    text_data = extract_text(file_path)

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
            "extraction_method": "camelot+pdfplumber",
        },
    }
