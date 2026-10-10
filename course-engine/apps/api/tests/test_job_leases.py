from __future__ import annotations

import os
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base
from app.models.entities import BackgroundJob, Course, JobStatus, SourceDocument, User
from app.services.job_leases import (
    claim_job,
    commit_job,
    fail_job,
    heartbeat_job,
    revoke_job,
)


NOW = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)
TTL = timedelta(minutes=5)


def _database(tmp_path: Path):
    configured = os.environ.get("DATABASE_URL", "")
    if configured.startswith("postgresql"):
        engine = create_engine(configured, pool_pre_ping=True)
    else:
        engine = create_engine(
            f"sqlite:///{tmp_path / 'leases.db'}",
            connect_args={"check_same_thread": False, "timeout": 10},
        )
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def _job(session_factory, *, with_document: bool = True):
    with session_factory() as db:
        user = User(email="lease@example.com", password_hash="unused")
        db.add(user)
        db.flush()
        course = Course(user_id=user.id, title="Lease test")
        db.add(course)
        db.flush()
        document = None
        if with_document:
            document = SourceDocument(
                course_id=course.id,
                filename="source.txt",
                storage_key="courses/lease/originals/source.txt",
                mime_type="text/plain",
                size_bytes=4,
                sha256="a" * 64,
            )
            db.add(document)
            db.flush()
        job = BackgroundJob(
            course_id=course.id,
            document_id=document.id if document else None,
            job_type="extract" if document else "generate:study_guide",
        )
        db.add(job)
        db.commit()
        return user.id, course.id, document.id if document else None, job.id


def test_claim_is_atomic_scoped_and_duplicate_delivery_is_ignored(tmp_path: Path):
    _engine, sessions = _database(tmp_path)
    _user_id, course_id, _document_id, job_id = _job(sessions)

    with sessions() as db:
        first = claim_job(db, job_id, "worker-a", NOW, TTL)
    with sessions() as db:
        duplicate = claim_job(db, job_id, "worker-b", NOW, TTL)
        job = db.get(BackgroundJob, job_id)

    assert first is not None
    assert first.course_id == course_id
    assert first.generation == 1
    assert first.provider_idempotency_key == f"background-job:{job_id}"
    assert duplicate is None
    assert job.status == JobStatus.running
    assert job.lease_owner == "worker-a"
    assert job.lease_generation == 1
    assert job.attempt_count == 1


def test_crashed_claim_reclaims_once_with_monotonic_fence(tmp_path: Path):
    _engine, sessions = _database(tmp_path)
    _user_id, _course_id, _document_id, job_id = _job(sessions)
    with sessions() as db:
        crashed = claim_job(db, job_id, "crashed-worker", NOW, TTL)

    reclaim_at = NOW + TTL + timedelta(seconds=1)
    with sessions() as db:
        reclaimed = claim_job(db, job_id, "recovery-worker", reclaim_at, TTL)

    assert crashed is not None and reclaimed is not None
    assert reclaimed.generation == crashed.generation + 1
    assert reclaimed.provider_idempotency_key == crashed.provider_idempotency_key


def test_concurrent_reclaim_has_one_winner(tmp_path: Path):
    _engine, sessions = _database(tmp_path)
    _user_id, _course_id, _document_id, job_id = _job(sessions)
    with sessions() as db:
        assert claim_job(db, job_id, "crashed-worker", NOW, TTL)

    barrier = threading.Barrier(3)
    claims = []
    lock = threading.Lock()

    def attempt(worker_id: str):
        with sessions() as db:
            barrier.wait()
            lease = claim_job(db, job_id, worker_id, NOW + TTL + timedelta(seconds=1), TTL)
            with lock:
                claims.append(lease)

    threads = [threading.Thread(target=attempt, args=(f"worker-{index}",)) for index in range(2)]
    for thread in threads:
        thread.start()
    barrier.wait()
    for thread in threads:
        thread.join(timeout=10)

    winners = [claim for claim in claims if claim is not None]
    assert len(winners) == 1
    assert winners[0].generation == 2


def test_stale_heartbeat_and_finish_cannot_overwrite_reclaimed_work(tmp_path: Path):
    _engine, sessions = _database(tmp_path)
    _user_id, course_id, _document_id, job_id = _job(sessions)
    with sessions() as db:
        stale = claim_job(db, job_id, "old-worker", NOW, TTL)
    reclaim_at = NOW + TTL + timedelta(seconds=1)
    with sessions() as db:
        current = claim_job(db, job_id, "new-worker", reclaim_at, TTL)

    assert stale is not None and current is not None
    with sessions() as db:
        assert not heartbeat_job(db, stale, reclaim_at, TTL)
        assert not commit_job(
            db,
            stale,
            reclaim_at,
            {"worker": "old"},
            lambda session: setattr(session.get(Course, course_id), "title", "stale"),
        )
    with sessions() as db:
        assert heartbeat_job(db, current, reclaim_at, TTL)
        assert commit_job(
            db,
            current,
            reclaim_at,
            {"worker": "new"},
            lambda session: setattr(session.get(Course, course_id), "title", "current"),
        )
    with sessions() as db:
        job = db.get(BackgroundJob, job_id)
        assert db.get(Course, course_id).title == "current"
        assert job.status == JobStatus.completed
        assert job.result == {"worker": "new"}
        assert claim_job(db, job_id, "duplicate", reclaim_at + TTL, TTL) is None


def test_revocation_and_soft_deletion_barriers_prevent_resurrection(tmp_path: Path):
    _engine, sessions = _database(tmp_path)
    _user_id, course_id, document_id, job_id = _job(sessions)
    with sessions() as db:
        lease = claim_job(db, job_id, "worker", NOW, TTL)
        assert lease is not None
        assert revoke_job(db, job_id, course_id, NOW, "student deleted the source")
    with sessions() as db:
        assert not commit_job(
            db,
            lease,
            NOW,
            {"chunks": 1},
            lambda session: setattr(session.get(SourceDocument, document_id), "status", "needs_review"),
        )
        assert claim_job(db, job_id, "recovery", NOW + TTL, TTL) is None
        job = db.get(BackgroundJob, job_id)
        assert job.revoked_at is not None
        assert job.status == JobStatus.failed
        assert db.get(SourceDocument, document_id).status == "uploaded"

    _other_user, _other_course, other_document, other_job = _job(sessions)
    with sessions() as db:
        db.get(SourceDocument, other_document).deleted_at = NOW
        db.commit()
    with sessions() as db:
        assert claim_job(db, other_job, "worker", NOW, TTL) is None

    deleted_user, _third_course, _third_document, third_job = _job(sessions)
    with sessions() as db:
        db.get(User, deleted_user).deleted_at = NOW
        db.commit()
        assert claim_job(db, third_job, "worker", NOW, TTL) is None


def test_failure_is_terminal_and_stale_failure_is_ignored(tmp_path: Path):
    _engine, sessions = _database(tmp_path)
    _user_id, course_id, _document_id, job_id = _job(sessions)
    with sessions() as db:
        stale = claim_job(db, job_id, "old-worker", NOW, TTL)
    assert stale is not None
    reclaim_at = NOW + TTL + timedelta(seconds=1)
    with sessions() as db:
        current = claim_job(db, job_id, "new-worker", reclaim_at, TTL)
    assert current is not None
    with sessions() as db:
        assert not fail_job(
            db,
            stale,
            reclaim_at,
            "stale failure",
            lambda session: setattr(session.get(Course, course_id), "title", "stale failure"),
        )
        assert fail_job(db, current, reclaim_at, "provider rejected input")
        assert claim_job(db, job_id, "retry", reclaim_at + TTL, TTL) is None
        job = db.get(BackgroundJob, job_id)
        assert job.status == JobStatus.failed
        assert job.error == "provider rejected input"
        assert db.get(Course, course_id).title == "Lease test"
