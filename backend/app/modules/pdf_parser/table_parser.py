"""
camelot-based ekstrakcija tabela iz finansijskih PDF-ova.
Pokušava lattice mode (tabele sa linijama), pa fallback na stream.

Posebna podrška za BiH bilans stanja gdje camelot može kreirati
višelinijska zaglavlja koja sadrže i header i prve podatke.
"""

import re
import logging
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

# Poznate header riječi BiH bilansa stanja
_BILANS_HDR_WORDS = frozenset({
    'pozicija', 'aop', 'nap', 'bruto', 'ispravka', 'neto', 'prethodna',
    'gruparanuna', 'gruparacuna', 'tekuna', 'tekuca', 'godina', 'vrijednosti',
})


def _dedup_columns(cols):
    """Preimenuje duplikate kolona dodavanjem _1, _2 sufiksa."""
    seen: dict[str, int] = {}
    result = []
    for c in cols:
        c = str(c).strip() if c else ""
        if c in seen:
            seen[c] += 1
            result.append(f"{c}_{seen[c]}")
        else:
            seen[c] = 0
            result.append(c)
    return result


def _is_bilans_header_line(line: str) -> bool:
    """Provjeri da li linija izgleda kao zaglavlje kolone bilansa stanja."""
    l = re.sub(r'[^\w]', '', line.lower().strip())
    return any(kw in l for kw in _BILANS_HDR_WORDS)


def _split_multiline_header(cell: str) -> tuple[str, str | None]:
    """
    Za višelinijsku ćeliju zaglavlja: odvoji ime kolone od ugrađenih podataka.

    Vraća (ime_kolone, ugrađeni_podaci_ili_None).
    Ugrađeni podaci su prisutni kada zaglavlje sadrži i header linije I
    podatke prvog reda (kratki numerici + duge labele).
    """
    if '\n' not in cell:
        return cell.strip(), None

    lines = [l.strip() for l in cell.split('\n') if l.strip()]

    # Pronađi gdje header završava a podaci počinju
    # Podaci počinju kada vidimo kratak numerik praćen dugom labelom
    data_start: int | None = None
    for i, line in enumerate(lines):
        if re.match(r'^\d{1,3}$', line) and i > 0:
            next_is_label = (
                i + 1 < len(lines)
                and len(lines[i + 1]) > 8
                and not re.match(r'^[\d.,()+-]+$', lines[i + 1])
            )
            if next_is_label:
                data_start = i
                break

    if data_start is None:
        # Nema ugrađenih podataka — koristi prvu prepoznatljivu header liniju
        for line in lines:
            if _is_bilans_header_line(line):
                return line, None
        return lines[0], None

    # Ime kolone = posljednja header linija prije podataka
    col_name = lines[0]
    for line in lines[:data_start]:
        if _is_bilans_header_line(line):
            col_name = line

    embedded = '\n'.join(lines[data_start:])
    return col_name, embedded


def _tables_to_dicts(tables) -> list[dict[str, Any]]:
    result = []
    for i, table in enumerate(tables):
        df: pd.DataFrame = table.df
        if df.empty or df.shape[0] < 2:
            continue

        first_row_vals = [str(c).strip() for c in df.iloc[0]]
        has_multiline = any('\n' in v for v in first_row_vals)

        if has_multiline:
            # Višelinijska zaglavlja: odvoji ime kolone od ugrađenih podataka
            clean_names: list[str] = []
            synthetic: dict[int, str] = {}

            for j, val in enumerate(first_row_vals):
                col_name, embedded = _split_multiline_header(val)
                clean_names.append(col_name)
                if embedded:
                    synthetic[j] = embedded

            deduped = _dedup_columns(clean_names)
            df.columns = deduped
            df = df[1:].reset_index(drop=True)

            # Dodaj sintetički prvi red ako je bio ugrađen u zaglavlje
            if synthetic:
                syn_row = {col: synthetic.get(j, '') for j, col in enumerate(deduped)}
                syn_df = pd.DataFrame([syn_row])
                df = pd.concat([syn_df, df], ignore_index=True)
                logger.debug(f"Tabela {i}: ugrađeni prvi red iz zaglavlja ekstrahovan")

        else:
            raw_cols = [str(c).strip() for c in df.iloc[0]]
            df.columns = _dedup_columns(raw_cols)
            df = df[1:].reset_index(drop=True)

        df = df.dropna(how="all")

        result.append({
            "table_index": i,
            "accuracy": round(table.parsing_report.get("accuracy", 0), 2),
            "rows": df.to_dict(orient="records"),
            "shape": list(df.shape),
            "columns": list(df.columns),
        })
    return result


def extract_tables_camelot(file_path: str) -> list[dict[str, Any]]:
    try:
        import camelot
    except ImportError:
        logger.warning("camelot nije instaliran, preskačem ekstrakciju tabela")
        return []

    # Lattice — za tabele sa vidljivim linijama
    try:
        tables = camelot.read_pdf(file_path, flavor="lattice", pages="all")
        if tables.n > 0:
            logger.info(f"camelot lattice: {tables.n} tabela pronađeno")
            return _tables_to_dicts(tables)
    except Exception as e:
        logger.warning(f"camelot lattice failed: {e}")

    # Stream — fallback za tabele bez linija
    try:
        tables = camelot.read_pdf(file_path, flavor="stream", pages="all", edge_tol=50)
        logger.info(f"camelot stream: {tables.n} tabela pronađeno")
        return _tables_to_dicts(tables)
    except Exception as e:
        logger.warning(f"camelot stream failed: {e}")
        return []
