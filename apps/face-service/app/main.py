from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import enrollment, verification

app = FastAPI(
    title="NexGen EMS Face Recognition Service",
    description="Face enrollment and verification microservice",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enrollment.router, prefix="/enroll", tags=["enrollment"])
app.include_router(verification.router, prefix="/verify", tags=["verification"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "face-recognition"}
