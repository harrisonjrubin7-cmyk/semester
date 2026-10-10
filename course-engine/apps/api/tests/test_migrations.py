from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, event, inspect, select
from sqlalchemy.orm import Session

from alembic import command
from app.models.entities import Citation, Course, SourceChunk, SourceDocument, User


def _config(connection) -> Config:
    root = Path(__file__).resolve().parents[1]
    config = Config(root / "alembic.ini")
    config.set_main_option("script_location", str(root / "alembic"))
    config.attributes["connection"] = connection
    return config


def _confidence_nullable(connection) -> bool:
    column = next(
        item for item in inspect(connection).get_columns("source_chunks")
        if item["name"] == "confidence"
    )
    return bool(column["nullable"])


def _migrate(connection, operation, revision: str) -> None:
    # Alembic's public command opens its own migration transaction. End any
    # read-only inspection transaction so SQLite can safely toggle FK checks
    # around its required batch-table rebuild, then prove they were restored.
    if connection.in_transaction():
        connection.commit()
    expected_foreign_keys = None
    if connection.dialect.name == "sqlite":
        expected_foreign_keys = connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one()
        connection.rollback()
    operation(_config(connection), revision)
    if connection.dialect.name == "sqlite":
        actual_foreign_keys = connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one()
        assert actual_foreign_keys == expected_foreign_keys
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        connection.rollback()
    assert not connection.in_transaction()


def _seed_cited_chunk(connection, confidence: float | None) -> tuple[object, object]:
    with Session(connection) as session:
        user = User(email=f"migration-{uuid4()}@example.com", password_hash="not-used")
        session.add(user)
        session.flush()
        course = Course(user_id=user.id, title="Migration test")
        session.add(course)
        session.flush()
        document = SourceDocument(
            course_id=course.id,
            filename="source.txt",
            storage_key=f"private/originals/{uuid4()}.txt",
            mime_type="text/plain",
            size_bytes=4,
            sha256=uuid4().hex + uuid4().hex,
        )
        session.add(document)
        session.flush()
        chunk = SourceChunk(
            document_id=document.id,
            chunk_index=0,
            content="text",
            confidence=confidence,
        )
        session.add(chunk)
        session.flush()
        citation = Citation(chunk_id=chunk.id, quote="text")
        session.add(citation)
        session.commit()
        return chunk.id, citation.id


@pytest.mark.parametrize("sqlite_foreign_keys", [False, True])
def test_confidence_migration_round_trip_preserves_evidence_and_fails_closed(
    sqlite_foreign_keys: bool,
):
    database_url = os.environ["MIGRATION_TEST_DATABASE_URL"]
    engine = create_engine(database_url)
    if engine.dialect.name != "sqlite" and sqlite_foreign_keys:
        pytest.skip("PostgreSQL does not have SQLite PRAGMA modes")
    if engine.dialect.name == "sqlite":
        engine.dispose()
        database_url = f"{database_url}-fk-{'on' if sqlite_foreign_keys else 'off'}"
        engine = create_engine(database_url)
    if engine.dialect.name == "sqlite" and sqlite_foreign_keys:
        event.listen(
            engine,
            "connect",
            lambda dbapi_connection, _record: dbapi_connection.execute("PRAGMA foreign_keys=ON"),
        )

    with engine.connect() as connection:
        _migrate(connection, command.upgrade, "head")
        assert _confidence_nullable(connection)
        completion_columns = {
            column["name"] for column in inspect(connection).get_columns("upload_completions")
        }
        assert completion_columns == {
            "id", "document_id", "course_id", "job_id", "payload_fingerprint",
            "verified_metadata", "dispatch_status", "dispatch_claimed_at",
            "dispatched_at", "created_at", "updated_at",
        }
        completion_uniques = {
            tuple(constraint["column_names"])
            for constraint in inspect(connection).get_unique_constraints("upload_completions")
        }
        assert {("document_id",), ("job_id",)} <= completion_uniques
        job_columns = {
            column["name"] for column in inspect(connection).get_columns("background_jobs")
        }
        assert {
            "target_id",
            "lease_owner",
            "lease_generation",
            "lease_expires_at",
            "heartbeat_at",
            "attempt_count",
            "revoked_at",
        } <= job_columns
        job_indexes = {
            tuple(index["column_names"])
            for index in inspect(connection).get_indexes("background_jobs")
        }
        assert ("target_id",) in job_indexes

        _migrate(connection, command.downgrade, "0001_initial")
        assert not _confidence_nullable(connection)
        chunk_id, citation_id = _seed_cited_chunk(connection, 0.75)

        _migrate(connection, command.upgrade, "head")
        assert _confidence_nullable(connection)
        assert connection.scalar(
            select(SourceChunk.confidence).where(SourceChunk.id == chunk_id)
        ) == 0.75
        assert connection.scalar(select(Citation.id).where(Citation.id == citation_id)) == citation_id

        unknown_chunk_id, unknown_citation_id = _seed_cited_chunk(connection, None)
        with pytest.raises(RuntimeError, match="unmeasured chunks exist"):
            _migrate(connection, command.downgrade, "0001_initial")

        if engine.dialect.name == "sqlite":
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == int(
                sqlite_foreign_keys
            )
            assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
            connection.rollback()
            assert not connection.in_transaction()
        expected_revision = (
            "0002_review_first_confidence"
            if engine.dialect.name == "sqlite"
            else "0004_background_job_leases"
        )
        assert MigrationContext.configure(connection).get_current_revision() == expected_revision
        assert connection.scalar(
            select(SourceChunk.confidence).where(SourceChunk.id == unknown_chunk_id)
        ) is None
        assert connection.scalar(
            select(Citation.id).where(Citation.id == unknown_citation_id)
        ) == unknown_citation_id

        # Delete the dependent explicitly: the FK-off test mode must not rely on
        # SQLite cascade enforcement to prepare the successful downgrade case.
        connection.execute(Citation.__table__.delete().where(Citation.id == unknown_citation_id))
        connection.execute(SourceChunk.__table__.delete().where(SourceChunk.id == unknown_chunk_id))
        connection.commit()
        _migrate(connection, command.downgrade, "0001_initial")
        assert not _confidence_nullable(connection)
        assert connection.scalar(select(Citation.id).where(Citation.id == citation_id)) == citation_id
        _migrate(connection, command.upgrade, "head")
        assert _confidence_nullable(connection)
