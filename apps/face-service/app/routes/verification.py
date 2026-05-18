from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.face_service import verify

router = APIRouter()


class VerifyRequest(BaseModel):
    employee_id: str
    face_image: str


class VerifyResponse(BaseModel):
    verified: bool
    confidence: float
    reason: str | None = None


@router.post("", response_model=VerifyResponse)
async def verify_face(request: VerifyRequest) -> VerifyResponse:
    try:
        result = verify(request.employee_id, request.face_image)
        return VerifyResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
