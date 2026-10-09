from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, event, inspect, select
from sqlalchemy.orm import Session

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


def test_confidence_migration_round_trip_preserves_evidence_and_fails_closed():
    database_url = os.environ["MIGRATION_TEST_DATABASE_URL"]
    engine = create_engine(database_url)
    if engine.dialect.name == "sqlite":
        event.listen(
            engine,
            "connect",
            lambda dbapi_connection, _record: dbapi_connection.execute("PRAGMA foreign_keys=ON"),
        )

    with engine.connect() as connection:
        config = _config(connection)
        command.upgrade(config, "head")
        assert _confidence_nullable(connection)

        command.downgrade(config, "0001_initial")
        assert not _confidence_nullable(connection)
        chunk_id, citation_id = _seed_cited_chunk(connection, 0.75)

        command.upgrade(config, "head")
        assert _confidence_nullable(connection)
        assert connection.scalar(
            select(SourceChunk.confidence).where(SourceChunk.id == chunk_id)
        ) == 0.75
        assert connection.scalar(select(Citation.id).where(Citation.id == citation_id)) == citation_id

        unknown_chunk_id, unknown_citation_id = _seed_cited_chunk(connection, None)
        with pytest.raises(RuntimeError, match="unmeasured chunks exist"):
            command.downgrade(config, "0001_initial")

        assert MigrationContext.configure(connection).get_current_revision() == "0002_review_first_confidence"
        assert connection.scalar(
            select(SourceChunk.confidence).where(SourceChunk.id == unknown_chunk_id)
        ) is None
        assert connection.scalar(
            select(Citation.id).where(Citation.id == unknown_citation_id)
        ) == unknown_citation_id

        connection.execute(
            SourceChunk.__table__.delete().where(SourceChunk.id == unknown_chunk_id)
        )
        connection.commit()
        command.downgrade(config, "0001_initial")
        assert not _confidence_nullable(connection)
        assert connection.scalar(select(Citation.id).where(Citation.id == citation_id)) == citation_id
        command.upgrade(config, "head")
        assert _confidence_nullable(connection)

        if engine.dialect.name == "sqlite":
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
            assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
