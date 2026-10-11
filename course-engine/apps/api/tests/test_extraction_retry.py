from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import routes
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.entities import BackgroundJob, Course, JobStatus, SourceDocument, User
from app.services.job_leases import recovery_candidates


def _database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _source(testing_session):
    with testing_session() as session:
        owner = User(email="retry-owner@example.com", password_hash="unused")
        session.add(owner)
        session.flush()
        course = Course(user_id=owner.id, title="Retry extraction")
        session.add(course)
        session.flush()
        document = SourceDocument(
            course_id=course.id,
            filename="source.txt",
            storage_key="courses/retry/originals/source.txt",
            mime_type="text/plain",
            size_bytes=4,
            sha256="a" * 64,
            status="failed",
        )
        session.add(document)
        session.commit()
        return owner.id, course.id, document.id


def _client(testing_session, *, raise_server_exceptions=True):
    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def test_retry_reuses_the_single_active_job_with_stable_delivery_identity(monkeypatch):
    testing_session = _database()
    owner_id, _course_id, document_id = _source(testing_session)
    sent = []
    monkeypatch.setattr(
        routes.celery_client,
        "send_task",
        lambda name, args, **kwargs: sent.append((name, args, kwargs)),
    )
    client = _client(testing_session)
    try:
        headers = {"Authorization": f"Bearer {create_access_token(owner_id)}"}
        first = client.post(f"/api/v1/files/{document_id}/retry-extraction", headers=headers)
        second = client.post(f"/api/v1/files/{document_id}/retry-extraction", headers=headers)

        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]
        assert sent == [
            ("extract_document", [first.json()["id"]], {"task_id": first.json()["id"]}),
            ("extract_document", [first.json()["id"]], {"task_id": first.json()["id"]}),
        ]
        with testing_session() as session:
            assert session.scalar(select(func.count()).select_from(BackgroundJob)) == 1
            assert session.get(SourceDocument, document_id).status == "queued"
    finally:
        app.dependency_overrides.clear()


def test_retry_dispatch_failure_leaves_a_recoverable_queued_job(monkeypatch):
    testing_session = _database()
    owner_id, _course_id, document_id = _source(testing_session)
    monkeypatch.setattr(
        routes.celery_client,
        "send_task",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("broker unavailable")),
    )
    client = _client(testing_session, raise_server_exceptions=False)
    try:
        response = client.post(
            f"/api/v1/files/{document_id}/retry-extraction",
            headers={"Authorization": f"Bearer {create_access_token(owner_id)}"},
        )
        assert response.status_code == 500
        with testing_session() as session:
            job = session.scalar(select(BackgroundJob))
            assert job.status == JobStatus.queued
            candidates = recovery_candidates(
                session,
                datetime.now(UTC) + timedelta(minutes=6),
            )
            assert candidates == [(job.id, "extract")]
    finally:
        app.dependency_overrides.clear()


def test_database_rejects_two_active_extractions_for_one_document():
    testing_session = _database()
    _owner_id, course_id, document_id = _source(testing_session)
    with testing_session() as session:
        session.add(BackgroundJob(
            course_id=course_id,
            document_id=document_id,
            job_type="extract",
            status=JobStatus.queued,
        ))
        session.commit()
        session.add(BackgroundJob(
            course_id=course_id,
            document_id=document_id,
            job_type="extract",
            status=JobStatus.running,
        ))
        with pytest.raises(IntegrityError):
            session.commit()
