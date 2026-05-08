FROM python:3.12-slim

# Ghostscript + OpenCV deps (potrebno za camelot-py[cv])
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads
