from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReviewStatus(str, enum.Enum):
    confirmed = "confirmed"
    needs_review = "needs_review"
    rejected = "rejected"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Course(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "courses"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    term: Mapped[str | None] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(80), default="America/Chicago")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)


class SourceDocument(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "source_documents"
    __table_args__ = (UniqueConstraint("course_id", "sha256", name="uq_course_document_sha"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(512))
    storage_key: Mapped[str] = mapped_column(String(768), unique=True)
    mime_type: Mapped[str] = mapped_column(String(160))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    classification: Mapped[str] = mapped_column(String(40), default="other")
    status: Mapped[str] = mapped_column(String(40), default="uploaded")
    page_count: Mapped[int | None] = mapped_column(Integer)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class SourceChunk(Base, TimestampMixin):
    __tablename__ = "source_chunks"
    __table_args__ = (UniqueConstraint("document_id", "chunk_index", name="uq_document_chunk"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(String(40), default="paragraph")
    page_number: Mapped[int | None] = mapped_column(Integer)
    slide_number: Mapped[int | None] = mapped_column(Integer)
    sheet_name: Mapped[str | None] = mapped_column(String(160))
    cell_range: Mapped[str | None] = mapped_column(String(80))
    start_seconds: Mapped[float | None] = mapped_column(Float)
    end_seconds: Mapped[float | None] = mapped_column(Float)
    bounding_box: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Citation(Base, TimestampMixin):
    __tablename__ = "citations"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chunk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_chunks.id", ondelete="CASCADE"), index=True)
    quote: Mapped[str] = mapped_column(Text)
    quoted_start: Mapped[int | None] = mapped_column(Integer)
    quoted_end: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.confirmed)


class CourseUnit(Base, TimestampMixin):
    __tablename__ = "course_units"
    __table_args__ = (UniqueConstraint("course_id", "position", name="uq_course_unit_position"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(240))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    learning_objectives: Mapped[list[Any]] = mapped_column(JSON, default=list)


class Concept(Base, TimestampMixin):
    __tablename__ = "concepts"
    __table_args__ = (UniqueConstraint("course_id", "name", name="uq_course_concept"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("course_units.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(240))
    definition: Mapped[str | None] = mapped_column(Text)
    importance: Mapped[int] = mapped_column(Integer, default=3)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.needs_review)


class ConceptCitation(Base):
    __tablename__ = "concept_citations"
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
    citation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citations.id", ondelete="CASCADE"), primary_key=True)


class Reading(Base, TimestampMixin):
    __tablename__ = "readings"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("course_units.id", ondelete="SET NULL"))
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(320))
    author: Mapped[str | None] = mapped_column(String(240))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.needs_review)


class Assignment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "assignments"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("course_units.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(320))
    assignment_type: Mapped[str] = mapped_column(String(80), default="assignment")
    instructions: Mapped[str | None] = mapped_column(Text)
    rubric: Mapped[list[Any]] = mapped_column(JSON, default=list)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[date | None] = mapped_column(Date)
    time_unspecified: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.needs_review)


class AssignmentCitation(Base):
    __tablename__ = "assignment_citations"
    assignment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), primary_key=True)
    citation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citations.id", ondelete="CASCADE"), primary_key=True)


class CalendarEvent(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "calendar_events"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("assignments.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(320))
    event_type: Mapped[str] = mapped_column(String(80))
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_date: Mapped[date | None] = mapped_column(Date)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    time_unspecified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.needs_review)
    external_calendar_id: Mapped[str | None] = mapped_column(String(240))
    external_event_id: Mapped[str | None] = mapped_column(String(240))


class CalendarEventCitation(Base):
    __tablename__ = "calendar_event_citations"
    calendar_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("calendar_events.id", ondelete="CASCADE"), primary_key=True)
    citation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citations.id", ondelete="CASCADE"), primary_key=True)


class Conflict(Base, TimestampMixin):
    __tablename__ = "conflicts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    normalized_title: Mapped[str] = mapped_column(String(320))
    candidate_values: Mapped[list[Any]] = mapped_column(JSON)
    citation_ids: Mapped[list[str]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(40), default="open")
    resolution: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class ReviewItem(Base, TimestampMixin):
    __tablename__ = "review_items"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(320))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.needs_review)
    resolution_note: Mapped[str | None] = mapped_column(Text)


class StudyAsset(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "study_assets"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("course_units.id", ondelete="SET NULL"))
    asset_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(320))
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    generation_version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.needs_review)


class StudyAssetCitation(Base):
    __tablename__ = "study_asset_citations"
    study_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_assets.id", ondelete="CASCADE"), primary_key=True)
    citation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citations.id", ondelete="CASCADE"), primary_key=True)


class StudyExport(Base, TimestampMixin):
    __tablename__ = "study_exports"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    study_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_assets.id", ondelete="CASCADE"), index=True)
    format: Mapped[str] = mapped_column(String(40))
    storage_key: Mapped[str] = mapped_column(String(768))
    generation_version: Mapped[int] = mapped_column(Integer)


class StudySession(Base, TimestampMixin):
    __tablename__ = "study_sessions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    study_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("study_assets.id", ondelete="SET NULL"))
    mode: Mapped[str] = mapped_column(String(40))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LearnerProgress(Base, TimestampMixin):
    __tablename__ = "learner_progress"
    __table_args__ = (UniqueConstraint("user_id", "course_id", "concept_id", name="uq_progress_concept"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    mastery_score: Mapped[float] = mapped_column(Float, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BackgroundJob(Base, TimestampMixin):
    __tablename__ = "background_jobs"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"))
    job_type: Mapped[str] = mapped_column(String(80))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.queued)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


Index("ix_calendar_course_date", CalendarEvent.course_id, CalendarEvent.event_date)
Index("ix_asset_course_type", StudyAsset.course_id, StudyAsset.asset_type)
