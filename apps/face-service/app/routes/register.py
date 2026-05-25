from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services import face_service
from app.services.face_service import pil_from_base64, pil_from_bytes

router = APIRouter()
compat_router = APIRouter()


class RegisterRequest(BaseModel):
    employee_id: str
    image_base64: str


class EnrollRequest(BaseModel):
    employee_id: str
    frames: list[str]


class RegisterResponse(BaseModel):
    success: bool
    employee_id: str
    message: str


@router.post("", response_model=RegisterResponse)
def register_face(payload: RegisterRequest) -> RegisterResponse:
    try:
        image = pil_from_base64(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    try:
        face_service.register(payload.employee_id, image)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RegisterResponse(success=True, employee_id=payload.employee_id,
                            message="Face registered successfully")


@router.post("/enroll", response_model=RegisterResponse)
@compat_router.post("/enroll", response_model=RegisterResponse)
def enroll_face_compat(payload: EnrollRequest) -> RegisterResponse:
    if not payload.frames:
        raise HTTPException(status_code=400, detail="No frames provided")
    try:
        face_service.enroll(payload.employee_id, payload.frames)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    return RegisterResponse(success=True, employee_id=payload.employee_id,
                            message="Face enrolled successfully")


@router.post("/upload", response_model=RegisterResponse)
async def register_face_upload(
    employee_id: str = Form(...),
    file: UploadFile = File(...),
) -> RegisterResponse:
    file_bytes = await file.read()
    try:
        image = pil_from_bytes(file_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    try:
        face_service.register(employee_id, image)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ConnectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RegisterResponse(success=True, employee_id=employee_id,
                            message="Face registered successfully")


@router.delete("/employee/{employee_id}")
@router.delete("/enroll/employee/{employee_id}")
@compat_router.delete("/enroll/employee/{employee_id}")
def delete_face(employee_id: str) -> dict:
    try:
        deleted = face_service.delete(employee_id)
    except ConnectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if deleted == 0:
        raise HTTPException(status_code=404, detail="No face found for this employee")
    return {"success": True, "message": f"Face data deleted for {employee_id}"}
