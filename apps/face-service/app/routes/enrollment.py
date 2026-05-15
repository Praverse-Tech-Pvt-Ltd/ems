from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.face_service import enroll_deepface
from app.config import settings

router = APIRouter()


class EnrollRequest(BaseModel):
    employee_id: str
    frames: list[str]  # List of base64-encoded face images


class EnrollResponse(BaseModel):
    success: bool
    message: str


@router.post("", response_model=EnrollResponse)
async def enroll_face(request: EnrollRequest) -> EnrollResponse:
    if len(request.frames) < 1:
        raise HTTPException(status_code=400, detail="At least 1 frame required")

    try:
        if settings.fr_provider == "deepface":
            enroll_deepface(request.employee_id, request.frames)
        else:
            raise HTTPException(status_code=501, detail=f"Provider {settings.fr_provider} not yet implemented")

        return EnrollResponse(success=True, message="Face enrolled successfully")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
