from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    fr_provider: str = "deepface"
    fr_threshold: float = 0.85
    deepface_model: str = "Facenet"
    database_url: str

    class Config:
        env_file = ".env"


settings = Settings()
