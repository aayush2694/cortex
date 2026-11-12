"""App settings, read from environment variables (and a local .env file in development)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Cortex API"
    environment: Literal["dev", "test", "prod"] = "dev"

    database_url: str = "postgresql+asyncpg://localhost:5432/cortex"
    db_echo: bool = False

    # "dev" = one local user, no login. "entra" = Microsoft Entra ID tokens (Phase 2).
    auth_mode: Literal["dev", "entra"] = "dev"

    cors_origins: list[str] = ["http://localhost:4200"]

    # AI tutor. If empty, the Anthropic SDK falls back to its own credential sources.
    anthropic_api_key: str | None = None
    tutor_model: str = "claude-opus-5-5"
    tutor_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    tutor_max_tokens: int = 16000
    tutor_history_turns: int = 20
    # Messages each user may send the tutor per day (UTC); each one is a paid Claude call.
    tutor_daily_limit: int = Field(default=30, ge=1)

    content_dir: str = "content"


@lru_cache
def get_settings() -> Settings:
    return Settings()
