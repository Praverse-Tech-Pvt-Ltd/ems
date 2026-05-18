import asyncio
import logging
import os

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import enrollment, verification

logger = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# Keep-alive: fires every 14 min to prevent Render free-tier spin-down.
# Only active when RENDER_SELF_URL env var is set. Leave it unset on this
# service and set it only on the API service to stay within the 750 free
# instance-hours/month limit (720 hrs for one 24/7 service).
# ---------------------------------------------------------------------------
async def _keep_alive_loop() -> None:
    self_url = os.getenv("RENDER_SELF_URL", "").rstrip("/")
    if not self_url:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            await asyncio.sleep(14 * 60)
            try:
                await client.get(f"{self_url}/health")
            except Exception:
                logger.warning("Keep-alive ping failed — service may be cold-starting")


@app.on_event("startup")
async def startup() -> None:
    asyncio.create_task(_keep_alive_loop())
