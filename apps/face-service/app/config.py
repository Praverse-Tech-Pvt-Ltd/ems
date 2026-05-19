from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    recognition_threshold: float = 0.5  # cosine-distance threshold (lower = stricter)

    class Config:
        env_file = ".env"


settings = Settings()
