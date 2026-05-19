FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only torch first from the PyTorch index to avoid downloading CUDA builds
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu \
    torchvision==0.17.2+cpu \
    --index-url https://download.pytorch.org/whl/cpu

COPY apps/face-service/requirements.txt .
# Skip torch/torchvision in main install since already installed above
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    "uvicorn[standard]==0.30.6" \
    python-multipart==0.0.9 \
    "numpy==1.26.4" \
    opencv-python-headless==4.10.0.84 \
    facenet-pytorch==2.6.0 \
    psycopg2-binary==2.9.9 \
    pgvector==0.3.2 \
    python-dotenv==1.0.1 \
    "Pillow==10.4.0"

COPY apps/face-service/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
