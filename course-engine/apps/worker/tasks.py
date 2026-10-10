from __future__ import annotations

import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from celery import Celery
from sqlalchemy import and_, delete, or_, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.extractors.files import extractor_for, safe_zip_members
from app.models.entities import (
    BackgroundJob,
    Citation,
    JobStatus,
    ReviewItem,
    ReviewStatus,
    SourceChunk,
    SourceDocument,
    StudyAsset,
    StudyAssetCitation,
    UploadCompletion,
)
from app.services.job_leases import (
    claim_job,
    commit_job,
    fail_job,
    update_job_progress,
)
from app.services.malware import DevelopmentMalwareScanner
from app.services.storage import ObjectStorage, sha256_file, validate_actual_mime
from app.services.upload_dispatch import dispatch_upload_completion

celery = Celery("course_engine", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.beat_schedule = {
    "recover-upload-dispatches": {
        "task": "recover_upload_dispatches",
        "schedule": 60.0,
    },
}
storage = ObjectStorage()
JOB_LEASE_TTL = timedelta(minutes=5)


def utc_now() -> datetime:
    return datetime.now(UTC)


@celery.task(name="recover_upload_dispatches")
def recover_upload_dispatches() -> dict:
    """Republish pending or abandoned completion outbox rows."""
    cutoff = datetime.now(UTC) - timedelta(minutes=5)
    db = SessionLocal()
    try:
        receipt_ids = db.scalars(
            select(UploadCompletion.id)
            .where(
                UploadCompletion.dispatched_at.is_(None),
                or_(
                    UploadCompletion.dispatch_status == "pending",
                    and_(
                        UploadCompletion.dispatch_status == "dispatching",
                        UploadCompletion.dispatch_claimed_at < cutoff,
                    ),
                ),
            )
            .order_by(UploadCompletion.created_at)
            .limit(100)
        ).all()
    finally:
        db.close()

    dispatched = 0
    failed = 0
    for receipt_id in receipt_ids:
        db = SessionLocal()
        try:
            dispatched += int(dispatch_upload_completion(db, receipt_id, celery))
        except Exception:
            failed += 1
        finally:
            db.close()
    return {"dispatched": dispatched, "failed": failed}


def invalidate_document_assets(db, document: SourceDocument) -> None:
    dependencies = db.execute(
        select(StudyAsset, StudyAssetCitation.citation_id)
        .join(StudyAssetCitation, StudyAssetCitation.study_asset_id == StudyAsset.id)
        .join(Citation, Citation.id == StudyAssetCitation.citation_id)
        .join(SourceChunk, SourceChunk.id == Citation.chunk_id)
        .where(SourceChunk.document_id == document.id)
    ).all()
    for asset, citation_id in dependencies:
        asset.status = ReviewStatus.needs_review
        db.add(ReviewItem(
            course_id=asset.course_id,
            document_id=document.id,
            item_type="stale_study_asset",
            title=f"Regenerate {asset.title}",
            payload={
                "asset_id": str(asset.id),
                "generation_version": asset.generation_version,
                "citation_id": str(citation_id),
            },
        ))
    if dependencies:
        db.execute(delete(StudyAssetCitation).where(
            StudyAssetCitation.citation_id.in_({citation_id for _asset, citation_id in dependencies})
        ))


def _mark_extracting(document: SourceDocument, detected_mime: str) -> None:
    document.status = "extracting"
    document.metadata_json = {
        **document.metadata_json,
        "detected_mime_type": detected_mime,
    }


def _commit_extraction(
    db,
    document_id: UUID,
    path: Path,
    materialized_rows: list[dict],
    unsupported: list[Path],
) -> None:
    document = db.get(SourceDocument, document_id)
    if not document or document.deleted_at:
        raise RuntimeError("Extraction source was deleted")
    db.execute(delete(ReviewItem).where(
        ReviewItem.document_id == document.id,
        ReviewItem.item_type.in_((
            "extracted_evidence",
            "low_confidence_extraction",
            "unsupported_file",
            "no_extractable_content",
        )),
    ))
    for unsupported_path in unsupported:
        db.add(ReviewItem(
            course_id=document.course_id,
            document_id=document.id,
            item_type="unsupported_file",
            title=f"Cannot extract {unsupported_path.name}",
            payload={"extension": unsupported_path.suffix},
        ))
    invalidate_document_assets(db, document)
    db.execute(delete(SourceChunk).where(SourceChunk.document_id == document.id))
    for index, row in enumerate(materialized_rows):
        source_label = row["source_label"]
        chunk = SourceChunk(
            document_id=document.id,
            chunk_index=index,
            **{key: value for key, value in row.items() if key != "source_label"},
        )
        db.add(chunk)
        db.flush()
        citation = Citation(
            chunk_id=chunk.id,
            quote=row["content"][:1000],
            status=ReviewStatus.needs_review,
        )
        db.add(citation)
        db.flush()
        db.add(ReviewItem(
            course_id=document.course_id,
            document_id=document.id,
            item_type="extracted_evidence",
            title=f"Review {source_label}",
            payload={
                "chunk_id": str(chunk.id),
                "citation_id": str(citation.id),
                "confidence": row["confidence"],
            },
        ))
    if document.classification == "other" and materialized_rows:
        sample = " ".join(row["content"] for row in materialized_rows[:5]).lower()
        filename = document.filename.lower()
        if "syllabus" in filename or ("grading" in sample and "schedule" in sample):
            document.classification = "syllabus"
        elif "rubric" in filename or "criteria" in sample:
            document.classification = "rubric"
        elif "assignment" in filename or "due" in sample:
            document.classification = "assignment"
        elif path.suffix.lower() == ".pptx" or "lecture" in filename:
            document.classification = "lecture"
        elif "exam" in filename or "study guide" in sample:
            document.classification = "exam_material"
        else:
            document.classification = "reading"
    if not materialized_rows:
        db.add(ReviewItem(
            course_id=document.course_id,
            document_id=document.id,
            item_type="no_extractable_content",
            title=f"No extractable content in {document.filename}",
            payload={},
        ))
    document.status = "needs_review"


def _commit_extraction_failure(db, document_id: UUID, error: str) -> None:
    document = db.get(SourceDocument, document_id)
    if not document or document.deleted_at:
        return
    document.status = "failed"
    db.add(ReviewItem(
        course_id=document.course_id,
        document_id=document.id,
        item_type="extraction_failed",
        title=f"Extraction failed for {document.filename}",
        payload={"error": error},
    ))


@celery.task(name="extract_document")
def extract_document(job_id: str) -> dict:
    db = SessionLocal()
    parsed_job_id = UUID(job_id)
    job = db.get(BackgroundJob, parsed_job_id)
    if not job or not job.document_id:
        db.close()
        return {"error": "job not found"}
    if job.status == JobStatus.completed:
        db.close()
        return job.result
    lease = claim_job(
        db,
        parsed_job_id,
        f"extract:{uuid4()}",
        utc_now(),
        JOB_LEASE_TTL,
    )
    if lease is None:
        db.expire_all()
        job = db.get(BackgroundJob, parsed_job_id)
        result = job.result if job and job.status == JobStatus.completed else {"status": "leased"}
        db.close()
        return result
    job = db.get(BackgroundJob, parsed_job_id)
    document = db.get(SourceDocument, job.document_id)
    try:
        if not update_job_progress(
            db,
            lease,
            utc_now(),
            JOB_LEASE_TTL,
            5,
            lambda session: setattr(
                session.get(SourceDocument, job.document_id), "status", "scanning"
            ),
        ):
            return {"status": "lease_lost"}
        path = storage.path(document.storage_key)
        DevelopmentMalwareScanner().scan(path)
        if sha256_file(path) != document.sha256:
            raise ValueError("Uploaded object checksum does not match the initiated upload")
        detected_mime = validate_actual_mime(path)
        if not update_job_progress(
            db,
            lease,
            utc_now(),
            JOB_LEASE_TTL,
            10,
            lambda session: _mark_extracting(
                session.get(SourceDocument, job.document_id), detected_mime
            ),
        ):
            return {"status": "lease_lost"}
        paths = [path]
        if path.suffix.lower() == ".zip":
            temp = tempfile.TemporaryDirectory()
            paths = safe_zip_members(path, Path(temp.name))
        rows = []
        unsupported = []
        for source_path in paths:
            extractor = extractor_for(source_path)
            if not extractor:
                unsupported.append(source_path)
                continue
            source_label = (
                source_path.relative_to(Path(temp.name)).as_posix()
                if path.suffix.lower() == ".zip"
                else source_path.name
            )
            rows.extend((source_label, row) for row in extractor(source_path))
        materialized_rows = []
        for source_label, row in rows:
            metadata = dict(row.metadata)
            if path.suffix.lower() == ".zip":
                metadata["archive_member"] = source_label
            if not isinstance(row.content, str):
                raise ValueError("Extracted chunk content must be text")
            materialized_rows.append({
                "source_label": source_label,
                "content": row.content,
                "content_type": row.content_type,
                "page_number": row.page_number,
                "slide_number": row.slide_number,
                "sheet_name": row.sheet_name,
                "cell_range": row.cell_range,
                "start_seconds": row.start_seconds,
                "end_seconds": row.end_seconds,
                "confidence": row.confidence,
                "metadata_json": metadata,
            })
        result = {"chunks": len(materialized_rows)}
        completed = commit_job(
            db,
            lease,
            utc_now(),
            result,
            lambda session: _commit_extraction(
                session,
                job.document_id,
                path,
                materialized_rows,
                unsupported,
            ),
        )
        return result if completed else {"status": "lease_lost"}
    except Exception as exc:
        db.rollback()
        failed = fail_job(
            db,
            lease,
            utc_now(),
            str(exc),
            lambda session: _commit_extraction_failure(session, job.document_id, str(exc)),
        )
        if failed:
            raise
        return {"status": "lease_lost"}
    finally:
        db.close()


def _commit_generation(
    db,
    course_id: UUID,
    asset_id: UUID,
    existing_target: bool,
    asset_type: str,
    request: dict,
    content: dict,
    evidence: list,
) -> None:
    asset = db.get(StudyAsset, asset_id) if existing_target else None
    if existing_target and (not asset or asset.deleted_at or asset.course_id != course_id):
        raise RuntimeError("Study asset generation target was deleted or revoked")
    if asset:
        asset.content = content
        asset.generation_version += 1
        asset.status = ReviewStatus.needs_review
    else:
        asset = StudyAsset(
            id=asset_id,
            course_id=course_id,
            asset_type=asset_type,
            title=request.get("title") or asset_type.replace("_", " ").title(),
            content=content,
            status=ReviewStatus.needs_review,
        )
        db.add(asset)
        db.flush()
    db.execute(delete(StudyAssetCitation).where(StudyAssetCitation.study_asset_id == asset.id))
    for citation, _chunk, _document in evidence:
        db.add(StudyAssetCitation(study_asset_id=asset.id, citation_id=citation.id))
    db.add(ReviewItem(
        course_id=course_id,
        item_type="generated_study_asset",
        title=f"Review {asset.title}",
        payload={"asset_id": str(asset.id), "generation_version": asset.generation_version},
    ))


@celery.task(name="generate_study_asset")
def generate_study_asset(job_id: str) -> dict:
    db = SessionLocal()
    parsed_job_id = UUID(job_id)
    job = db.get(BackgroundJob, parsed_job_id)
    if not job:
        db.close()
        return {"error": "job not found"}
    if job.status == JobStatus.completed:
        db.close()
        return job.result
    lease = claim_job(
        db,
        parsed_job_id,
        f"generate:{uuid4()}",
        utc_now(),
        JOB_LEASE_TTL,
    )
    if lease is None:
        db.expire_all()
        job = db.get(BackgroundJob, parsed_job_id)
        result = job.result if job and job.status == JobStatus.completed else {"status": "leased"}
        db.close()
        return result
    job = db.get(BackgroundJob, parsed_job_id)
    try:
        if not update_job_progress(db, lease, utc_now(), JOB_LEASE_TTL, 10):
            return {"status": "lease_lost"}
        evidence = db.execute(
            select(Citation, SourceChunk, SourceDocument)
            .join(SourceChunk, Citation.chunk_id == SourceChunk.id)
            .join(SourceDocument, SourceChunk.document_id == SourceDocument.id)
            .where(
                SourceDocument.course_id == job.course_id,
                Citation.status == ReviewStatus.confirmed,
                SourceDocument.deleted_at.is_(None),
            )
            .limit(50)
        ).all()
        if not evidence:
            raise ValueError("No confirmed citation-linked evidence is available")
        asset_type = job.job_type.split(":", 1)[1]
        citation_catalog = {}
        for citation, chunk, document in evidence:
            location = (
                f"p. {chunk.page_number}" if chunk.page_number else
                f"slide {chunk.slide_number}" if chunk.slide_number else
                f"{chunk.sheet_name} {chunk.cell_range}" if chunk.sheet_name else
                f"{chunk.start_seconds:.0f}s" if chunk.start_seconds is not None else "source"
            )
            citation_catalog[str(citation.id)] = {"label": f"{document.filename}, {location}", "quote": citation.quote}
        if asset_type == "flashcards":
            cards = [
                {
                    "id": str(UUID(int=(index + 1))),
                    "front": f"Explain the evidence from {document.filename} at its cited location.",
                    "back": citation.quote,
                    "difficulty": 3,
                    "unit": None,
                    "citation_ids": [str(citation.id)],
                    "source_label": citation_catalog[str(citation.id)]["label"],
                }
                for index, (citation, _chunk, document) in enumerate(evidence[:10])
            ]
            content = {"cards": cards, "citations": citation_catalog}
        else:
            sections = [
                {
                    "heading": f"Verified source {index + 1}",
                    "explanation": citation.quote,
                    "key_points": [],
                    "examples": [],
                    "citation_ids": [str(citation.id)],
                }
                for index, (citation, _chunk, _document) in enumerate(evidence[:12])
            ]
            content = {"sections": sections, "study_questions": [], "source_gaps": [], "citations": citation_catalog}
        existing_id = job.target_id or (
            UUID(job.result["asset_id"]) if job.result.get("asset_id") else None
        )
        asset_id = existing_id or uuid4()
        result = {**job.result, "asset_id": str(asset_id)}
        completed = commit_job(
            db,
            lease,
            utc_now(),
            result,
            lambda session: _commit_generation(
                session,
                job.course_id,
                asset_id,
                existing_id is not None,
                asset_type,
                job.result.get("request", {}),
                content,
                evidence,
            ),
        )
        return result if completed else {"status": "lease_lost"}
    except Exception as exc:
        db.rollback()
        failed = fail_job(
            db,
            lease,
            utc_now(),
            str(exc),
            lambda session: session.add(ReviewItem(
                course_id=lease.course_id,
                item_type="generation_failed",
                title="Study asset could not be generated",
                payload={"error": str(exc)},
            )),
        )
        if failed:
            raise
        return {"status": "lease_lost"}
    finally:
        db.close()
