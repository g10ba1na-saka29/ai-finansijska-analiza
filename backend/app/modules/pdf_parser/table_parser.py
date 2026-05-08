"""
camelot-based ekstrakcija tabela iz finansijskih PDF-ova.
Pokušava lattice mode (tabele sa linijama), pa fallback na stream.
"""

import logging
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)


def _tables_to_dicts(tables) -> list[dict[str, Any]]:
    result = []
    for i, table in enumerate(tables):
        df: pd.DataFrame = table.df
        if df.empty or df.shape[0] < 2:
            continue
        # Prva kolona kao index (nazivi stavki), ostale kolone su godine/periodi
        df.columns = df.iloc[0]
        df = df[1:].reset_index(drop=True)
        df = df.dropna(how="all")
        result.append({
            "table_index": i,
            "accuracy": round(table.parsing_report.get("accuracy", 0), 2),
            "rows": df.to_dict(orient="records"),
            "shape": list(df.shape),
        })
    return result


def extract_tables_camelot(file_path: str) -> list[dict[str, Any]]:
    try:
        import camelot
    except ImportError:
        logger.warning("camelot nije instaliran, preskačem ekstrakciju tabela")
        return []

    # Lattice — za tabele sa vidljivim linijama (tipično za štampane finansijske izvještaje)
    try:
        tables = camelot.read_pdf(file_path, flavor="lattice", pages="all")
        if tables.n > 0:
            logger.info(f"camelot lattice: {tables.n} tabela pronađeno")
            return _tables_to_dicts(tables)
    except Exception as e:
        logger.warning(f"camelot lattice failed: {e}")

    # Stream — fallback za tabele bez linija (whitespace-based)
    try:
        tables = camelot.read_pdf(file_path, flavor="stream", pages="all", edge_tol=50)
        logger.info(f"camelot stream: {tables.n} tabela pronađeno")
        return _tables_to_dicts(tables)
    except Exception as e:
        logger.warning(f"camelot stream failed: {e}")
        return []
