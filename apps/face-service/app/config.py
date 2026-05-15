from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    fr_provider: str = "deepface"  # "deepface" | "rekognition"
    aws_region: str = "ap-south-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    # Set to Cloudflare R2 endpoint for free-tier storage, e.g.:
    # https://<account_id>.r2.cloudflarestorage.com
    aws_endpoint_url: Optional[str] = None
    s3_bucket_name: str = "nexgen-ems-dev"
    fr_threshold: float = 0.85
    deepface_model: str = "Facenet"  # Facenet | ArcFace | VGG-Face

    class Config:
        env_file = ".env"


settings = Settings()
