import base64
import io
import logging

import face_recognition
import numpy as np
import psycopg2
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn():
    return psycopg2.connect(settings.database_url)


def _ensure_pgvector(conn) -> None:
    """Enable pgvector extension if not already present."""
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    conn.commit()


def _ensure_column(conn) -> None:
    """Add face_vector column (vector(128)) if it doesn't exist yet."""
    with conn.cursor() as cur:
        cur.execute("""
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS face_vector vector(128);
        """)
    conn.commit()


def _bootstrap_db(conn) -> None:
    _ensure_pgvector(conn)
    _ensure_column(conn)


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _b64_to_rgb_array(b64_string: str) -> np.ndarray:
    """Decode a base64 image (with or without data-URL prefix) to an RGB numpy array."""
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    raw = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def _extract_embedding(image_array: np.ndarray) -> np.ndarray | None:
    """Return 128-d face embedding or None if no face detected."""
    locations = face_recognition.face_locations(image_array, model="hog")
    if not locations:
        return None
    encodings = face_recognition.face_encodings(image_array, locations)
    if not encodings:
        return None
    return encodings[0]  # first face found


# ---------------------------------------------------------------------------
# Public API used by routes
# ---------------------------------------------------------------------------

def enroll(employee_id: str, frames: list[str]) -> None:
    """
    Extract face embeddings from provided frames, average them for robustness,
    and store the result as a vector(128) in Neon.
    Raises RuntimeError if no face is found in any frame.
    """
    embeddings = []
    for frame_b64 in frames:
        try:
            arr = _b64_to_rgb_array(frame_b64)
            emb = _extract_embedding(arr)
            if emb is not None:
                embeddings.append(emb)
        except Exception as exc:
            logger.warning("Failed to process frame during enroll: %s", exc)

    if not embeddings:
        raise RuntimeError("No face detected in any of the provided frames")

    # Average all good embeddings → more stable representation
    final_embedding = np.mean(embeddings, axis=0)
    vector_str = "[" + ",".join(f"{v:.8f}" for v in final_embedding.tolist()) + "]"

    conn = _get_conn()
    try:
        _bootstrap_db(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE employees
                SET face_vector  = %s::vector,
                    face_enrolled = TRUE
                WHERE id = %s
                """,
                (vector_str, employee_id),
            )
            if cur.rowcount == 0:
                raise RuntimeError(f"Employee {employee_id} not found")
        conn.commit()
    finally:
        conn.close()

    logger.info("Enrolled face for employee %s using %d frame(s)", employee_id, len(embeddings))


def verify(employee_id: str, face_image_b64: str) -> dict:
    """
    Compare the submitted face image against the stored embedding.
    Returns { verified, confidence, reason }.
    confidence is the cosine similarity (0–1).
    """
    conn = _get_conn()
    try:
        _bootstrap_db(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT face_vector FROM employees WHERE id = %s",
                (employee_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row or row[0] is None:
        return {"verified": False, "confidence": 0.0, "reason": "No enrolled face found for this employee"}

    # psycopg2 returns the pgvector value as a string like '[0.1,0.2,...]'
    stored_raw = row[0]
    if isinstance(stored_raw, str):
        stored_vec = np.array([float(x) for x in stored_raw.strip("[]").split(",")])
    else:
        stored_vec = np.array(stored_raw)

    try:
        arr = _b64_to_rgb_array(face_image_b64)
    except Exception as exc:
        return {"verified": False, "confidence": 0.0, "reason": f"Invalid image: {exc}"}

    live_emb = _extract_embedding(arr)
    if live_emb is None:
        return {"verified": False, "confidence": 0.0, "reason": "No face detected in submitted image"}

    # Cosine similarity between the two 128-d unit vectors
    norm_stored = stored_vec / (np.linalg.norm(stored_vec) + 1e-10)
    norm_live = live_emb / (np.linalg.norm(live_emb) + 1e-10)
    similarity = float(np.dot(norm_stored, norm_live))
    similarity = max(0.0, min(1.0, similarity))  # clamp to [0,1]

    verified = similarity >= settings.confidence_threshold
    reason = None if verified else f"Similarity {similarity:.2%} below threshold {settings.confidence_threshold:.0%}"

    return {
        "verified": verified,
        "confidence": round(similarity, 4),
        "reason": reason,
    }
