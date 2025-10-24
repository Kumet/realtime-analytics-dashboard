from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True
    )

    app_name: str = "Realtime Analytics Dashboard"
    app_env: str = Field(default="local", alias="APP_ENV")
    secret_key: str = Field(default="change-this", alias="SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(
        default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    cors_origins: List[str] | str = Field(
        default="http://localhost:5173", alias="CORS_ORIGINS"
    )

    database_url_override: str | None = Field(default=None, alias="DATABASE_URL")
    postgres_host: str = Field(default="db", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="radb", alias="POSTGRES_DB")
    postgres_user: str = Field(default="radb", alias="POSTGRES_USER")
    postgres_password: str = Field(default="radb", alias="POSTGRES_PASSWORD")

    redis_host: str = Field(default="redis", alias="REDIS_HOST")
    redis_port: int = Field(default=6379, alias="REDIS_PORT")

    demo_user_email: str = Field(default="admin@example.com", alias="DEMO_USER_EMAIL")
    demo_user_hashed_password: str = Field(
        default="$2b$12$/qMunNIRjzSP9qSxbWJLSuGcLKY1sxYLXXBGWcolDEVGfl78e.OFW",
        alias="DEMO_USER_HASHED_PASSWORD",
    )
    demo_user_role: str = Field(default="admin", alias="DEMO_USER_ROLE")

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value: str | List[str] | None) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return list(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
