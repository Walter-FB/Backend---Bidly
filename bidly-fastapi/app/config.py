import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    PGHOST: str = "localhost"
    PGPORT: int = 5432
    PGDATABASE: str = "railway"
    PGUSER: str = "postgres"
    PGPASSWORD: str = ""

    PORT: int = 8083

    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = "noreply@bidly.com"

    MAX_FILE_SIZE_BYTES: int = 15 * 1024 * 1024
    MAX_REQUEST_SIZE_BYTES: int = 50 * 1024 * 1024

    @property
    def DATABASE_URL(self) -> str:
        # Railway inyecta DATABASE_URL cuando linkeas el Postgres plugin
        raw = os.environ.get("DATABASE_URL")
        if raw:
            if raw.startswith("postgres://"):
                return raw.replace("postgres://", "postgresql+psycopg2://", 1)
            if raw.startswith("postgresql://") and "+psycopg2" not in raw:
                return raw.replace("postgresql://", "postgresql+psycopg2://", 1)
            return raw
        return (
            f"postgresql+psycopg2://{self.PGUSER}:{self.PGPASSWORD}"
            f"@{self.PGHOST}:{self.PGPORT}/{self.PGDATABASE}"
        )


settings = Settings()
