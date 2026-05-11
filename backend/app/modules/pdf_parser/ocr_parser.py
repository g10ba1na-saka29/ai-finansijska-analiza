"""
OCR fallback za skenirane PDF-ove (fotografije/slike umjesto teksta).
Koristi pdf2image + Tesseract za ekstrakciju teksta i tabela.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Jezici kojima Tesseract pokušava prepoznati tekst (BOS/SRP/HRV + ENG fallback)
OCR_LANGS = "bos+srp+hrv+deu+eng"


def _parse_ocr_line(line: str) -> dict[str, Any] | None:
    """
    Pokušava parsirati jednu liniju OCR teksta kao finansijsku stavku.
    Format: 'Naziv stavke  123.456  234.567'
    Vraća dict sa label + vrijednostima ili None ako nije finansijska linija.
    """
    line = line.strip()
    if not line or len(line) < 4:
        return None

    # Ukloni višestruke razmake
    line = re.sub(r" {2,}", "  ", line)

    # Pattern: tekst + jedan ili više numeričkih tokena
    # Broj format: 1.234.567 ili 1,234,567 ili 1234567 ili -123.456
    number_pattern = r"-?[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|-?\d+"
    numbers = re.findall(number_pattern, line)

    if not numbers:
        return None

    # Label je sve što nije broj
    label_part = re.sub(number_pattern, "", line).strip(" .,;:-")
    if len(label_part) < 2:
        return None

    # Parsiranje brojeva — BiH format (tačka = separator hiljade, zarez = decimale)
    def parse_num(s: str) -> float | None:
        s = s.strip()
        if not s:
            return None
        try:
            # Provjeri da li je BiH format (1.234.567,89) ili EN (1,234,567.89)
            if "," in s and "." in s:
                if s.rindex(".") < s.rindex(","):
                    # BiH: 1.234,56
                    s = s.replace(".", "").replace(",", ".")
                else:
                    # EN: 1,234.56
                    s = s.replace(",", "")
            elif "," in s:
                # Vjerovatno BiH decimalna: 1234,56
                s = s.replace(",", ".")
            elif s.count(".") > 1:
                # 1.234.567 → hiljade separator
                s = s.replace(".", "")
            return float(s)
        except ValueError:
            return None

    parsed_numbers = [parse_num(n) for n in numbers if parse_num(n) is not None]
    if not parsed_numbers:
        return None

    row: dict[str, Any] = {"label": label_part}
    for i, val in enumerate(parsed_numbers[:3]):  # Max 3 kolone (tekuća + prethodne 2 godine)
        row[f"col_{i}"] = val

    return row


def extract_tables_ocr(file_path: str) -> list[dict[str, Any]]:
    """
    Konvertuje PDF stranice u slike, primjeni OCR, i pokuša izvući tabelarne podatke.
    Vraća isti format kao extract_tables_camelot().
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        logger.warning("pdf2image ili pytesseract nisu instalirani")
        return []

    logger.info(f"Pokretanje OCR ekstrakcije: {file_path}")

    try:
        # Konvertuj PDF u slike (300 DPI za dobre rezultate)
        pages = convert_from_path(file_path, dpi=300)
    except Exception as e:
        logger.error(f"pdf2image greška: {e}")
        return []

    all_rows: list[dict] = []

    for page_num, page_img in enumerate(pages, start=1):
        try:
            # OCR sa prioritetnim jezicima
            raw_text = pytesseract.image_to_string(
                page_img,
                lang=OCR_LANGS,
                config="--psm 6",  # PSM 6 = uniform block of text (dobro za tabele)
            )
            logger.info(f"OCR stranica {page_num}: {len(raw_text)} karaktera")

            for line in raw_text.splitlines():
                row = _parse_ocr_line(line)
                if row:
                    row["page"] = page_num
                    all_rows.append(row)

        except Exception as e:
            logger.warning(f"OCR greška na stranici {page_num}: {e}")
            continue

    if not all_rows:
        logger.warning("OCR nije pronašao finansijske podatke")
        return []

    logger.info(f"OCR ukupno: {len(all_rows)} finansijskih redova")

    # Vrati u istom formatu kao camelot
    return [{
        "table_index": 0,
        "accuracy": 0.0,   # OCR nema accuracy score
        "rows": all_rows,
        "shape": [len(all_rows), 2],
        "extraction_method": "ocr_tesseract",
    }]


def extract_text_ocr(file_path: str) -> dict[str, Any]:
    """
    Vraća cijeli OCR tekst iz PDF-a (za LLM kontekst).
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        return {"raw_text": "", "page_count": 0}

    try:
        pages = convert_from_path(file_path, dpi=200)  # Niži DPI za brži tekst
    except Exception as e:
        logger.error(f"pdf2image greška: {e}")
        return {"raw_text": "", "page_count": 0}

    full_text = []
    for page_img in pages:
        try:
            text = pytesseract.image_to_string(page_img, lang=OCR_LANGS, config="--psm 6")
            full_text.append(text)
        except Exception:
            continue

    combined = "\n\n".join(full_text)
    year_pattern = re.compile(r"\b(20\d{2})\b")
    years = sorted(set(int(y) for y in year_pattern.findall(combined)))

    return {
        "raw_text": combined[:8000],  # Max 8000 znakova za LLM
        "page_count": len(pages),
        "detected_years": years,
        "ocr": True,
    }
