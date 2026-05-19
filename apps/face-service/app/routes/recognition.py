from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services import face_service
from app.services.face_service import pil_from_base64

router = APIRouter()


class RecognizeRequest(BaseModel):
    image_base64: str


class RecognizeResponse(BaseModel):
    success: bool
    employee_id: Optional[str] = None
    confidence: Optional[float] = None
    message: str


class VerifyRequest(BaseModel):
    employee_id: str
    image_base64: str


class VerifyResponse(BaseModel):
    success: bool
    match: bool
    confidence: Optional[float] = None
    message: str


@router.post("/recognize", response_model=RecognizeResponse)
def recognize_face(payload: RecognizeRequest) -> RecognizeResponse:
    try:
        image = pil_from_base64(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    try:
        result = face_service.recognize(image)
    except ConnectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RecognizeResponse(**result)


@router.post("/verify", response_model=VerifyResponse)
def verify_face(payload: VerifyRequest) -> VerifyResponse:
    try:
        image = pil_from_base64(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    try:
        result = face_service.verify(payload.employee_id, image)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return VerifyResponse(**result)
