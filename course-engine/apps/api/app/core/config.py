from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "Course Engine"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./course_engine.db"
    jwt_secret: str = "development-only-change-me"
    access_token_minutes: int = 1440
    cors_origins: str = "http://localhost:3000"
    storage_backend: str = "local"
    local_storage_path: Path = Path("./data/objects")
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "course-engine"
    s3_sse: str = "AES256"
    redis_url: str = "redis://redis:6379/0"
    max_upload_bytes: int = 104_857_600
    max_archive_entries: int = 100
    max_archive_expanded_bytes: int = 524_288_000
    llm_provider: str = "fake"
    llm_api_key: str | None = None
    llm_model: str = ""
    benchmark_output_path: Path = Path("../../benchmark/output")


settings = Settings()
