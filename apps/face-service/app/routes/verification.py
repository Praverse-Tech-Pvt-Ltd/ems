from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.face_service import verify_deepface
from app.config import settings

router = APIRouter()


class VerifyRequest(BaseModel):
    employee_id: str
    face_image: str  # Base64-encoded face image


class VerifyResponse(BaseModel):
    verified: bool
    confidence: float
    reason: str | None = None


@router.post("", response_model=VerifyResponse)
async def verify_face(request: VerifyRequest) -> VerifyResponse:
    try:
        if settings.fr_provider == "deepface":
            result = verify_deepface(request.employee_id, request.face_image)
        else:
            raise HTTPException(status_code=501, detail=f"Provider {settings.fr_provider} not implemented")

        return VerifyResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
