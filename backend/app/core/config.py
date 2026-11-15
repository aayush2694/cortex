"""App settings, read from environment variables (and a local .env file in development)."""

import json
from functools import lru_cache
from typing import Annotated, Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Cortex API"
    environment: Literal["dev", "test", "prod"] = "dev"

    database_url: str = "postgresql+asyncpg://localhost:5432/cortex"
    db_echo: bool = False

    # "dev" = one local user, no login. "jwt" = GitHub/Google sign-in with our own JWTs.
    auth_mode: Literal["dev", "jwt"] = "dev"
    # Signs access tokens in jwt mode; at least 32 bytes.
    jwt_secret: str | None = None
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    # The only place sign-in redirects to.
    frontend_url: str = "http://localhost:4200"
    github_client_id: str | None = None
    github_client_secret: str | None = None
    google_client_id: str | None = None
    google_client_secret: str | None = None
    # Emails allowed to use the AI tutor in jwt mode. Comma-separated or a JSON list.
    tutor_invited_emails: Annotated[list[str], NoDecode] = []

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

    @field_validator("tutor_invited_emails", mode="before")
    @classmethod
    def _split_emails(cls, value: Any) -> Any:
        if isinstance(value, str):
            text = value.strip()
            items = json.loads(text) if text.startswith("[") else text.split(",")
        else:
            items = value
        return [str(e).strip().lower() for e in items if str(e).strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_auth_settings(s: Settings) -> None:
    """Refuse an unsafe jwt-mode configuration. Dev mode needs nothing."""
    if s.auth_mode != "jwt":
        return
    if not s.jwt_secret or len(s.jwt_secret.encode()) < 32:
        raise ValueError("JWT_SECRET must be set to at least 32 bytes when AUTH_MODE=jwt")
    if not s.frontend_url:
        raise ValueError("FRONTEND_URL must be set when AUTH_MODE=jwt")
    github = bool(s.github_client_id and s.github_client_secret)
    google = bool(s.google_client_id and s.google_client_secret)
    if not (github or google):
        raise ValueError(
            "AUTH_MODE=jwt needs at least one sign-in provider with both a client id and secret"
        )
