from __future__ import annotations

import base64
import hashlib
import json
import os
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import pymupdf as fitz
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.queue import celery_client
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.entities import (
    BackgroundJob,
    CalendarEvent,
    Citation,
    CommandReceipt,
    Concept,
    Conflict,
    Course,
    JobStatus,
    LearnerProgress,
    ReviewItem,
    ReviewStatus,
    SourceChunk,
    SourceDocument,
    StudyAsset,
    StudyAssetCitation,
    StudyExport,
    StudySession,
    UploadCompletion,
    User,
    WorkspaceGrant,
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
    InstitutionCommandRequest,
    LoginRequest,
    QuizAttempt,
    RegisterRequest,
    ReviewPatch,
    TokenResponse,
    UploadComplete,
    UploadInitiate,
    UserOut,
)
from app.services.calendar import build_ics
from app.services.citations import (
    UnsupportedCitationError,
    canonicalize_study_asset_citations,
    validate_study_asset_content,
)
from app.services.exports import export_flashcards_pdf, export_guide_docx, export_guide_pdf
from app.services.institution_commands import _is_active, submit_institution_command
from app.services.job_leases import revoke_job
from app.services.storage import (
    MIME_FAMILIES,
    ObjectInspectionError,
    ObjectStorage,
    normalize_upload_mime,
    sha256_file,
    storage_key,
    validate_upload,
)
from app.services.upload_dispatch import dispatch_upload_completion

router = APIRouter()
storage = ObjectStorage()


def owned_course(db: Session, user: User, course_id: UUID) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.user_id == user.id, Course.deleted_at.is_(None)))
    if not course:
        raise HTTPException(404, "Course not found")
    return course


def serialize(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def serialize_completion_receipt(receipt: UploadCompletion) -> dict:
    """Return the durable idempotency receipt without transient outbox state."""
    transient_fields = {
        "dispatch_status",
        "dispatch_claimed_at",
        "dispatched_at",
        "updated_at",
    }
    return {
        column.name: getattr(receipt, column.name)
        for column in receipt.__table__.columns
        if column.name not in transient_fields
    }


def valid_guide_sections(content: dict) -> list[dict]:
    sections = content.get("sections")
    if not isinstance(sections, list):
        return []
    valid = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        if not isinstance(section.get("heading"), str) or not isinstance(section.get("explanation"), str):
            continue
        citation_ids = section.get("citation_ids")
        if not isinstance(citation_ids, list) or not all(isinstance(value, str) for value in citation_ids):
            continue
        if any(
            key in section and (
                not isinstance(section[key], list)
                or not all(isinstance(value, str) for value in section[key])
            )
            for key in ("key_points", "examples")
        ):
            continue
        valid.append(section)
    return valid


def merge_job_snapshots(
    active_jobs: list[BackgroundJob],
    recent_terminal_jobs: list[BackgroundJob],
) -> list[BackgroundJob]:
    jobs_by_id = {job.id: job for job in recent_terminal_jobs}
    jobs_by_id.update({job.id: job for job in active_jobs})
    return sorted(jobs_by_id.values(), key=lambda job: job.created_at, reverse=True)


def _citation_label(document: SourceDocument, chunk: SourceChunk) -> str:
    archive_member = (chunk.metadata_json or {}).get("archive_member")
    source_name = (
        f"{document.filename} › {archive_member}"
        if isinstance(archive_member, str) and archive_member.strip()
        else document.filename
    )
    location = (
        f"p. {chunk.page_number}" if chunk.page_number is not None else
        f"slide {chunk.slide_number}" if chunk.slide_number is not None else
        f"{chunk.sheet_name} {chunk.cell_range}" if chunk.sheet_name else
        f"{chunk.start_seconds:.0f}s" if chunk.start_seconds is not None else
        "source"
    )
    return f"{source_name}, {location}"


def current_asset_citations(
    db: Session,
    asset: StudyAsset,
) -> tuple[set[UUID], dict[str, dict[str, str]]]:
    linked = set(db.scalars(
        select(StudyAssetCitation.citation_id).where(
            StudyAssetCitation.study_asset_id == asset.id,
        )
    ).all())
    approved_rows = db.execute(
        select(Citation, SourceChunk, SourceDocument)
        .join(StudyAssetCitation, StudyAssetCitation.citation_id == Citation.id)
        .join(SourceChunk, Citation.chunk_id == SourceChunk.id)
        .join(SourceDocument, SourceChunk.document_id == SourceDocument.id)
        .where(
            StudyAssetCitation.study_asset_id == asset.id,
            Citation.status == ReviewStatus.confirmed,
            SourceDocument.course_id == asset.course_id,
            SourceDocument.deleted_at.is_(None),
        )
    ).all()
    approved = {citation.id for citation, _chunk, _document in approved_rows}
    if not linked or approved != linked:
        raise UnsupportedCitationError("Study asset citations are no longer approved")
    catalog = {
        str(citation.id): {
            "label": _citation_label(document, chunk),
            "quote": citation.quote,
        }
        for citation, chunk, document in approved_rows
    }
    return approved, catalog


def invalidate_citation_dependents(db: Session, citation: Citation) -> None:
    assets = db.scalars(
        select(StudyAsset)
        .join(StudyAssetCitation, StudyAssetCitation.study_asset_id == StudyAsset.id)
        .where(StudyAssetCitation.citation_id == citation.id)
    ).all()
    for asset in assets:
        asset.status = ReviewStatus.needs_review
        db.add(ReviewItem(
            course_id=asset.course_id,
            item_type="stale_study_asset",
            title=f"Regenerate {asset.title}",
            payload={
                "asset_id": str(asset.id),
                "generation_version": asset.generation_version,
                "citation_id": str(citation.id),
            },
        ))
    db.execute(delete(StudyAssetCitation).where(StudyAssetCitation.citation_id == citation.id))


@router.post("/institutions/{institution_id}/commands", status_code=202)
def create_institution_command(
    institution_id: UUID,
    payload: InstitutionCommandRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=240),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receipt, replayed = submit_institution_command(
        db,
        institution_id,
        user,
        payload.command_type,
        payload.payload,
        idempotency_key,
    )
    return {**serialize(receipt), "replayed": replayed}


@router.get("/institutions/{institution_id}/commands")
def list_institution_commands(
    institution_id: UUID,
    cursor: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grants = db.scalars(
        select(WorkspaceGrant).where(
            WorkspaceGrant.institution_id == institution_id,
            WorkspaceGrant.user_id == user.id,
            WorkspaceGrant.role.in_({"registrar", "institution", "operations"}),
        )
    ).all()
    now = datetime.now(UTC)
    if not any(_is_active(grant, now) for grant in grants):
        raise HTTPException(403, "Institution operations grant required")
    statement = select(CommandReceipt).where(CommandReceipt.institution_id == institution_id)
    if cursor is not None:
        anchor = db.scalar(
            select(CommandReceipt).where(
                CommandReceipt.id == cursor,
                CommandReceipt.institution_id == institution_id,
            )
        )
        if anchor is None:
            raise HTTPException(404, "Command cursor not found")
        statement = statement.where(
            CommandReceipt.id != cursor,
            or_(
                CommandReceipt.created_at < anchor.created_at,
                and_(
                    CommandReceipt.created_at == anchor.created_at,
                    CommandReceipt.id < anchor.id,
                ),
            ),
        )
    receipts = db.scalars(
        statement.order_by(CommandReceipt.created_at.desc(), CommandReceipt.id.desc()).limit(
            limit + 1
        )
    ).all()
    has_more = len(receipts) > limit
    items = receipts[:limit]
    return {
        "items": [serialize(receipt) for receipt in items],
        "next_cursor": str(items[-1].id) if has_more else None,
    }


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
    try: validate_upload(payload.filename, payload.size_bytes, payload.mime_type)
    except ValueError as exc: raise HTTPException(400, str(exc)) from exc
    mime_type = normalize_upload_mime(payload.filename, payload.mime_type)
    checksum = payload.sha256.lower()
    duplicate = db.scalar(select(SourceDocument).where(SourceDocument.course_id == course.id, SourceDocument.sha256 == checksum, SourceDocument.deleted_at.is_(None)))
    if duplicate: raise HTTPException(409, detail={"message": "Duplicate file", "document_id": str(duplicate.id)})
    key = storage_key(str(course.id), payload.filename)
    document = SourceDocument(course_id=course.id, filename=payload.filename, storage_key=key, mime_type=mime_type, size_bytes=payload.size_bytes, sha256=checksum)
    db.add(document); db.commit(); db.refresh(document)
    return {
        "document_id": document.id,
        "upload_url": storage.presign_put(
            key,
            mime_type,
            size_bytes=payload.size_bytes,
            sha256=checksum,
        ),
        "upload_headers": {
            "content-type": mime_type,
            "x-amz-checksum-sha256": base64.b64encode(
                bytes.fromhex(checksum)
            ).decode(),
            "x-amz-server-side-encryption": settings.s3_sse,
        }
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
    completed = db.scalar(select(UploadCompletion.id).where(
        UploadCompletion.document_id == document.id
    ))
    if completed or document.status != "uploaded":
        raise HTTPException(409, "Original upload is already closed")
    path = storage.path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.uploading-", dir=path.parent
    )
    temporary_path = Path(temporary_name)
    received = 0
    try:
        with os.fdopen(descriptor, "wb") as destination:
            async for chunk in request.stream():
                received += len(chunk)
                if received > settings.max_upload_bytes:
                    raise HTTPException(413, "File too large")
                destination.write(chunk)
            destination.flush()
            os.fsync(destination.fileno())
        if received != document.size_bytes or sha256_file(temporary_path) != document.sha256:
            raise HTTPException(409, "Uploaded bytes do not match the initiated upload")
        os.replace(temporary_path, path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


@router.post("/courses/{course_id}/uploads/complete")
def complete_upload(course_id: UUID, payload: UploadComplete, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    document = db.scalar(select(SourceDocument).where(SourceDocument.id == payload.document_id, SourceDocument.course_id == course_id, SourceDocument.deleted_at.is_(None)))
    if not document: raise HTTPException(404, "File not found")
    document_id = document.id
    classification = payload.classification or document.classification
    fingerprint = hashlib.sha256(json.dumps(
        {"document_id": str(document.id), "classification": classification},
        sort_keys=True,
        separators=(",", ":"),
    ).encode()).hexdigest()
    existing = db.scalar(select(UploadCompletion).where(
        UploadCompletion.document_id == document.id
    ))
    if existing:
        if existing.payload_fingerprint != fingerprint:
            raise HTTPException(409, "Upload was already completed with different data")
        job = db.get(BackgroundJob, existing.job_id)
        dispatch_upload_completion(db, existing.id, celery_client)
        db.refresh(existing)
        return {
            "document": serialize(document),
            "receipt": serialize_completion_receipt(existing),
            "job": serialize(job),
        }
    try:
        metadata = storage.inspect(document.storage_key)
    except (OSError, ValueError) as exc:
        raise HTTPException(409, str(exc)) from exc
    expected_prefix = f"courses/{course_id}/originals/"
    expected_mimes = MIME_FAMILIES.get(Path(document.filename).suffix.lower())
    valid = (
        metadata.key == document.storage_key
        and metadata.key.startswith(expected_prefix)
        and metadata.size_bytes == document.size_bytes
        and metadata.size_bytes <= settings.max_upload_bytes
        and metadata.checksum_sha256 == document.sha256.lower()
        and metadata.owner_verified
        and expected_mimes is not None
        and metadata.content_type in expected_mimes
        and document.mime_type in expected_mimes
    )
    if metadata.backend == "s3":
        valid = valid and (
            metadata.bucket == settings.s3_bucket
            and metadata.encryption == settings.s3_sse
            and metadata.content_type == document.mime_type
        )
    elif metadata.backend == "local":
        valid = valid and metadata.bucket is None and metadata.encryption is None
    else:
        valid = False
    if not valid:
        raise HTTPException(409, "Uploaded object metadata does not match the initiated upload")

    document.classification = classification
    document.status = "quarantined"
    job = BackgroundJob(course_id=course_id, document_id=document.id, job_type="extract")
    db.add(job)
    try:
        db.flush()
        receipt = UploadCompletion(
            course_id=course_id,
            document_id=document_id,
            job_id=job.id,
            payload_fingerprint=fingerprint,
            verified_metadata={
                field: getattr(metadata, field)
                for field in (
                    "backend",
                    "bucket",
                    "key",
                    "size_bytes",
                    "content_type",
                    "checksum_sha256",
                    "encryption",
                    "owner_verified",
                )
            },
        )
        db.add(receipt)
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(select(UploadCompletion).where(
            UploadCompletion.document_id == document_id
        ))
        if not existing or existing.payload_fingerprint != fingerprint:
            raise HTTPException(409, "Upload was already completed with different data")
        document = db.get(SourceDocument, document_id)
        job = db.get(BackgroundJob, existing.job_id)
        dispatch_upload_completion(db, existing.id, celery_client)
        db.refresh(existing)
        return {
            "document": serialize(document),
            "receipt": serialize_completion_receipt(existing),
            "job": serialize(job),
        }
    db.refresh(job)
    db.refresh(receipt)
    dispatch_upload_completion(db, receipt.id, celery_client)
    db.refresh(receipt)
    return {
        "document": serialize(document),
        "receipt": serialize_completion_receipt(receipt),
        "job": serialize(job),
    }


@router.get("/courses/{course_id}/files")
def list_files(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(SourceDocument).where(SourceDocument.course_id == course_id, SourceDocument.deleted_at.is_(None)).order_by(SourceDocument.created_at.desc())).all()]


@router.get("/courses/{course_id}/jobs")
def list_jobs(
    course_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_course(db, user, course_id)
    active_statuses = (JobStatus.queued, JobStatus.running)
    active_jobs = db.scalars(
        select(BackgroundJob)
        .where(
            BackgroundJob.course_id == course_id,
            BackgroundJob.status.in_(active_statuses),
            BackgroundJob.revoked_at.is_(None),
        )
        .order_by(BackgroundJob.created_at.desc())
    ).all()
    recent_terminal_jobs = db.scalars(
        select(BackgroundJob)
        .where(
            BackgroundJob.course_id == course_id,
            BackgroundJob.status.not_in(active_statuses),
        )
        .order_by(BackgroundJob.created_at.desc())
        .limit(limit)
    ).all()
    jobs = merge_job_snapshots(active_jobs, recent_terminal_jobs)
    return [serialize(job) for job in jobs]


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
    review_by_chunk_id: dict[str, ReviewItem] = {}
    chunk_ids = {str(chunk.id) for chunk in chunks}
    if chunk_ids:
        for item in db.scalars(
            select(ReviewItem)
            .where(
                ReviewItem.document_id == doc.id,
                ReviewItem.item_type == "extracted_evidence",
                ReviewItem.payload["chunk_id"].as_string().in_(chunk_ids),
            )
            .order_by(ReviewItem.created_at.desc())
        ).all():
            chunk_id = item.payload.get("chunk_id") if isinstance(item.payload, dict) else None
            if isinstance(chunk_id, str) and chunk_id not in review_by_chunk_id:
                review_by_chunk_id[chunk_id] = item
    serialized_chunks = []
    for chunk in chunks:
        serialized = serialize(chunk)
        review = review_by_chunk_id.get(str(chunk.id))
        serialized["review_item_id"] = str(review.id) if review else None
        serialized["review_status"] = review.status.value if review else None
        serialized["preview_available"] = (
            Path(doc.filename).suffix.lower() == ".pdf"
            and chunk.page_number is not None
            and chunk.bounding_box is not None
        )
        serialized_chunks.append(serialized)
    return {
        "document": serialize(doc),
        "chunks": serialized_chunks,
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(chunks) < total,
    }


@router.get("/files/{file_id}/pages/{page_number}/preview")
def source_page_preview(
    file_id: UUID,
    page_number: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.get(SourceDocument, file_id)
    if not doc or doc.deleted_at:
        raise HTTPException(404)
    owned_course(db, user, doc.course_id)
    if Path(doc.filename).suffix.lower() != ".pdf":
        raise HTTPException(415, "Page previews are available only for PDF sources")
    try:
        payload = storage.read_bytes(doc.storage_key, max_bytes=settings.max_upload_bytes)
        with fitz.open(stream=payload, filetype="pdf") as document:
            if page_number < 1 or page_number > document.page_count:
                raise HTTPException(404, "Source page does not exist")
            page = document.load_page(page_number - 1)
            longest_edge = max(float(page.rect.width), float(page.rect.height), 1.0)
            scale = min(2.0, 2048.0 / longest_edge)
            preview = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes("png")
    except HTTPException:
        raise
    except ObjectInspectionError as exc:
        raise HTTPException(502, "Original object could not be loaded") from exc
    except (fitz.FileDataError, RuntimeError, ValueError) as exc:
        raise HTTPException(422, "PDF preview could not be rendered") from exc
    return Response(
        content=preview,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )


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
    doc = db.scalar(
        select(SourceDocument)
        .where(SourceDocument.id == file_id, SourceDocument.deleted_at.is_(None))
        .with_for_update()
    )
    if not doc: raise HTTPException(404)
    owned_course(db, user, doc.course_id)
    if not db.scalar(select(UploadCompletion.id).where(UploadCompletion.document_id == doc.id)):
        raise HTTPException(409, "Upload must be completed before retrying extraction")
    active_job = db.scalar(
        select(BackgroundJob)
        .where(
            BackgroundJob.document_id == doc.id,
            BackgroundJob.job_type == "extract",
            BackgroundJob.status.in_((JobStatus.queued, JobStatus.running)),
            BackgroundJob.revoked_at.is_(None),
        )
        .order_by(BackgroundJob.created_at.desc())
        .limit(1)
    )
    if active_job:
        if active_job.status == JobStatus.queued:
            celery_client.send_task(
                "extract_document",
                args=[str(active_job.id)],
                task_id=str(active_job.id),
            )
        return serialize(active_job)
    job = BackgroundJob(course_id=doc.course_id, document_id=doc.id, job_type="extract")
    doc.status = "queued"
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        job = db.scalar(
            select(BackgroundJob)
            .where(
                BackgroundJob.document_id == file_id,
                BackgroundJob.job_type == "extract",
                BackgroundJob.status.in_((JobStatus.queued, JobStatus.running)),
                BackgroundJob.revoked_at.is_(None),
            )
            .order_by(BackgroundJob.created_at.desc())
            .limit(1)
        )
        if not job:
            raise
    db.refresh(job)
    celery_client.send_task(
        "extract_document",
        args=[str(job.id)],
        task_id=str(job.id),
    )
    return serialize(job)


@router.get("/jobs/{job_id}")
def get_job(job_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.get(BackgroundJob, job_id)
    if not job:
        raise HTTPException(404)
    owned_course(db, user, job.course_id)
    return serialize(job)


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.get(BackgroundJob, job_id)
    if not job:
        raise HTTPException(404)
    owned_course(db, user, job.course_id)
    if job.revoked_at is not None:
        return serialize(job)
    if job.status in (JobStatus.completed, JobStatus.failed):
        raise HTTPException(409, "Terminal jobs cannot be cancelled")
    changed = revoke_job(
        db,
        job.id,
        job.course_id,
        datetime.now(UTC),
        "Cancelled by user",
        commit=False,
    )
    if not changed:
        db.rollback()
        db.refresh(job)
        if job.revoked_at is None:
            raise HTTPException(409, "Terminal jobs cannot be cancelled")
        return serialize(job)
    _restore_cancelled_extraction_document(db, job)
    db.refresh(job)
    return serialize(job)


def _restore_cancelled_extraction_document(db: Session, job: BackgroundJob) -> None:
    if job.job_type != "extract" or not job.document_id:
        db.commit()
        return
    another_active_job = db.scalar(
        select(BackgroundJob.id).where(
            BackgroundJob.document_id == job.document_id,
            BackgroundJob.id != job.id,
            BackgroundJob.job_type == "extract",
            BackgroundJob.status.in_((JobStatus.queued, JobStatus.running)),
            BackgroundJob.revoked_at.is_(None),
        )
    )
    document = db.get(SourceDocument, job.document_id)
    if document and not document.deleted_at and not another_active_job:
        document.status = "uploaded"
    db.commit()


@router.get("/courses/{course_id}/review-items")
def review_items(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    return [serialize(x) for x in db.scalars(select(ReviewItem).where(ReviewItem.course_id == course_id).order_by(ReviewItem.created_at.desc())).all()]


@router.patch("/review-items/{item_id}")
def review_item(item_id: UUID, payload: ReviewPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(ReviewItem, item_id)
    if not item: raise HTTPException(404)
    owned_course(db, user, item.course_id)
    if item.item_type == "generated_study_asset":
        if payload.corrected_payload is not None:
            raise HTTPException(400, "Edit the study asset before reviewing it")
        try:
            asset_id = UUID(item.payload["asset_id"])
            reviewed_version = int(item.payload["generation_version"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(409, "Study asset review target is invalid") from exc
        asset = db.get(StudyAsset, asset_id)
        if not asset or asset.deleted_at or asset.course_id != item.course_id:
            raise HTTPException(409, "Study asset review target is unavailable")
        if asset.generation_version != reviewed_version:
            raise HTTPException(409, "Study asset review is stale")
        if payload.status == ReviewStatus.confirmed.value:
            try:
                allowed_citations, citation_catalog = current_asset_citations(db, asset)
                validate_study_asset_content(asset.asset_type, asset.content, allowed_citations)
            except UnsupportedCitationError as exc:
                raise HTTPException(422, str(exc)) from exc
            asset.content = canonicalize_study_asset_citations(
                asset.asset_type,
                asset.content,
                citation_catalog,
            )
        asset.status = ReviewStatus(payload.status)
    elif item.item_type == "extracted_evidence":
        try:
            chunk_id = UUID(item.payload["chunk_id"])
            citation_id = UUID(item.payload["citation_id"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(409, "Extracted evidence review target is invalid") from exc
        chunk = db.get(SourceChunk, chunk_id)
        citation = db.get(Citation, citation_id)
        document = db.get(SourceDocument, chunk.document_id) if chunk else None
        if (
            not chunk
            or not citation
            or citation.chunk_id != chunk.id
            or not document
            or document.course_id != item.course_id
        ):
            raise HTTPException(409, "Extracted evidence review target is unavailable")
        if payload.corrected_payload is not None:
            corrected_content = payload.corrected_payload.get("content")
            if not isinstance(corrected_content, str) or not corrected_content.strip():
                raise HTTPException(400, "Corrected extracted evidence requires non-empty content")
            chunk.content = corrected_content
            citation.quote = corrected_content[:1000]
            item.payload = {**item.payload, "correction": payload.corrected_payload}
        if payload.corrected_payload is not None or citation.status != ReviewStatus(payload.status):
            invalidate_citation_dependents(db, citation)
        citation.status = ReviewStatus(payload.status)
        item.status = ReviewStatus(payload.status)
        item.resolution_note = payload.resolution_note
        db.commit()
        return serialize(item)
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
    if not row or row.deleted_at: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") == ReviewStatus.confirmed.value:
        raise HTTPException(409, "Confirm the current version through its review item")
    content_changed = "title" in changes or "content" in changes
    for key, value in changes.items():
        setattr(row, key, ReviewStatus(value) if key == "status" else value)
    if content_changed:
        row.generation_version += 1
        row.status = ReviewStatus.needs_review
        db.add(ReviewItem(
            course_id=row.course_id,
            item_type="generated_study_asset",
            title=f"Review {row.title}",
            payload={"asset_id": str(row.id), "generation_version": row.generation_version},
        ))
    db.commit(); return serialize(row)


@router.post("/study-assets/{asset_id}/regenerate", status_code=202)
def regenerate(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(
        select(StudyAsset)
        .where(StudyAsset.id == asset_id, StudyAsset.deleted_at.is_(None))
        .with_for_update()
    )
    if not row: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    job = BackgroundJob(
        course_id=row.course_id,
        target_id=row.id,
        job_type=f"regenerate:{row.asset_type}",
        result={"asset_id": str(row.id)},
    )
    db.add(job); db.commit(); db.refresh(job)
    celery_client.send_task("generate_study_asset", args=[str(job.id)])
    return serialize(job)


@router.delete("/study-assets/{asset_id}", status_code=204)
def delete_asset(asset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(
        select(StudyAsset)
        .where(StudyAsset.id == asset_id, StudyAsset.deleted_at.is_(None))
        .with_for_update()
    )
    if not row: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    jobs = db.scalars(
        select(BackgroundJob).where(
            BackgroundJob.course_id == row.course_id,
            BackgroundJob.target_id == row.id,
            BackgroundJob.status != JobStatus.completed,
            BackgroundJob.revoked_at.is_(None),
        )
    ).all()
    for job in jobs:
        revoke_job(
            db,
            job.id,
            row.course_id,
            datetime.now(UTC),
            "Study asset deleted",
            commit=False,
        )
    row.deleted_at = datetime.now(UTC)
    db.commit()


def _export(asset_id: UUID, fmt: str, user: User, db: Session):
    row = db.get(StudyAsset, asset_id)
    if not row or row.deleted_at: raise HTTPException(404)
    owned_course(db, user, row.course_id)
    if row.status != ReviewStatus.confirmed:
        raise HTTPException(409, "Study asset must be confirmed before export")
    try:
        allowed_citations, citation_catalog = current_asset_citations(db, row)
        validate_study_asset_content(row.asset_type, row.content, allowed_citations)
        export_content = canonicalize_study_asset_citations(
            row.asset_type,
            row.content,
            citation_catalog,
        )
    except UnsupportedCitationError as exc:
        row.status = ReviewStatus.needs_review
        db.add(ReviewItem(
            course_id=row.course_id,
            item_type="generated_study_asset",
            title=f"Review {row.title}",
            payload={"asset_id": str(row.id), "generation_version": row.generation_version},
        ))
        db.commit()
        raise HTTPException(409, str(exc)) from exc
    output = settings.local_storage_path / "exports" / f"{row.id}-v{row.generation_version}.{fmt}"
    citations = export_content["citations"]
    if fmt == "pdf": export_guide_pdf(row.title, export_content, citations, output)
    elif fmt == "docx": export_guide_docx(row.title, export_content, citations, output)
    else: export_flashcards_pdf(export_content.get("cards", []), output)
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
    if payload.concept_id is not None and not db.scalar(select(Concept.id).where(
        Concept.id == payload.concept_id,
        Concept.course_id == payload.course_id,
    )):
        raise HTTPException(404, "Concept not found")
    asset = db.scalar(select(StudyAsset).where(
        StudyAsset.id == payload.asset_id,
        StudyAsset.course_id == payload.course_id,
        StudyAsset.asset_type == "flashcards",
        StudyAsset.status != ReviewStatus.rejected,
        StudyAsset.deleted_at.is_(None),
    ))
    card_exists = asset is not None and any(
        str(card.get("id")) == str(card_id)
        for card in asset.content.get("cards", [])
        if isinstance(card, dict)
    )
    if not card_exists:
        raise HTTPException(404, "Flashcard not found")
    progress = db.scalar(select(LearnerProgress).where(LearnerProgress.user_id == user.id, LearnerProgress.course_id == payload.course_id, LearnerProgress.concept_id == payload.concept_id))
    if not progress:
        progress = LearnerProgress(
            user_id=user.id,
            course_id=payload.course_id,
            concept_id=payload.concept_id,
            attempts=0,
            correct_attempts=0,
            mastery_score=0,
        )
        db.add(progress)
    progress.attempts += 1; progress.correct_attempts += int(payload.correct)
    progress.mastery_score = progress.correct_attempts / progress.attempts
    progress.last_reviewed_at = datetime.now(UTC)
    progress.next_review_at = datetime.now(UTC) + timedelta(days=max(1, payload.confidence * (2 if payload.correct else 1)))
    db.commit(); return serialize(progress)


@router.post("/quizzes/{quiz_id}/attempts")
def quiz_attempt(quiz_id: UUID, payload: QuizAttempt, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, payload.course_id)
    quiz = db.scalar(select(StudyAsset).where(
        StudyAsset.id == quiz_id,
        StudyAsset.course_id == payload.course_id,
        StudyAsset.asset_type.in_(("practice_quiz", "practice_exam")),
        StudyAsset.status != ReviewStatus.rejected,
        StudyAsset.deleted_at.is_(None),
    ))
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    questions = valid_guide_sections(quiz.content)
    expected_indexes = set(range(len(questions)))
    rated_indexes = {answer.question_index for answer in payload.answers}
    if (
        not expected_indexes
        or len(payload.answers) != len(expected_indexes)
        or rated_indexes != expected_indexes
    ):
        raise HTTPException(400, "Rate every stored quiz prompt exactly once")
    normalized_answers = [answer.model_dump() for answer in payload.answers]
    correct_answers = sum(int(answer.correct) for answer in payload.answers)
    session = StudySession(
        user_id=user.id,
        course_id=payload.course_id,
        study_asset_id=quiz.id,
        mode="quiz",
        result={
            "answers": normalized_answers,
            "correct_answers": correct_answers,
            "question_count": len(payload.answers),
        },
        ended_at=datetime.now(UTC),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "quiz_id": quiz_id, "recorded": True, "answer_count": len(payload.answers)}


@router.get("/courses/{course_id}/progress")
def progress(course_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_course(db, user, course_id)
    rows = db.scalars(select(LearnerProgress).where(LearnerProgress.course_id == course_id, LearnerProgress.user_id == user.id)).all()
    items = [{**serialize(row), "kind": "concept"} for row in rows]
    quiz_sessions = db.scalars(select(StudySession).where(
        StudySession.course_id == course_id,
        StudySession.user_id == user.id,
        StudySession.mode == "quiz",
        StudySession.ended_at.is_not(None),
    ).order_by(StudySession.ended_at.desc()).limit(50)).all()
    for session in quiz_sessions:
        question_count = session.result.get("question_count", 0)
        correct_answers = session.result.get("correct_answers", 0)
        if not isinstance(question_count, int) or question_count <= 0:
            continue
        if not isinstance(correct_answers, int) or not 0 <= correct_answers <= question_count:
            continue
        items.append({
            "id": session.id,
            "kind": "quiz",
            "mastery_score": correct_answers / question_count,
            "attempts": question_count,
            "correct_attempts": correct_answers,
            "next_review_at": None,
        })
    return {"items": items, "average_mastery": sum(item["mastery_score"] for item in items) / len(items) if items else 0}


@router.get("/benchmarks/latest")
def benchmark_latest(user: User = Depends(get_current_user)):
    path = settings.benchmark_output_path / "benchmark_summary.json"
    runs = settings.benchmark_output_path / "benchmark_runs.json"
    return {"generated_at": datetime.now(UTC), "target_pages": 100, "summary": json.loads(path.read_text()) if path.exists() else [], "runs": json.loads(runs.read_text()) if runs.exists() else []}
