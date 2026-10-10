from __future__ import annotations

import importlib.util
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.entities import (
    BackgroundJob,
    Course,
    JobStatus,
    SourceDocument,
    StudyAsset,
    User,
)


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
        deleted_target = StudyAsset(
            course_id=course.id,
            asset_type="study_guide",
            title="Deleted target",
            content={"sections": []},
            deleted_at=now - timedelta(minutes=1),
        )
        session.add(deleted_target)
        session.flush()
        inactive = BackgroundJob(
            course_id=course.id,
            target_id=deleted_target.id,
            job_type="regenerate:study_guide",
            status=JobStatus.running,
            lease_owner="deleted-target-worker",
            lease_generation=1,
            lease_expires_at=now - timedelta(seconds=1),
        )
        session.add_all([expired_extract, expired_generation, active, revoked, inactive])
        session.commit()
        expected = {
            ("extract_document", str(expired_extract.id)),
            ("generate_study_asset", str(expired_generation.id)),
        }
        inactive_id = inactive.id

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
    with testing_session() as session:
        terminal = session.get(BackgroundJob, inactive_id)
        assert terminal.status == JobStatus.failed
        assert terminal.revoked_at == now
        assert terminal.error == "Job scope was deleted"


def test_lease_heartbeat_runs_while_worker_operation_is_blocked(monkeypatch):
    worker = _worker_module()
    monkeypatch.setattr(worker, "JOB_HEARTBEAT_INTERVAL_SECONDS", 0.01, raising=False)
    calls = []

    class FakeSession:
        def close(self):
            pass

    monkeypatch.setattr(worker, "SessionLocal", FakeSession)
    monkeypatch.setattr(
        worker,
        "heartbeat_job",
        lambda _db, lease, _now, _ttl: calls.append(lease) or True,
        raising=False,
    )
    lease = object()
    with worker.maintain_job_lease(lease):
        time.sleep(0.04)

    assert len(calls) >= 2
