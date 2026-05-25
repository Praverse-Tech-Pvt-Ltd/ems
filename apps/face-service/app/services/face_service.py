import base64
import io
import logging
from typing import Optional
import uuid

import numpy as np
import torch
from PIL import Image
from facenet_pytorch import MTCNN, InceptionResnetV1

import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model — loaded once at import time
# ---------------------------------------------------------------------------

_device = torch.device("cpu")
_mtcnn  = MTCNN(image_size=160, margin=20, keep_all=False, device=_device)

# .eval() sets PyTorch inference mode (disables dropout / training batch-norm)
_resnet = InceptionResnetV1(pretrained="vggface2")
_resnet = _resnet.eval().to(_device)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn():
    conn = psycopg2.connect(settings.database_url)
    register_vector(conn)
    return conn


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def pil_from_bytes(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


def pil_from_base64(b64: str) -> Image.Image:
    if "," in b64:
        b64 = b64.split(",")[1]
    return pil_from_bytes(base64.b64decode(b64))


def encode_face(image: Image.Image) -> Optional[list]:
    """Return 512-d FaceNet embedding or None if no face is detected."""
    face_tensor = _mtcnn(image)
    if face_tensor is None:
        return None
    with torch.no_grad():
        embedding = _resnet(face_tensor.unsqueeze(0).to(_device))
    return embedding[0].tolist()


# ---------------------------------------------------------------------------
# Public service functions used by route handlers
# ---------------------------------------------------------------------------

def _upsert_embedding(employee_id: str, embedding: list[float]) -> None:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            record_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO face_embeddings (id, employee_id, embedding, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (employee_id)
                DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()
                """,
                (record_id, employee_id, embedding),
            )
            conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error("DB error during register: %s", exc)
        raise ConnectionError("Database error") from exc
    finally:
        conn.close()


def register(employee_id: str, image: Image.Image) -> None:
    """
    Encode the face in *image* and upsert its 512-d embedding in the DB.
    Raises RuntimeError if no face is found.
    Raises ConnectionError on DB failure.
    """
    embedding = encode_face(image)
    if embedding is None:
        raise RuntimeError("No face detected in the image")

    _upsert_embedding(employee_id, embedding)


def enroll(employee_id: str, frames: list[str]) -> None:
    """
    Encode several base64 frames and store their averaged 512-d embedding.
    At least one frame must contain a detectable face.
    """
    embeddings = []
    for frame in frames:
        image = pil_from_base64(frame)
        embedding = encode_face(image)
        if embedding is not None:
            embeddings.append(embedding)

    if not embeddings:
        raise RuntimeError("No face detected in any captured frame")

    averaged = np.mean(np.array(embeddings, dtype=np.float32), axis=0)
    norm = np.linalg.norm(averaged)
    if norm > 0:
        averaged = averaged / norm

    _upsert_embedding(employee_id, averaged.astype(float).tolist())


def recognize(image: Image.Image) -> dict:
    """
    Find the closest registered employee to the face in *image*.
    Returns { success, employee_id, confidence, message }.
    """
    embedding = encode_face(image)
    if embedding is None:
        return {"success": False, "employee_id": None, "confidence": None,
                "message": "No face detected in the image"}

    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT employee_id, 1 - (embedding <=> %s::vector) AS confidence
                FROM face_embeddings
                ORDER BY embedding <=> %s::vector
                LIMIT 1
                """,
                (embedding, embedding),
            )
            row = cur.fetchone()
    except Exception as exc:
        logger.error("DB error during recognize: %s", exc)
        raise ConnectionError("Database error") from exc
    finally:
        conn.close()

    if row is None:
        return {"success": False, "employee_id": None, "confidence": None,
                "message": "No registered faces found"}

    confidence = float(row["confidence"])
    threshold  = 1 - settings.recognition_threshold
    if confidence < threshold:
        return {"success": False, "employee_id": None, "confidence": confidence,
                "message": f"No match found (best confidence: {confidence:.2f})"}

    return {"success": True, "employee_id": row["employee_id"], "confidence": confidence,
            "message": "Employee identified successfully"}


def verify(employee_id: str, image: Image.Image) -> dict:
    """
    Compare *image* against the stored embedding for *employee_id*.
    Returns { success, match, confidence, message }.
    """
    embedding = encode_face(image)
    if embedding is None:
        return {"success": False, "match": False, "confidence": None,
                "message": "No face detected"}

    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT 1 - (embedding <=> %s::vector) AS confidence
                FROM face_embeddings
                WHERE employee_id = %s
                """,
                (embedding, employee_id),
            )
            row = cur.fetchone()
    except Exception as exc:
        logger.error("DB error during verify: %s", exc)
        raise ConnectionError("Database error") from exc
    finally:
        conn.close()

    if row is None:
        raise LookupError(f"Employee {employee_id} face not registered")

    confidence = float(row["confidence"])
    matched    = confidence >= (1 - settings.recognition_threshold)
    return {
        "success": True, "match": matched, "confidence": confidence,
        "message": "Match" if matched else "No match",
    }


def delete(employee_id: str) -> int:
    """Remove the stored embedding for *employee_id*. Returns rows deleted."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM face_embeddings WHERE employee_id = %s", (employee_id,))
            deleted = cur.rowcount
            conn.commit()
    except Exception as exc:
        conn.rollback()
        raise ConnectionError("Database error") from exc
    finally:
        conn.close()
    return deleted
