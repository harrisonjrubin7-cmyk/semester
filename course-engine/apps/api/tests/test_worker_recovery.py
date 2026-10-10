from __future__ import annotations

import importlib.util
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.entities import BackgroundJob, Course, JobStatus, SourceDocument, User


def _worker_module():
    worker_path = Path(__file__).resolve().parents[2] / "worker" / "tasks.py"
    spec = importlib.util.spec_from_file_location("course_engine_recovery_tasks", worker_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_expired_worker_leases_are_redelivered_without_republishing_active_or_revoked_jobs(
    monkeypatch,
):
    now = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)
    testing_session = _database()
    with testing_session() as session:
        user = User(email="recovery@example.com", password_hash="unused")
        session.add(user)
        session.flush()
        course = Course(user_id=user.id, title="Recovery")
        session.add(course)
        session.flush()
        document = SourceDocument(
            course_id=course.id,
            filename="source.txt",
            storage_key="courses/recovery/originals/source.txt",
            mime_type="text/plain",
            size_bytes=8,
            sha256="a" * 64,
        )
        session.add(document)
        session.flush()
        expired_extract = BackgroundJob(
            course_id=course.id,
            document_id=document.id,
            job_type="extract",
            status=JobStatus.running,
            lease_owner="crashed-extract",
            lease_generation=1,
            lease_expires_at=now - timedelta(seconds=1),
        )
        expired_generation = BackgroundJob(
            course_id=course.id,
            job_type="generate:study_guide",
            status=JobStatus.running,
            lease_owner="crashed-generation",
            lease_generation=2,
            lease_expires_at=now - timedelta(seconds=1),
        )
        active = BackgroundJob(
            course_id=course.id,
            job_type="generate:flashcards",
            status=JobStatus.running,
            lease_owner="active-worker",
            lease_generation=1,
            lease_expires_at=now + timedelta(minutes=1),
        )
        revoked = BackgroundJob(
            course_id=course.id,
            job_type="generate:study_guide",
            status=JobStatus.failed,
            revoked_at=now - timedelta(minutes=1),
        )
        session.add_all([expired_extract, expired_generation, active, revoked])
        session.commit()
        expected = {
            ("extract_document", str(expired_extract.id)),
            ("generate_study_asset", str(expired_generation.id)),
        }

    worker = _worker_module()
    worker.SessionLocal = testing_session
    monkeypatch.setattr(worker, "utc_now", lambda: now, raising=False)
    sent = []
    monkeypatch.setattr(
        worker.celery,
        "send_task",
        lambda name, args: sent.append((name, args[0])),
    )

    assert worker.recover_expired_jobs.run() == {"redelivered": 2}
    assert set(sent) == expected
