# ── DLL search path fix for Windows Store Python ──────────────────────────
# torch_python.dll links against python313.dll which lives inside the Windows
# Store AppX sandbox folder.  That folder is NOT on the default DLL search path,
# so os.add_dll_directory() must register it before any torch import happens.
import os, sys
if sys.platform == "win32":
    _python_dir = getattr(sys, "base_prefix", "")
    if _python_dir and os.path.isdir(_python_dir):
        os.add_dll_directory(_python_dir)
# ────────────────────────────────────────────────────────────────────────────

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
app.include_router(register.compat_router, prefix="",        tags=["compat"])
app.include_router(recognition.router,  prefix="",           tags=["recognition"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "face-recognition", "model": "facenet-vggface2"}
