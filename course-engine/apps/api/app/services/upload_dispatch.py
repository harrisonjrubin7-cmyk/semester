from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, or_, update
from sqlalchemy.orm import Session

from app.models.entities import UploadCompletion

DISPATCH_CLAIM_TTL = timedelta(minutes=5)


def dispatch_upload_completion(db: Session, receipt_id: UUID, sender) -> bool:
    """Claim and dispatch a completion outbox row with a stable Celery task id."""
    now = datetime.now(UTC)
    stale_before = now - DISPATCH_CLAIM_TTL
    claimed = db.execute(
        update(UploadCompletion)
        .where(
            UploadCompletion.id == receipt_id,
            UploadCompletion.dispatched_at.is_(None),
            or_(
                UploadCompletion.dispatch_status == "pending",
                and_(
                    UploadCompletion.dispatch_status == "dispatching",
                    UploadCompletion.dispatch_claimed_at < stale_before,
                ),
            ),
        )
        .values(dispatch_status="dispatching", dispatch_claimed_at=now)
    ).rowcount
    db.commit()
    if not claimed:
        return False

    receipt = db.get(UploadCompletion, receipt_id)
    try:
        sender.send_task(
            "extract_document",
            args=[str(receipt.job_id)],
            task_id=str(receipt.job_id),
        )
    except Exception:
        db.execute(
            update(UploadCompletion)
            .where(
                UploadCompletion.id == receipt_id,
                UploadCompletion.dispatch_status == "dispatching",
            )
            .values(dispatch_status="pending", dispatch_claimed_at=None)
        )
        db.commit()
        raise

    db.execute(
        update(UploadCompletion)
        .where(UploadCompletion.id == receipt_id)
        .values(dispatch_status="dispatched", dispatched_at=datetime.now(UTC))
    )
    db.commit()
    return True
