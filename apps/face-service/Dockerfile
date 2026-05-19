FROM python:3.11-slim

WORKDIR /app

# Build deps for dlib (required by face_recognition).
# Kept in a single layer — only re-runs when this changes.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first so Docker caches the pip install layer.
# Dlib compiles here (~10 min first time); subsequent deploys skip this
# layer entirely if requirements.txt hasn't changed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code last — changes here don't bust the pip cache.
COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
