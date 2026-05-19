import os
import io
import base64
import logging
from typing import Optional

import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import torch
from facenet_pytorch import MTCNN, InceptionResnetV1

import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Face Recognition Service", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
RECOGNITION_THRESHOLD = float(os.getenv("RECOGNITION_THRESHOLD", "0.5"))

device = torch.device("cpu")
mtcnn = MTCNN(image_size=160, margin=20, keep_all=False, device=device)
resnet = InceptionResnetV1(pretrained="vggface2").eval().to(device)


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    return conn


def pil_from_bytes(file_bytes: bytes) -> Image.Image:
    return Image.open(io.BytesIO(file_bytes)).convert("RGB")


def pil_from_base64(b64_string: str) -> Image.Image:
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    return pil_from_bytes(base64.b64decode(b64_string))


def encode_face(pil_image: Image.Image) -> Optional[list]:
    face_tensor = mtcnn(pil_image)
    if face_tensor is None:
        return None
    with torch.no_grad():
        embedding = resnet(face_tensor.unsqueeze(0).to(device))
    return embedding[0].tolist()


class RegisterRequest(BaseModel):
    employee_id: str
    image_base64: str

class RecognizeRequest(BaseModel):
    image_base64: str

class VerifyRequest(BaseModel):
    employee_id: str
    image_base64: str

class RegisterResponse(BaseModel):
    success: bool
    employee_id: str
    message: str

class RecognizeResponse(BaseModel):
    success: bool
    employee_id: Optional[str] = None
    confidence: Optional[float] = None
    message: str

class VerifyResponse(BaseModel):
    success: bool
    match: bool
    confidence: Optional[float] = None
    message: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "face-recognition", "model": "facenet-vggface2"}


@app.post("/register", response_model=RegisterResponse)
def register_face(payload: RegisterRequest):
    try:
        image = pil_from_base64(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    encoding = encode_face(image)
    if encoding is None:
        raise HTTPException(status_code=422, detail="No face detected in the image")
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO face_embeddings (employee_id, embedding)
                VALUES (%s, %s)
                ON CONFLICT (employee_id)
                DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()
                """,
                (payload.employee_id, encoding),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("DB error during register: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()
    return RegisterResponse(success=True, employee_id=payload.employee_id, message="Face registered successfully")


@app.post("/register/upload", response_model=RegisterResponse)
async def register_face_upload(employee_id: str = Form(...), file: UploadFile = File(...)):
    file_bytes = await file.read()
    try:
        image = pil_from_bytes(file_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    encoding = encode_face(image)
    if encoding is None:
        raise HTTPException(status_code=422, detail="No face detected in the image")
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO face_embeddings (employee_id, embedding)
                VALUES (%s, %s)
                ON CONFLICT (employee_id)
                DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()
                """,
                (employee_id, encoding),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("DB error during register: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()
    return RegisterResponse(success=True, employee_id=employee_id, message="Face registered successfully")


@app.post("/recognize", response_model=RecognizeResponse)
def recognize_face(payload: RecognizeRequest):
    try:
        image = pil_from_base64(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    encoding = encode_face(image)
    if encoding is None:
        return RecognizeResponse(success=False, message="No face detected in the image")
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT employee_id, 1 - (embedding <=> %s::vector) AS confidence
                FROM face_embeddings
                ORDER BY embedding <=> %s::vector
                LIMIT 1
                """,
                (encoding, encoding),
            )
            row = cur.fetchone()
    except Exception as e:
        logger.error("DB error during recognize: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()
    if row is None:
        return RecognizeResponse(success=False, message="No registered faces found")
    confidence = float(row["confidence"])
    if confidence < (1 - RECOGNITION_THRESHOLD):
        return RecognizeResponse(success=False, message=f"No match found (best confidence: {confidence:.2f})")
    return RecognizeResponse(success=True, employee_id=row["employee_id"], confidence=confidence, message="Employee identified successfully")


@app.post("/verify", response_model=VerifyResponse)
def verify_face(payload: VerifyRequest):
    try:
        image = pil_from_base64(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    encoding = encode_face(image)
    if encoding is None:
        return VerifyResponse(success=False, match=False, message="No face detected")
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT 1 - (embedding <=> %s::vector) AS confidence
                FROM face_embeddings
                WHERE employee_id = %s
                """,
                (encoding, payload.employee_id),
            )
            row = cur.fetchone()
    except Exception as e:
        logger.error("DB error during verify: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Employee face not registered")
    confidence = float(row["confidence"])
    matched = confidence >= (1 - RECOGNITION_THRESHOLD)
    return VerifyResponse(success=True, match=matched, confidence=confidence, message="Match" if matched else "No match")


@app.delete("/employee/{employee_id}")
def delete_face(employee_id: str):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM face_embeddings WHERE employee_id = %s", (employee_id,))
            deleted = cur.rowcount
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="No face found for this employee")
    return {"success": True, "message": f"Face data deleted for {employee_id}"}
