
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Infrastructure (required)
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/threatdex"
    REDIS_URL: str = "redis://localhost:6379"

    # Admin
    ADMIN_SECRET: str = "changeme"

    # CTI sources (optional — feature-flagged)
    OTX_API_KEY: str | None = None
    SOCRADAR_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    MISP_URL: str | None = None
    MISP_API_KEY: str | None = None
    OPENCTI_URL: str | None = None
    OPENCTI_API_KEY: str | None = None

    # App settings
    LOG_LEVEL: str = "info"
    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
