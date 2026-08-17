from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BizChat"
    environment: str = "development"
    debug: bool = True
    secret_key: str = "change-me-to-a-long-random-string"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    database_url: str = (
        "postgresql+asyncpg://bizchat:bizchat@localhost:5432/bizchat"
    )

    # Public URLs (used in verification / OAuth redirects)
    public_api_url: str = "http://localhost:8000"
    public_frontend_url: str = "http://localhost:5173"

    # Google OAuth (login) — separate from Calendar OAuth
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""

    # SMTP (optional). Empty host → console mailer (logs to stdout).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "BizChat <noreply@bizchat.local>"
    smtp_tls: bool = True

    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""

    meta_verify_token: str = "bizchat-verify"
    meta_app_secret: str = ""
    meta_page_access_token: str = ""
    # When Meta webhook has no ?business_id=, bind traffic to this salon (UUID).
    meta_default_business_id: str = ""

    widget_jwt_secret: str = "change-me-widget-secret"

    openai_api_key: str = ""
    google_calendar_enabled: bool = False
    google_calendar_id: str = "primary"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    google_service_account_json: str = ""

    auto_migrate: bool = True
    auto_seed: bool = True

    # Comma-separated emails that always get is_platform_admin on login/seed.
    platform_admin_emails: str = "admin@bizchat.local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def platform_admin_email_set(self) -> set[str]:
        return {
            e.strip().lower()
            for e in self.platform_admin_emails.split(",")
            if e.strip()
        }

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.google_oauth_client_id and self.google_oauth_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
