from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.face_service import enroll

router = APIRouter()


class EnrollRequest(BaseModel):
    employee_id: str
    frames: list[str]


class EnrollResponse(BaseModel):
    success: bool
    message: str


@router.post("", response_model=EnrollResponse)
async def enroll_face(request: EnrollRequest) -> EnrollResponse:
    if len(request.frames) < 1:
        raise HTTPException(status_code=400, detail="At least 1 frame required")
    try:
        enroll(request.employee_id, request.frames)
        return EnrollResponse(success=True, message="Face enrolled successfully via AWS Rekognition")
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
