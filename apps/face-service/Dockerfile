FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only torch from PyTorch index
RUN pip install --no-cache-dir \
    torch==2.6.0+cpu \
    torchvision==0.21.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# facenet-pytorch installed with --no-deps: its torch<2.3 pin is stale but the code is compatible
RUN pip install --no-cache-dir --no-deps facenet-pytorch==2.6.0

# Install remaining deps
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    "uvicorn[standard]==0.30.6" \
    python-multipart==0.0.9 \
    "numpy>=1.24,<2.0" \
    "requests>=2.0.0,<3.0.0" \
    "tqdm>=4.0.0,<5.0.0" \
    opencv-python-headless==4.10.0.84 \
    "psycopg2-binary>=2.9.9" \
    pgvector==0.3.2 \
    pydantic-settings==2.3.4 \
    python-dotenv==1.0.1 \
    "Pillow==10.2.0"

COPY apps/face-service/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
