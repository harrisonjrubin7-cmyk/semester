"""Fenced worker-lease contract for durable background jobs."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, exists, not_, or_, select, update
from sqlalchemy.orm import Session

from app.models.entities import (
    BackgroundJob,
    Course,
    JobStatus,
    SourceDocument,
    StudyAsset,
    User,
)


@dataclass(frozen=True)
class JobLease:
    job_id: UUID
    course_id: UUID
    worker_id: str
    generation: int
    expires_at: datetime

    @property
    def provider_idempotency_key(self) -> str:
        """Stable logical-work key; fencing generation is intentionally separate."""
        return f"background-job:{self.job_id}"


def claim_job(
    db: Session,
    job_id: UUID,
    worker_id: str,
    now: datetime,
    lease_ttl: timedelta,
) -> JobLease | None:
    if not worker_id.strip():
        raise ValueError("worker_id is required")
    if lease_ttl <= timedelta(0):
        raise ValueError("lease_ttl must be positive")
    expires_at = now + lease_ttl
    row = db.execute(
        update(BackgroundJob)
        .where(
            BackgroundJob.id == job_id,
            BackgroundJob.revoked_at.is_(None),
            _active_scope(),
            or_(
                BackgroundJob.status == JobStatus.queued,
                and_(
                    BackgroundJob.status == JobStatus.running,
                    BackgroundJob.lease_expires_at <= now,
                ),
            ),
        )
        .values(
            status=JobStatus.running,
            lease_owner=worker_id,
            lease_generation=BackgroundJob.lease_generation + 1,
            lease_expires_at=expires_at,
            heartbeat_at=now,
            attempt_count=BackgroundJob.attempt_count + 1,
            error=None,
        )
        .returning(BackgroundJob.course_id, BackgroundJob.lease_generation)
    ).one_or_none()
    db.commit()
    if row is None:
        return None
    return JobLease(
        job_id=job_id,
        course_id=row.course_id,
        worker_id=worker_id,
        generation=row.lease_generation,
        expires_at=expires_at,
    )


def heartbeat_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    lease_ttl: timedelta,
) -> bool:
    if lease_ttl <= timedelta(0):
        raise ValueError("lease_ttl must be positive")
    expires_at = now + lease_ttl
    changed = db.execute(
        update(BackgroundJob)
        .where(_current_lease(lease, now), _active_scope())
        .values(heartbeat_at=now, lease_expires_at=expires_at)
    ).rowcount
    db.commit()
    return bool(changed)


def commit_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    result: dict,
    apply: Callable[[Session], None] | None = None,
) -> bool:
    return _finish_job(
        db,
        lease,
        now,
        status=JobStatus.completed,
        result=result,
        error=None,
        progress=100,
        apply=apply,
    )


def fail_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    error: str,
    apply: Callable[[Session], None] | None = None,
) -> bool:
    return _finish_job(
        db,
        lease,
        now,
        status=JobStatus.failed,
        result=None,
        error=error,
        progress=None,
        apply=apply,
    )


def revoke_job(
    db: Session,
    job_id: UUID,
    course_id: UUID,
    now: datetime,
    reason: str,
    *,
    commit: bool = True,
) -> bool:
    changed = db.execute(
        update(BackgroundJob)
        .where(
            BackgroundJob.id == job_id,
            BackgroundJob.course_id == course_id,
            BackgroundJob.status.not_in((JobStatus.completed, JobStatus.failed)),
            BackgroundJob.revoked_at.is_(None),
        )
        .values(
            status=JobStatus.failed,
            error=reason,
            revoked_at=now,
            lease_owner=None,
            lease_expires_at=None,
            heartbeat_at=None,
        )
    ).rowcount
    if commit:
        db.commit()
    return bool(changed)


def recovery_candidates(
    db: Session,
    now: datetime,
    limit: int = 100,
) -> list[tuple[UUID, str]]:
    """Terminalize deleted-scope leases and return bounded active work to redeliver."""
    expired_running = and_(
        BackgroundJob.status == JobStatus.running,
        BackgroundJob.revoked_at.is_(None),
        BackgroundJob.lease_expires_at <= now,
    )
    inactive_recoverable = and_(
        BackgroundJob.status.in_((JobStatus.queued, JobStatus.running)),
        BackgroundJob.revoked_at.is_(None),
        not_(_active_scope()),
    )
    db.execute(
        update(BackgroundJob)
        .where(inactive_recoverable)
        .values(
            status=JobStatus.failed,
            error="Job scope was deleted",
            revoked_at=now,
            lease_owner=None,
            lease_expires_at=None,
            heartbeat_at=None,
        )
    )
    rows = db.execute(
        select(BackgroundJob.id, BackgroundJob.job_type)
        .where(expired_running, _active_scope())
        .order_by(BackgroundJob.created_at)
        .limit(limit)
    ).all()
    db.commit()
    return [(row.id, row.job_type) for row in rows]


def update_job_progress(
    db: Session,
    lease: JobLease,
    now: datetime,
    lease_ttl: timedelta,
    progress: int,
    apply: Callable[[Session], None] | None = None,
) -> bool:
    """Renew a current lease and commit a fenced progress transition."""
    if not 0 <= progress <= 100:
        raise ValueError("progress must be between 0 and 100")
    expires_at = now + lease_ttl
    changed = db.execute(
        update(BackgroundJob)
        .where(_current_lease(lease, now), _active_scope())
        .values(progress=progress, heartbeat_at=now, lease_expires_at=expires_at)
    ).rowcount
    if not changed:
        db.rollback()
        return False
    try:
        if apply:
            apply(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True


def _active_scope():
    active_course = exists(
        select(Course.id)
        .join(User, User.id == Course.user_id)
        .where(
            Course.id == BackgroundJob.course_id,
            Course.deleted_at.is_(None),
            User.deleted_at.is_(None),
        )
    )
    active_document = or_(
        BackgroundJob.document_id.is_(None),
        exists(
            select(SourceDocument.id).where(
                SourceDocument.id == BackgroundJob.document_id,
                SourceDocument.course_id == BackgroundJob.course_id,
                SourceDocument.deleted_at.is_(None),
            )
        ),
    )
    active_target = or_(
        BackgroundJob.target_id.is_(None),
        exists(
            select(StudyAsset.id).where(
                StudyAsset.id == BackgroundJob.target_id,
                StudyAsset.course_id == BackgroundJob.course_id,
                StudyAsset.deleted_at.is_(None),
            )
        ),
    )
    return and_(active_course, active_document, active_target)


def _current_lease(lease: JobLease, now: datetime):
    return and_(
        BackgroundJob.id == lease.job_id,
        BackgroundJob.course_id == lease.course_id,
        BackgroundJob.status == JobStatus.running,
        BackgroundJob.revoked_at.is_(None),
        BackgroundJob.lease_owner == lease.worker_id,
        BackgroundJob.lease_generation == lease.generation,
        BackgroundJob.lease_expires_at > now,
    )


def _finish_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    *,
    status: JobStatus,
    result: dict | None,
    error: str | None,
    progress: int | None,
    apply: Callable[[Session], None] | None,
) -> bool:
    values = {
        "status": status,
        "error": error,
        "lease_owner": None,
        "lease_expires_at": None,
        "heartbeat_at": now,
    }
    if result is not None:
        values["result"] = result
    if progress is not None:
        values["progress"] = progress
    changed = db.execute(
        update(BackgroundJob)
        .where(_current_lease(lease, now), _active_scope())
        .values(**values)
    ).rowcount
    if not changed:
        db.rollback()
        return False
    try:
        if apply:
            apply(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True
