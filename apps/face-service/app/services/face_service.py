import base64
import io
import json
import logging

import boto3
import psycopg2
from botocore.exceptions import ClientError
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


def _rekognition():
    return boto3.client(
        "rekognition",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def _get_conn():
    return psycopg2.connect(settings.database_url)


def _b64_to_bytes(b64_string: str) -> bytes:
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    raw = base64.b64decode(b64_string)
    # Normalise to JPEG bytes that Rekognition accepts
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def ensure_collection() -> None:
    client = _rekognition()
    try:
        client.describe_collection(CollectionId=settings.rekognition_collection_id)
    except client.exceptions.ResourceNotFoundException:
        client.create_collection(CollectionId=settings.rekognition_collection_id)
        logger.info("Created Rekognition collection: %s", settings.rekognition_collection_id)


def _save_face_id(employee_id: str, face_id: str) -> None:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE employees SET face_embedding = %s, face_enrolled = TRUE WHERE id = %s",
                (json.dumps({"rekognition_face_id": face_id}), employee_id),
            )
        conn.commit()
    finally:
        conn.close()


def _load_face_id(employee_id: str) -> str | None:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT face_embedding FROM employees WHERE id = %s", (employee_id,))
            row = cur.fetchone()
            if not row or row[0] is None:
                return None
            data = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            return data.get("rekognition_face_id")
    finally:
        conn.close()


def enroll(employee_id: str, frames: list[str]) -> None:
    ensure_collection()
    client = _rekognition()

    # Delete any previously indexed face for this employee
    old_face_id = _load_face_id(employee_id)
    if old_face_id:
        try:
            client.delete_faces(
                CollectionId=settings.rekognition_collection_id,
                FaceIds=[old_face_id],
            )
        except ClientError:
            pass

    # Index the best-quality frame (use first frame; Rekognition picks the best face)
    best_face_id: str | None = None
    for frame_b64 in frames:
        img_bytes = _b64_to_bytes(frame_b64)
        try:
            response = client.index_faces(
                CollectionId=settings.rekognition_collection_id,
                Image={"Bytes": img_bytes},
                ExternalImageId=employee_id,
                DetectionAttributes=[],
                MaxFaces=1,
                QualityFilter="AUTO",
            )
            if response.get("FaceRecords"):
                best_face_id = response["FaceRecords"][0]["Face"]["FaceId"]
                break
        except ClientError as e:
            logger.warning("index_faces failed for frame: %s", e)
            continue

    if not best_face_id:
        raise RuntimeError("No face detected in any of the provided frames")

    _save_face_id(employee_id, best_face_id)


def verify(employee_id: str, face_image_b64: str) -> dict:
    stored_face_id = _load_face_id(employee_id)
    if not stored_face_id:
        return {"verified": False, "confidence": 0.0, "reason": "No enrolled face found"}

    ensure_collection()
    client = _rekognition()
    img_bytes = _b64_to_bytes(face_image_b64)

    try:
        response = client.search_faces_by_image(
            CollectionId=settings.rekognition_collection_id,
            Image={"Bytes": img_bytes},
            MaxFaces=1,
            FaceMatchThreshold=70.0,  # Rekognition similarity threshold (0-100)
        )
    except client.exceptions.InvalidParameterException:
        return {"verified": False, "confidence": 0.0, "reason": "No face detected in image"}
    except ClientError as e:
        raise RuntimeError(f"Rekognition error: {e}")

    matches = response.get("FaceMatches", [])
    if not matches:
        return {"verified": False, "confidence": 0.0, "reason": "No matching face found"}

    top = matches[0]
    if top["Face"]["FaceId"] != stored_face_id:
        return {"verified": False, "confidence": 0.0, "reason": "Face does not match enrolled employee"}

    similarity = top["Similarity"]  # 0–100
    confidence = round(similarity / 100, 4)
    verified = similarity >= 80.0  # require 80% similarity

    return {
        "verified": verified,
        "confidence": confidence,
        "reason": None if verified else f"Similarity too low: {similarity:.1f}%",
    }
