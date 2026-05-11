FROM python:3.12-slim

# Build tools + Ghostscript + OpenCV deps (for camelot-py[cv])
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    ghostscript \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    # Tesseract OCR + bosanski/srpski/hrvatski jezici
    tesseract-ocr \
    tesseract-ocr-bos \
    tesseract-ocr-srp \
    tesseract-ocr-hrv \
    tesseract-ocr-deu \
    # poppler-utils — potrebno za pdf2image (PDF → slike za OCR)
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads
