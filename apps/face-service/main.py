import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import register, recognition

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="NexGen EMS Face Recognition Service", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(register.router,     prefix="/register",  tags=["register"])
app.include_router(recognition.router,  prefix="",           tags=["recognition"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "face-recognition", "model": "facenet-vggface2"}
