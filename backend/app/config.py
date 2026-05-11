from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Bilansia"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # File upload
    UPLOAD_DIR: str = "/app/uploads"
    MAX_FILE_SIZE_MB: int = 50

    # LLM
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o"
    OPENAI_API_KEY: str = ""

    # Feature flags
    ENABLE_FORECASTING: bool = True
    ENABLE_BENCHMARKS: bool = True

    # Monitoring
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True          # False za development (human-readable)

    # Rate limiting (requests per minute per IP)
    RATE_LIMIT_PER_MINUTE: int = 120
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = 20   # Stricter limit za upload endpoint

    @property
    def SYNC_DATABASE_URL(self) -> str:
        """Sync URL za Alembic i Celery taskove."""
        url = self.DATABASE_URL
        if "+asyncpg" in url:
            return url.replace("+asyncpg", "+psycopg2")
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def MAX_FILE_SIZE_BYTES(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
