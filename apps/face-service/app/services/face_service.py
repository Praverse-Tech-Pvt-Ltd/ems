import base64
import io
import json
import os
import tempfile
from typing import Optional

import numpy as np
import psycopg2
from PIL import Image

from app.config import settings


def base64_to_image(b64_string: str) -> np.ndarray:
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def _get_conn():
    return psycopg2.connect(settings.database_url)


def save_embedding(employee_id: str, vector: list[float]) -> None:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE employees SET face_embedding = %s, face_enrolled = TRUE WHERE id = %s',
                (json.dumps(vector), employee_id),
            )
        conn.commit()
    finally:
        conn.close()


def load_embedding(employee_id: str) -> Optional[list[float]]:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT face_embedding FROM employees WHERE id = %s', (employee_id,))
            row = cur.fetchone()
            if row and row[0] is not None:
                return row[0] if isinstance(row[0], list) else json.loads(row[0])
            return None
    finally:
        conn.close()


def enroll_deepface(employee_id: str, frames: list[str]) -> None:
    try:
        from deepface import DeepFace  # type: ignore
    except ImportError:
        raise RuntimeError("deepface is not installed")

    embeddings = []
    for frame_b64 in frames:
        img_array = base64_to_image(frame_b64)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            Image.fromarray(img_array).save(f.name)
            tmp_path = f.name
        try:
            result = DeepFace.represent(
                img_path=tmp_path,
                model_name=settings.deepface_model,
                enforce_detection=True,
            )
            embeddings.append(result[0]["embedding"])
        finally:
            os.unlink(tmp_path)

    mean_vector = np.mean(embeddings, axis=0).tolist()
    save_embedding(employee_id, mean_vector)


def verify_deepface(employee_id: str, face_image_b64: str) -> dict:
    stored_vector = load_embedding(employee_id)
    if stored_vector is None:
        return {"verified": False, "confidence": 0.0, "reason": "No enrolled face found"}

    try:
        from deepface import DeepFace  # type: ignore
    except ImportError:
        raise RuntimeError("deepface is not installed")

    img_array = base64_to_image(face_image_b64)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        Image.fromarray(img_array).save(f.name)
        tmp_path = f.name

    try:
        result = DeepFace.represent(
            img_path=tmp_path,
            model_name=settings.deepface_model,
            enforce_detection=True,
        )
        live_vector = np.array(result[0]["embedding"])
    finally:
        os.unlink(tmp_path)

    stored = np.array(stored_vector)
    cosine_sim = float(
        np.dot(live_vector, stored) / (np.linalg.norm(live_vector) * np.linalg.norm(stored))
    )
    confidence = max(0.0, min(1.0, (cosine_sim + 1) / 2))
    verified = confidence >= settings.fr_threshold

    return {
        "verified": verified,
        "confidence": round(confidence, 4),
        "reason": None if verified else f"Confidence too low: {confidence:.3f}",
    }
