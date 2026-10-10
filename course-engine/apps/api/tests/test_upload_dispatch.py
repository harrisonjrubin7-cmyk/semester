from datetime import datetime
from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.entities import UploadCompletion
from app.services.upload_dispatch import DISPATCH_CLAIM_TTL, dispatch_upload_completion


class RecordingSender:
    def __init__(self):
        self.calls = []

    def send_task(self, name, *, args, task_id):
        self.calls.append((name, args, task_id))


def test_sqlite_reclaims_naive_stale_dispatch_timestamp():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    receipt_id = uuid4()
    job_id = uuid4()

    with sessions() as db:
        receipt = UploadCompletion(
            id=receipt_id,
            document_id=uuid4(),
            course_id=uuid4(),
            job_id=job_id,
            payload_fingerprint="a" * 64,
            verified_metadata={},
            dispatch_status="dispatching",
            dispatch_claimed_at=datetime.now(),
        )
        receipt.dispatch_claimed_at -= DISPATCH_CLAIM_TTL * 2
        db.add(receipt)
        db.commit()

        sender = RecordingSender()

        assert dispatch_upload_completion(db, receipt_id, sender) is True
        refreshed = db.scalar(
            select(UploadCompletion).where(UploadCompletion.id == receipt_id)
        )
        assert refreshed.dispatch_status == "dispatched"
        assert sender.calls == [
            ("extract_document", [str(job_id)], str(job_id))
        ]

    engine.dispose()
