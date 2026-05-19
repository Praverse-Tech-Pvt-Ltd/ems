from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    confidence_threshold: float = 0.55  # cosine similarity threshold (0–1)

    class Config:
        env_file = ".env"


settings = Settings()
