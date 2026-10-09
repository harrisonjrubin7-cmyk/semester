from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.queue import celery_client
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.entities import (
    BackgroundJob,
    CalendarEvent,
    Conflict,
    Course,
    LearnerProgress,
    ReviewItem,
    ReviewStatus,
    SourceChunk,
    SourceDocument,
    StudyAsset,
    StudyExport,
    User,
)
from app.schemas import (
    AssetPatch,
    CalendarEventIn,
    CardReview,
    ConflictResolution,
    CourseCreate,
    CourseOut,
    CoursePatch,
    GenerateAssetRequest,
    LoginRequest,
    RegisterRequest,
    ReviewPatch,
    TokenResponse,
    UploadComplete,
    UploadInitiate,
    UserOut,
)
from app.services.calendar import build_ics
from app.services.exports import export_flashcards_pdf, export_guide_docx, export_guide_pdf
from app.services.storage import ObjectStorage, storage_key, validate_upload

router = APIRouter()
storage = ObjectStorage()


def owned_course(db: Session, user: User, course_id: UUID) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.user_id == user.id, Course.deleted_at.is_(None)))
    if not course:
        raise HTTPException(404, "Course not found")
    return course


def serialize(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


@router.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(409, "Email already registered")
    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user); db.commit(); db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower(), User.deleted_at.is_(None)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/courses", response_model=list[CourseOut])
def list_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Course).where(Course.user_id == user.id, Course.deleted_at.is_(None)).order_by(Course.updated_at.desc())).all()


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(payload: CourseCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = Course(user_id=user.id, **payload.model_dump())
    db.add(course); db.commit(); db.refresh(course)
    return course


@router.get("/courses/{course_id}")
def get_course(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = owned_course(db, user, course_id)
    counts = {
        "files": db.scalar(select(func.count()).select_from(SourceDocument).where(SourceDocument.course_id == course.id, SourceDocument.deleted_at.is_(None))),
        "review_items": db.scalar(select(func.count()).select_from(ReviewItem).where(ReviewItem.course_id == course.id, ReviewItem.status == ReviewStatus.needs_review)),
        "study_assets": db.scalar(select(func.count()).select_from(StudyAsset).where(StudyAsset.course_id == course.id, StudyAsset.deleted_at.is_(None))),
        "calendar_events": db.scalar(select(func.count()).select_from(CalendarEvent).where(CalendarEvent.course_id == course.id, CalendarEvent.deleted_at.is_(None))),
    }
    return {**serialize(course), "counts": counts}


@router.patch("/courses/{course_id}")
def patch_course(course_id: UUID, payload: CoursePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = owned_course(db, user, course_id)
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(course, key, value)
    db.commit(); db.refresh(course)
    return serialize(course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = owned_course(db, user, course_id)
    documents = db.scalars(select(SourceDocument).where(SourceDocument.course_id == course.id)).all()
    for document in documents:
        storage.delete(document.storage_key)
    db.delete(course)
    db.commit()


@router.post("/courses/{course_id}/uploads/initiate")
def initiate_upload(course_id: UUID, payload: UploadInitiate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = owned_course(db, user, course_id)
    try: validate_upload(payload.filename, payload.size_bytes)
    except ValueError as exc: raise HTTPException(400, str(exc)) from exc
    duplicate = db.scalar(select(SourceDocument).where(SourceDocument.course_id == course.id, SourceDocument.sha256 == payload.sha256, SourceDocument.deleted_at.is_(None)))
    if duplicate: raise HTTPException(409, detail={"message": "Duplicate file", "document_id": str(duplicate.id)})
    key = storage_key(str(course.id), payload.filename)
    document = SourceDocument(course_id=course.id, filename=payload.filename, storage_key=key, mime_type=payload.mime_type, size_bytes=payload.size_bytes, sha256=payload.sha256)
    db.add(document); db.commit(); db.refresh(document)
    return {
        "document_id": document.id,
        "upload_url": storage.presign_put(key, payload.mime_type),
        "upload_headers": {"x-amz-server-side-encryption": settings.s3_sse}
        if settings.storage_backend != "local"
        else {},
        "storage_key": key,
    }


@router.put("/uploads/local/{key:path}", status_code=204)
async def local_upload(
    key: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if settings.storage_backend != "local": raise HTTPException(404)
    document = db.scalar(select(SourceDocument).where(SourceDocument.storage_key == key))
    if not document:
        raise HTTPException(404)
    owned_course(db, user, document.course_id)
    path = storage.path(key)
    body = await request.body()
    if len(body) > settings.max_upload_bytes: raise HTTPException(413, "File too large")
    path.write_bytes(body)


@router.post("/courses/{course_id}/uploads/complete")
def complete_upload(course_id: UUID, payload: UploadComplete, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    document = db.scalar(select(SourceDocument).where(SourceDocument.id == payload.document_id, SourceDocument.course_id == course_id, SourceDocument.deleted_at.is_(None)))
    if not document: raise HTTPException(404, "File not found")
    if payload.classification: document.classification = payload.classification
    document.status = "queued"
    job = BackgroundJob(course_id=course_id, document_id=document.id, job_type="extract")
    db.add(job); db.commit(); db.refresh(job)
    celery_client.send_task("extract_document", args=[str(job.id)])
    return {"document": serialize(document), "job": serialize(job)}


@router.get("/courses/{course_id}/files")
def list_files(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(SourceDocument).where(SourceDocument.course_id == course_id, SourceDocument.deleted_at.is_(None)).order_by(SourceDocument.created_at.desc())).all()]


@router.get("/files/{file_id}")
def get_file(file_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(SourceDocument, file_id)
    if not doc: raise HTTPException(404)
    owned_course(db, user, doc.course_id)
    return serialize(doc)


@router.get("/files/{file_id}/source-view")
def source_view(
    file_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.get(SourceDocument, file_id)
    if not doc or doc.deleted_at:
        raise HTTPException(404)
    owned_course(db, user, doc.course_id)
    chunk_filter = SourceChunk.document_id == doc.id
    total = db.scalar(select(func.count()).select_from(SourceChunk).where(chunk_filter)) or 0
    chunks = db.scalars(
        select(SourceChunk)
        .where(chunk_filter)
        .order_by(SourceChunk.chunk_index)
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "document": serialize(doc),
        "chunks": [serialize(chunk) for chunk in chunks],
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(chunks) < total,
    }


@router.get("/files/{file_id}/download")
def download_file(file_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(SourceDocument, file_id)
    if not doc or doc.deleted_at:
        raise HTTPException(404)
    owned_course(db, user, doc.course_id)
    if settings.storage_backend != "local":
        raise HTTPException(501, "Use the production signed-download adapter")
    path = storage.path(doc.storage_key)
    if not path.exists():
        raise HTTPException(404, "Original object is missing")
    return FileResponse(path, filename=doc.filename, media_type=doc.mime_type)


@router.patch("/files/{file_id}/classification")
def classify_file(file_id: UUID, classification: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(SourceDocument, file_id)
    if not doc: raise HTTPException(404)
    owned_course(db, user, doc.course_id); doc.classification = classification; db.commit()
    return serialize(doc)


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(SourceDocument, file_id)
    if not doc: raise HTTPException(404)
    owned_course(db, user, doc.course_id); storage.delete(doc.storage_key); db.delete(doc); db.commit()


@router.post("/files/{file_id}/retry-extraction")
def retry_file(file_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(SourceDocument, file_id)
    if not doc: raise HTTPException(404)
    owned_course(db, user, doc.course_id)
    job = BackgroundJob(course_id=doc.course_id, document_id=doc.id, job_type="extract")
    doc.status = "queued"; db.add(job); db.commit(); db.refresh(job)
    celery_client.send_task("extract_document", args=[str(job.id)])
    return serialize(job)


@router.get("/jobs/{job_id}")
def get_job(job_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.get(BackgroundJob, job_id)
    if not job:
        raise HTTPException(404)
    owned_course(db, user, job.course_id)
    return serialize(job)


@router.get("/courses/{course_id}/review-items")
def review_items(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(ReviewItem).where(ReviewItem.course_id == course_id).order_by(ReviewItem.created_at.desc())).all()]


@router.patch("/review-items/{item_id}")
def review_item(item_id: UUID, payload: ReviewPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(ReviewItem, item_id)
    if not item: raise HTTPException(404)
    owned_course(db, user, item.course_id)
    item.status = ReviewStatus(payload.status); item.resolution_note = payload.resolution_note
    if payload.corrected_payload is not None: item.payload = payload.corrected_payload
    db.commit(); return serialize(item)


@router.get("/courses/{course_id}/conflicts")
def conflicts(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(Conflict).where(Conflict.course_id == course_id)).all()]


@router.post("/conflicts/{conflict_id}/resolve")
def resolve_conflict(conflict_id: UUID, payload: ConflictResolution, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conflict = db.get(Conflict, conflict_id)
    if not conflict: raise HTTPException(404)
    owned_course(db, user, conflict.course_id)
    conflict.status = "resolved" if payload.action != "unresolved" else "open"
    conflict.resolution = payload.model_dump(); db.commit(); return serialize(conflict)


@router.get("/courses/{course_id}/calendar-events")
def calendar_events(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(CalendarEvent).where(CalendarEvent.course_id == course_id, CalendarEvent.deleted_at.is_(None))).all()]


@router.post("/courses/{course_id}/calendar-events", status_code=201)
def create_event(course_id: UUID, payload: CalendarEventIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    event = CalendarEvent(course_id=course_id, **payload.model_dump())
    db.add(event); db.commit(); db.refresh(event); return serialize(event)


@router.patch("/calendar-events/{event_id}")
def patch_event(event_id: UUID, payload: CalendarEventIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.get(CalendarEvent, event_id)
    if not event: raise HTTPException(404)
    owned_course(db, user, event.course_id)
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(event, key, value)
    db.commit(); return serialize(event)


@router.delete("/calendar-events/{event_id}", status_code=204)
def delete_event(event_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.get(CalendarEvent, event_id)
    if not event: raise HTTPException(404)
    owned_course(db, user, event.course_id); event.deleted_at = datetime.now(UTC); db.commit()


@router.get("/courses/{course_id}/calendar.ics")
def calendar_ics(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = owned_course(db, user, course_id)
    events = db.scalars(select(CalendarEvent).where(CalendarEvent.course_id == course_id, CalendarEvent.deleted_at.is_(None))).all()
    return Response(build_ics(course.title, list(events)), media_type="text/calendar", headers={"Content-Disposition": f'attachment; filename="{course_id}.ics"'})


@router.get("/courses/{course_id}/study-assets")
def assets(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(StudyAsset).where(StudyAsset.course_id == course_id, StudyAsset.deleted_at.is_(None)).order_by(StudyAsset.updated_at.desc())).all()]


@router.post("/courses/{course_id}/study-assets/generate", status_code=202)
def generate_asset(course_id: UUID, payload: GenerateAssetRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    job = BackgroundJob(course_id=course_id, job_type=f"generate:{payload.asset_type}", result={"request": payload.model_dump(mode="json")})
    db.add(job); db.commit(); db.refresh(job)
    celery_client.send_task("generate_study_asset", args=[str(job.id)])
    return serialize(job)


@router.get("/study-assets/{asset_id}")
def asset(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(StudyAsset, asset_id)
    if not row or row.deleted_at: raise HTTPException(404)
    owned_course(db, user, row.course_id); return serialize(row)


@router.patch("/study-assets/{asset_id}")
def patch_asset(asset_id: UUID, payload: AssetPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(StudyAsset, asset_id)
    if not row: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(row, key, ReviewStatus(value) if key == "status" else value)
    row.generation_version += 1; db.commit(); return serialize(row)


@router.post("/study-assets/{asset_id}/regenerate", status_code=202)
def regenerate(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(StudyAsset, asset_id)
    if not row: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    job = BackgroundJob(course_id=row.course_id, job_type=f"regenerate:{row.asset_type}", result={"asset_id": str(row.id)})
    db.add(job); db.commit(); db.refresh(job)
    celery_client.send_task("generate_study_asset", args=[str(job.id)])
    return serialize(job)


@router.delete("/study-assets/{asset_id}", status_code=204)
def delete_asset(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(StudyAsset, asset_id)
    if not row: raise HTTPException(404)
    owned_course(db, user, row.course_id); db.delete(row); db.commit()


def _export(asset_id: UUID, fmt: str, user: User, db: Session):
    row = db.get(StudyAsset, asset_id)
    if not row: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    output = settings.local_storage_path / "exports" / f"{row.id}-v{row.generation_version}.{fmt}"
    citations = row.content.get("citations", {})
    if fmt == "pdf": export_guide_pdf(row.title, row.content, citations, output)
    elif fmt == "docx": export_guide_docx(row.title, row.content, citations, output)
    else: export_flashcards_pdf(row.content.get("cards", []), output)
    record = StudyExport(study_asset_id=row.id, format=fmt, storage_key=str(output), generation_version=row.generation_version)
    db.add(record); db.commit(); return FileResponse(output, filename=output.name)


@router.post("/study-assets/{asset_id}/exports/pdf")
def export_pdf(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)): return _export(asset_id, "pdf", user, db)


@router.post("/study-assets/{asset_id}/exports/docx")
def export_docx(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)): return _export(asset_id, "docx", user, db)


@router.post("/study-assets/{asset_id}/exports/flashcards-pdf")
def export_cards(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)): return _export(asset_id, "flashcards.pdf", user, db)


@router.post("/flashcards/{card_id}/review")
def review_card(card_id: UUID, payload: CardReview, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, payload.course_id)
    progress = db.scalar(select(LearnerProgress).where(LearnerProgress.user_id == user.id, LearnerProgress.course_id == payload.course_id, LearnerProgress.concept_id == payload.concept_id))
    if not progress:
        progress = LearnerProgress(user_id=user.id, course_id=payload.course_id, concept_id=payload.concept_id); db.add(progress)
    progress.attempts += 1; progress.correct_attempts += int(payload.correct)
    progress.mastery_score = progress.correct_attempts / progress.attempts
    progress.last_reviewed_at = datetime.now(UTC)
    progress.next_review_at = datetime.now(UTC) + timedelta(days=max(1, payload.confidence * (2 if payload.correct else 1)))
    db.commit(); return serialize(progress)


@router.post("/quizzes/{quiz_id}/attempts")
def quiz_attempt(quiz_id: UUID, payload: dict, user: User = Depends(get_current_user)):
    return {"quiz_id": quiz_id, "recorded": True, "answer_count": len(payload.get("answers", []))}


@router.get("/courses/{course_id}/progress")
def progress(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    rows = db.scalars(select(LearnerProgress).where(LearnerProgress.course_id == course_id, LearnerProgress.user_id == user.id)).all()
    return {"items": [serialize(x) for x in rows], "average_mastery": sum(x.mastery_score for x in rows) / len(rows) if rows else 0}


@router.get("/benchmarks/latest")
def benchmark_latest(user: User = Depends(get_current_user)):
    path = settings.benchmark_output_path / "benchmark_summary.json"
    runs = settings.benchmark_output_path / "benchmark_runs.json"
    return {"generated_at": datetime.now(UTC), "target_pages": 100, "summary": json.loads(path.read_text()) if path.exists() else [], "runs": json.loads(runs.read_text()) if runs.exists() else []}
