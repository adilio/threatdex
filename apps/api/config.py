from typing import List, Optional

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
    OTX_API_KEY: Optional[str] = None
    SOCRADAR_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    MISP_URL: Optional[str] = None
    MISP_API_KEY: Optional[str] = None
    OPENCTI_URL: Optional[str] = None
    OPENCTI_API_KEY: Optional[str] = None

    # App settings
    LOG_LEVEL: str = "info"
    CORS_ORIGINS: List[str] = ["*"]


settings = Settings()
