"""Fenced worker-lease contract for durable background jobs."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session


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
    return None


def heartbeat_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    lease_ttl: timedelta,
) -> bool:
    return False


def commit_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    result: dict,
    apply: Callable[[Session], None] | None = None,
) -> bool:
    return False


def fail_job(
    db: Session,
    lease: JobLease,
    now: datetime,
    error: str,
    apply: Callable[[Session], None] | None = None,
) -> bool:
    return False


def revoke_job(
    db: Session,
    job_id: UUID,
    course_id: UUID,
    now: datetime,
    reason: str,
) -> bool:
    return False
