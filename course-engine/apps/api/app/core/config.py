from collections.abc import Mapping
from dataclasses import dataclass
from ipaddress import ip_address
from os import environ
from pathlib import Path
from socket import inet_aton
from urllib.parse import SplitResult, parse_qsl, unquote, urlsplit

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

PRODUCTION_RUNTIME_POLICY = "private-course-data-no-provider-egress-v1"
DEVELOPMENT_JWT_SECRETS = {
    "development-only-change-me",
    "replace-with-at-least-32-random-characters",
}


@dataclass(frozen=True)
class RuntimeReadiness:
    managed_runtime: bool
    ready: bool
    violations: tuple[str, ...]


def _is_loopback(hostname: str | None) -> bool:
    hostname = (hostname or "").lower().rstrip(".")
    try:
        address = ip_address(hostname)
        return address.is_loopback or bool(
            getattr(address, "ipv4_mapped", None)
            and address.ipv4_mapped.is_loopback
        )
    except ValueError:
        if hostname == "localhost" or hostname.endswith(".localhost"):
            return True
        try:
            return inet_aton(hostname)[0] == 127
        except OSError:
            return False


def _split_url(value: str) -> SplitResult | None:
    try:
        return urlsplit(value)
    except ValueError:
        return None


def _has_valid_port(parsed: SplitResult) -> bool:
    try:
        parsed.port
        return True
    except ValueError:
        return False


def _is_development_database(parsed: SplitResult) -> bool:
    if not _has_valid_port(parsed):
        return True
    return (
        unquote(parsed.username or "") == "course_engine"
        and unquote(parsed.password or "") == "course_engine"
        and (parsed.hostname or "").lower().rstrip(".") == "postgres"
        and parsed.port in {None, 5432}
        and unquote(parsed.path) == "/course_engine"
    )


def _has_safe_database_query(parsed: SplitResult) -> bool:
    try:
        parameters = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    except ValueError:
        return False
    return all(
        key == "sslmode" and value in {"require", "verify-ca", "verify-full"}
        for key, value in parameters
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        str_strip_whitespace=True,
    )
    app_name: str = "Course Engine"
    api_prefix: str = "/api/v1"
    runtime_environment: str = "development"
    runtime_policy: str = ""
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
    s3_expected_bucket_owner: str | None = None
    s3_sse: str = "AES256"
    redis_url: str = "redis://redis:6379/0"
    max_upload_bytes: int = 104_857_600
    max_archive_entries: int = 100
    max_archive_expanded_bytes: int = 524_288_000
    llm_provider: str = "fake"
    llm_api_key: str | None = None
    llm_model: str = ""
    benchmark_output_path: Path = Path("../../benchmark/output")

    def runtime_readiness(
        self,
        environment: Mapping[str, str] | None = None,
    ) -> RuntimeReadiness:
        environment = environ if environment is None else environment
        runtime_environment = self.runtime_environment.strip().lower()
        managed_runtime = (
            "VERCEL" in environment
            or "VERCEL_ENV" in environment
            or runtime_environment not in {"development", "test"}
        )
        if not managed_runtime:
            return RuntimeReadiness(False, True, ())

        violations: list[str] = []
        database = _split_url(self.database_url)
        if (
            database is None
            or database.scheme not in {"postgres", "postgresql", "postgresql+psycopg"}
            or not database.hostname
            or database.path in {"", "/"}
            or _is_loopback(database.hostname)
            or _is_development_database(database)
            or not _has_safe_database_query(database)
        ):
            violations.append("database")

        jwt_secret = self.jwt_secret
        if jwt_secret in DEVELOPMENT_JWT_SECRETS or len(jwt_secret) < 32:
            violations.append("authentication")

        storage_endpoint = _split_url(self.s3_endpoint_url)
        storage_values = (
            self.s3_access_key,
            self.s3_secret_key,
            self.s3_bucket,
        )
        if (
            storage_endpoint is None
            or self.storage_backend.lower() != "s3"
            or storage_endpoint.scheme != "https"
            or not storage_endpoint.hostname
            or not _has_valid_port(storage_endpoint)
            or _is_loopback(storage_endpoint.hostname)
            or not all(storage_values)
            or storage_values[0] == "minioadmin"
            or storage_values[1] == "minioadmin"
            or storage_values[2] == "course-engine"
            or not self.s3_expected_bucket_owner
            or not self.s3_expected_bucket_owner.isdigit()
            or len(self.s3_expected_bucket_owner) != 12
            or self.s3_sse not in {"AES256", "aws:kms"}
        ):
            violations.append("storage")

        broker = _split_url(self.redis_url)
        if (
            broker is None
            or broker.scheme != "rediss"
            or not broker.hostname
            or not _has_valid_port(broker)
            or _is_loopback(broker.hostname)
        ):
            violations.append("broker")

        if self.llm_provider.lower() != "disabled":
            violations.append("provider")

        if self.runtime_policy != PRODUCTION_RUNTIME_POLICY:
            violations.append("runtime_policy")

        return RuntimeReadiness(True, not violations, tuple(violations))

    def require_runtime_ready(
        self,
        environment: Mapping[str, str] | None = None,
    ) -> None:
        if not self.runtime_readiness(environment).ready:
            raise RuntimeError("Runtime is not ready")


try:
    settings = Settings()
except ValidationError:
    settings = Settings.model_construct(runtime_environment="invalid")
