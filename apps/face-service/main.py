import os
import io
import base64
import logging
import tempfile
from typing import Optional

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from deepface import DeepFace

import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Face Recognition Service",
    description="Face encoding, registration, and recognition for EMS",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
RECOGNITION_THRESHOLD = float(os.getenv("RECOGNITION_THRESHOLD", "0.5"))

# DeepFace model — Facenet512 gives 512-d embeddings, no C++ needed
MODEL_NAME = "Facenet512"
EMBEDDING_DIM = 512


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    return conn


def image_array_from_bytes(file_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return np.array(image)


def image_array_from_base64(b64_string: str) -> np.ndarray:
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    return image_array_from_bytes(base64.b64decode(b64_string))


def encode_face(image_array: np.ndarray) -> Optional[list]:
    """Return 512-d face embedding using DeepFace/Facenet512, or None if no face."""
    try:
        # DeepFace needs a file path or BGR array — convert RGB→BGR
        bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        result = DeepFace.represent(
            img_path=bgr,
            model_name=MODEL_NAME,
            enforce_detection=True,
            detector_backend="opencv",
        )
        return result[0]["embedding"]
    except Exception as e:
        logger.warning("Face encoding failed: %s", e)
        return None


# ── Request / Response models ──────────────────────────────────────────────

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


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "face-recognition", "model": MODEL_NAME}


@app.post("/register", response_model=RegisterResponse)
def register_face(payload: RegisterRequest):
    try:
        image = image_array_from_base64(payload.image_base64)
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
                DO UPDATE SET embedding = EXCLUDED.embedding,
                              updated_at = NOW()
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

    return RegisterResponse(
        success=True,
        employee_id=payload.employee_id,
        message="Face registered successfully",
    )


@app.post("/register/upload", response_model=RegisterResponse)
async def register_face_upload(
    employee_id: str = Form(...),
    file: UploadFile = File(...),
):
    file_bytes = await file.read()
    try:
        image = image_array_from_bytes(file_bytes)
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
                DO UPDATE SET embedding = EXCLUDED.embedding,
                              updated_at = NOW()
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

    return RegisterResponse(
        success=True,
        employee_id=employee_id,
        message="Face registered successfully",
    )


@app.post("/recognize", response_model=RecognizeResponse)
def recognize_face(payload: RecognizeRequest):
    try:
        image = image_array_from_base64(payload.image_base64)
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
                SELECT employee_id,
                       1 - (embedding <=> %s::vector) AS confidence
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
        return RecognizeResponse(
            success=False,
            message=f"No match found (best confidence: {confidence:.2f})",
        )

    return RecognizeResponse(
        success=True,
        employee_id=row["employee_id"],
        confidence=confidence,
        message="Employee identified successfully",
    )


@app.post("/verify", response_model=VerifyResponse)
def verify_face(payload: VerifyRequest):
    try:
        image = image_array_from_base64(payload.image_base64)
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

    return VerifyResponse(
        success=True,
        match=matched,
        confidence=confidence,
        message="Match" if matched else "No match",
    )


@app.delete("/employee/{employee_id}")
def delete_face(employee_id: str):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM face_embeddings WHERE employee_id = %s",
                (employee_id,),
            )
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
