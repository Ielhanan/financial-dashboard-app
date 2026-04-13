from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:3000"]
    ws_update_interval_seconds: float = 3.0
    financial_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
