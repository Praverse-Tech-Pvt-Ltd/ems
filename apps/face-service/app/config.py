from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    rekognition_collection_id: str = "nexgen-employees"

    class Config:
        env_file = ".env"


settings = Settings()
