import base64
import io
import json
import os
import tempfile
from typing import Optional

import boto3
import numpy as np
from PIL import Image

from app.config import settings


def base64_to_image(b64_string: str) -> np.ndarray:
    """Decode a base64 image string to a numpy array."""
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def get_vector_s3_key(employee_id: str) -> str:
    return f"employees/{employee_id}/face_vector.json"


def _s3_client():
    kwargs = {"region_name": settings.aws_region}
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url
    return boto3.client("s3", **kwargs)


def save_vector_to_s3(employee_id: str, vector: list[float]) -> None:
    s3 = _s3_client()
    s3.put_object(
        Bucket=settings.s3_bucket_name,
        Key=get_vector_s3_key(employee_id),
        Body=json.dumps(vector),
        ContentType="application/json",
    )


def load_vector_from_s3(employee_id: str) -> Optional[list[float]]:
    s3 = _s3_client()
    try:
        res = s3.get_object(
            Bucket=settings.s3_bucket_name,
            Key=get_vector_s3_key(employee_id),
        )
        return json.loads(res["Body"].read())
    except s3.exceptions.NoSuchKey:
        return None
    except Exception:
        return None


def enroll_deepface(employee_id: str, frames: list[str]) -> None:
    """Generate face embedding from multiple frames and store in S3."""
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
    save_vector_to_s3(employee_id, mean_vector)


def verify_deepface(employee_id: str, face_image_b64: str) -> dict:
    """Verify a live face against the stored embedding."""
    stored_vector = load_vector_from_s3(employee_id)
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
