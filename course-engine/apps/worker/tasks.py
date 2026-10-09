from __future__ import annotations
import tempfile
from pathlib import Path
from uuid import UUID
from celery import Celery
from sqlalchemy import delete, select
from app.core.config import settings
from app.core.database import SessionLocal
from app.extractors.files import extractor_for, safe_zip_members
from app.models.entities import BackgroundJob, Citation, JobStatus, ReviewItem, ReviewStatus, SourceChunk, SourceDocument, StudyAsset, StudyAssetCitation
from app.services.malware import DevelopmentMalwareScanner
from app.services.storage import ObjectStorage, sha256_file, validate_actual_mime

celery = Celery("course_engine", broker=settings.redis_url, backend=settings.redis_url)
storage = ObjectStorage()


@celery.task(name="extract_document")
def extract_document(job_id: str) -> dict:
    db = SessionLocal()
    job = db.get(BackgroundJob, UUID(job_id))
    if not job or not job.document_id:
        return {"error": "job not found"}
    document = db.get(SourceDocument, job.document_id)
    try:
        job.status = JobStatus.running; job.progress = 5; document.status = "extracting"; db.commit()
        path = storage.path(document.storage_key)
        DevelopmentMalwareScanner().scan(path)
        if sha256_file(path) != document.sha256:
            raise ValueError("Uploaded object checksum does not match the initiated upload")
        document.metadata_json = {**document.metadata_json, "detected_mime_type": validate_actual_mime(path)}
        paths = [path]
        if path.suffix.lower() == ".zip":
            temp = tempfile.TemporaryDirectory()
            paths = safe_zip_members(path, Path(temp.name))
        rows = []
        for source_path in paths:
            extractor = extractor_for(source_path)
            if not extractor:
                db.add(ReviewItem(course_id=document.course_id, document_id=document.id, item_type="unsupported_file", title=f"Cannot extract {source_path.name}", payload={"extension": source_path.suffix}))
                continue
            rows.extend(extractor(source_path))
        db.execute(delete(SourceChunk).where(SourceChunk.document_id == document.id))
        for index, row in enumerate(rows):
            chunk = SourceChunk(document_id=document.id, chunk_index=index, content=row.content, content_type=row.content_type, page_number=row.page_number, slide_number=row.slide_number, sheet_name=row.sheet_name, cell_range=row.cell_range, start_seconds=row.start_seconds, end_seconds=row.end_seconds, confidence=row.confidence, metadata_json=row.metadata)
            db.add(chunk); db.flush()
            status = ReviewStatus.confirmed if row.confidence >= .85 else ReviewStatus.needs_review
            db.add(Citation(chunk_id=chunk.id, quote=row.content[:1000], status=status))
            if status == ReviewStatus.needs_review:
                db.add(ReviewItem(course_id=document.course_id, document_id=document.id, item_type="low_confidence_extraction", title=f"Review {source_path.name}", payload={"chunk_id": str(chunk.id), "confidence": row.confidence}))
        if document.classification == "other" and rows:
            sample = " ".join(row.content for row in rows[:5]).lower()
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
        document.status = "needs_review" if any(r.confidence < .85 for r in rows) else "extracted"
        job.status = JobStatus.completed; job.progress = 100; job.result = {"chunks": len(rows)}
        db.commit(); return job.result
    except Exception as exc:
        job.status = JobStatus.failed; job.error = str(exc); document.status = "failed"
        db.add(ReviewItem(course_id=document.course_id, document_id=document.id, item_type="extraction_failed", title=f"Extraction failed for {document.filename}", payload={"error": str(exc)}))
        db.commit(); raise
    finally:
        db.close()


@celery.task(name="generate_study_asset")
def generate_study_asset(job_id: str) -> dict:
    db = SessionLocal()
    job = db.get(BackgroundJob, UUID(job_id))
    if not job:
        return {"error": "job not found"}
    try:
        job.status = JobStatus.running
        job.progress = 10
        db.commit()
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
        existing_id = job.result.get("asset_id")
        asset = db.get(StudyAsset, UUID(existing_id)) if existing_id else None
        if asset:
            asset.content = content
            asset.generation_version += 1
            asset.status = ReviewStatus.confirmed
        else:
            request = job.result.get("request", {})
            asset = StudyAsset(
                course_id=job.course_id,
                asset_type=asset_type,
                title=request.get("title") or asset_type.replace("_", " ").title(),
                content=content,
                status=ReviewStatus.confirmed,
            )
            db.add(asset)
            db.flush()
        db.execute(delete(StudyAssetCitation).where(StudyAssetCitation.study_asset_id == asset.id))
        for citation, _chunk, _document in evidence:
            db.add(StudyAssetCitation(study_asset_id=asset.id, citation_id=citation.id))
        job.status = JobStatus.completed
        job.progress = 100
        job.result = {**job.result, "asset_id": str(asset.id)}
        db.commit()
        return job.result
    except Exception as exc:
        job.status = JobStatus.failed
        job.error = str(exc)
        db.add(ReviewItem(course_id=job.course_id, item_type="generation_failed", title="Study asset could not be generated", payload={"error": str(exc)}))
        db.commit()
        raise
    finally:
        db.close()
