from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

from app.core.config import Settings

API_ROOT = Path(__file__).resolve().parents[1]


def production_settings(**overrides) -> Settings:
    values = {
        "runtime_environment": "production",
        "runtime_policy": "private-course-data-no-provider-egress-v1",
        "database_url": "postgresql+psycopg://course_engine@db.internal/course_engine",
        "jwt_secret": "a-production-secret-with-at-least-32-characters",
        "storage_backend": "s3",
        "s3_endpoint_url": "https://objects.internal.example",
        "s3_access_key": "non-default-access-key",
        "s3_secret_key": "non-default-secret-key",
        "s3_bucket": "private-course-engine-production",
        "s3_expected_bucket_owner": "123456789012",
        "redis_url": "rediss://queue.internal.example:6379/0",
        "llm_provider": "disabled",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


class ProductionRuntimeGuardTests(unittest.TestCase):
    def test_vercel_never_infers_development_from_missing_or_blank_marker(self):
        settings = Settings(_env_file=None)

        for environment in ({"VERCEL": "1"}, {"VERCEL": ""}, {"VERCEL_ENV": ""}):
            with self.subTest(environment=environment):
                readiness = settings.runtime_readiness(environment)
                self.assertTrue(readiness.managed_runtime)
                self.assertFalse(readiness.ready)
                self.assertEqual(
                    set(readiness.violations),
                    {
                        "authentication",
                        "broker",
                        "database",
                        "provider",
                        "runtime_policy",
                        "storage",
                    },
                )

    def test_blank_default_and_malformed_production_settings_fail_closed(self):
        cases = {
            "blank": production_settings(
                database_url="",
                jwt_secret="",
                storage_backend="",
                s3_endpoint_url="",
                s3_access_key="",
                s3_secret_key="",
                s3_bucket="",
                s3_expected_bucket_owner="",
                redis_url="",
                runtime_policy="",
                llm_provider="",
            ),
            "development-defaults": Settings(
                _env_file=None,
                runtime_environment="production",
            ),
            "malformed": production_settings(
                database_url="postgresql://",
                jwt_secret="short",
                storage_backend="remote-ish",
                s3_endpoint_url="file:///tmp/objects",
                s3_expected_bucket_owner="owner",
                redis_url="redis://localhost:6379/0",
                runtime_policy="allow-everything",
                llm_provider="fake",
            ),
        }

        for name, settings in cases.items():
            with self.subTest(name=name):
                readiness = settings.runtime_readiness({})
                self.assertTrue(readiness.managed_runtime)
                self.assertFalse(readiness.ready)
                self.assertEqual(
                    set(readiness.violations),
                    {
                        "authentication",
                        "broker",
                        "database",
                        "provider",
                        "runtime_policy",
                        "storage",
                    },
                )

    def test_complete_private_configuration_is_ready_but_local_defaults_still_work(self):
        self.assertTrue(production_settings().runtime_readiness({}).ready)
        local = Settings(_env_file=None).runtime_readiness({})
        self.assertFalse(local.managed_runtime)
        self.assertTrue(local.ready)

    def test_production_database_cannot_be_loopback(self):
        for database_url in (
            "postgresql://course_engine@localhost/course_engine",
            "postgresql://course_engine@localhost./course_engine",
            "postgresql://course_engine@127.0.0.1/course_engine",
            "postgresql://course_engine@127.1/course_engine",
            "postgresql://course_engine@2130706433/course_engine",
            "postgresql://course_engine@[::1]/course_engine",
            "postgresql://course_engine@[::ffff:127.0.0.1]/course_engine",
        ):
            with self.subTest(database_url=database_url):
                readiness = production_settings(database_url=database_url).runtime_readiness({})
                self.assertIn("database", readiness.violations)
                self.assertFalse(readiness.ready)

    def test_postgres_query_cannot_override_connection_identity(self):
        base = "postgresql+psycopg://user:pass@db.internal/course_engine"
        for query in (
            "host=127.0.0.1",
            "host=localhost",
            "host=%2Fvar%2Frun%2Fpostgresql",
            "hostaddr=127.0.0.1",
            "port=5433",
            "service=course-engine",
            "servicefile=%2Ftmp%2Fpg_service.conf",
            "user=other",
            "password=other",
            "dbname=other",
        ):
            with self.subTest(query=query):
                readiness = production_settings(
                    database_url=f"{base}?{query}",
                ).runtime_readiness({})
                self.assertIn("database", readiness.violations)
                self.assertFalse(readiness.ready)

        self.assertTrue(
            production_settings(
                database_url=f"{base}?sslmode=verify-full",
            ).runtime_readiness({}).ready
        )

    def test_production_storage_and_broker_cannot_be_loopback(self):
        cases = (
            ("storage", {"s3_endpoint_url": "https://localhost:9000"}),
            ("storage", {"s3_endpoint_url": "https://localhost.:9000"}),
            ("broker", {"redis_url": "rediss://127.0.0.1:6379/0"}),
            ("broker", {"redis_url": "rediss://localhost.:6379/0"}),
        )
        for expected_violation, overrides in cases:
            with self.subTest(expected_violation=expected_violation):
                readiness = production_settings(**overrides).runtime_readiness({})
                self.assertIn(expected_violation, readiness.violations)
                self.assertFalse(readiness.ready)

    def test_storage_endpoint_requires_a_real_hostname(self):
        for endpoint in ("https://user@", "https://:443"):
            with self.subTest(endpoint=endpoint):
                readiness = production_settings(s3_endpoint_url=endpoint).runtime_readiness({})
                self.assertIn("storage", readiness.violations)
                self.assertFalse(readiness.ready)

    def test_whitespace_cannot_disguise_development_credentials(self):
        readiness = production_settings(
            jwt_secret="    development-only-change-me    ",
            s3_access_key=" minioadmin ",
            s3_secret_key=" minioadmin ",
            s3_bucket=" course-engine ",
        ).runtime_readiness({})

        self.assertEqual(set(readiness.violations), {"authentication", "storage"})
        self.assertFalse(readiness.ready)

    def test_documented_placeholders_are_never_production_ready(self):
        jwt_readiness = production_settings(
            jwt_secret="replace-with-at-least-32-random-characters",
        ).runtime_readiness({})
        database_readiness = production_settings(
            database_url=(
                "postgresql+psycopg://"
                "course_engine:course_engine@postgres:5432/course_engine"
            ),
        ).runtime_readiness({})

        self.assertIn("authentication", jwt_readiness.violations)
        self.assertFalse(jwt_readiness.ready)
        self.assertIn("database", database_readiness.violations)
        self.assertFalse(database_readiness.ready)
        for database_url in (
            "postgresql://course_engine:course_engine@postgres:5432/course_engine",
            "postgresql+psycopg://course_engine:course_engine@postgres/course_engine?",
            "postgresql://%63ourse_engine:course_engine@postgres/%63ourse_engine",
        ):
            with self.subTest(database_url=database_url):
                readiness = production_settings(database_url=database_url).runtime_readiness({})
                self.assertIn("database", readiness.violations)
                self.assertFalse(readiness.ready)

    def test_malformed_urls_are_violations_instead_of_exceptions(self):
        cases = (
            ("database", {"database_url": "postgresql://["}),
            ("database", {"database_url": "postgresql://db.internal:not-a-port/db"}),
            ("storage", {"s3_endpoint_url": "https://["}),
            ("storage", {"s3_endpoint_url": "https://objects.internal:not-a-port"}),
            ("broker", {"redis_url": "rediss://["}),
            ("broker", {"redis_url": "rediss://queue.internal:not-a-port/0"}),
        )
        for expected_violation, overrides in cases:
            with self.subTest(expected_violation=expected_violation):
                readiness = production_settings(**overrides).runtime_readiness({})
                self.assertIn(expected_violation, readiness.violations)
                self.assertFalse(readiness.ready)

    def test_storage_encryption_mode_is_required(self):
        for s3_sse in ("", "none", "AES128"):
            with self.subTest(s3_sse=s3_sse):
                readiness = production_settings(s3_sse=s3_sse).runtime_readiness({})
                self.assertIn("storage", readiness.violations)
                self.assertFalse(readiness.ready)

    def test_critical_string_settings_are_normalized_before_use(self):
        settings = production_settings(
            database_url="  postgresql+psycopg://course_engine@db.internal/course_engine  ",
            storage_backend=" s3 ",
            s3_endpoint_url=" https://objects.internal.example ",
            redis_url=" rediss://queue.internal.example:6379/0 ",
            llm_provider=" disabled ",
            runtime_policy=" private-course-data-no-provider-egress-v1 ",
        )

        self.assertTrue(settings.runtime_readiness({}).ready)
        self.assertEqual(
            settings.database_url,
            "postgresql+psycopg://course_engine@db.internal/course_engine",
        )
        self.assertEqual(settings.storage_backend, "s3")
        self.assertEqual(settings.redis_url, "rediss://queue.internal.example:6379/0")
        self.assertEqual(settings.llm_provider, "disabled")

    def test_worker_boundaries_can_refuse_unsafe_runtime_without_configuration_details(self):
        with self.assertRaisesRegex(RuntimeError, "Runtime is not ready$"):
            Settings(_env_file=None).require_runtime_ready({"VERCEL": ""})
        production_settings().require_runtime_ready({})

    def test_unsafe_vercel_runtime_exposes_only_liveness_and_safe_503(self):
        script = """
import json
import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
health = client.get("/health")
ready = client.get("/ready")
register = client.post("/api/v1/register", json={})
preflight = client.options(
    "/api/v1/register",
    headers={
        "Origin": "https://untrusted.example",
        "Access-Control-Request-Method": "POST",
    },
)
print(json.dumps({
    "health": [health.status_code, health.json()],
    "ready": [ready.status_code, ready.json()],
    "register": [register.status_code, register.json()],
    "preflight": [preflight.status_code, preflight.json()],
    "docs": client.get("/docs").status_code,
    "openapi": client.get("/openapi.json").status_code,
    "database_imported": "app.core.database" in sys.modules,
    "provider_imported": "app.llm.client" in sys.modules,
    "security_imported": "app.core.security" in sys.modules,
    "queue_imported": "app.core.queue" in sys.modules,
    "routes_imported": "app.api.routes" in sys.modules,
    "storage_imported": "app.services.storage" in sys.modules,
}))
"""
        environment = {
            key: value
            for key, value in os.environ.items()
            if key
            not in {
                "DATABASE_URL",
                "JWT_SECRET",
                "LLM_PROVIDER",
                "REDIS_URL",
                "RUNTIME_ENVIRONMENT",
                "RUNTIME_POLICY",
                "STORAGE_BACKEND",
            }
        }
        environment.update({
            "ACCESS_TOKEN_MINUTES": "not-an-integer",
            "PYTHONPATH": str(API_ROOT),
            "VERCEL": "",
        })
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=API_ROOT,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        observed = json.loads(result.stdout)
        self.assertEqual(observed["health"], [200, {"status": "ok"}])
        self.assertEqual(observed["ready"], [503, {"detail": "Service unavailable"}])
        self.assertEqual(observed["register"], [503, {"detail": "Service unavailable"}])
        self.assertEqual(observed["preflight"], [503, {"detail": "Service unavailable"}])
        self.assertEqual(observed["docs"], 404)
        self.assertEqual(observed["openapi"], 404)
        self.assertFalse(observed["database_imported"])
        self.assertFalse(observed["provider_imported"])
        self.assertFalse(observed["security_imported"])
        self.assertFalse(observed["queue_imported"])
        self.assertFalse(observed["routes_imported"])
        self.assertFalse(observed["storage_imported"])


if __name__ == "__main__":
    unittest.main()
