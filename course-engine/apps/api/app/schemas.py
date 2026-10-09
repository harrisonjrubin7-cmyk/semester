from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: UUID
    email: EmailStr


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    term: str | None = None
    timezone: str = "America/Chicago"
    start_date: date | None = None
    end_date: date | None = None


class CoursePatch(BaseModel):
    title: str | None = None
    term: str | None = None
    timezone: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class CourseOut(CourseCreate, ORMModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class UploadInitiate(BaseModel):
    filename: str
    size_bytes: int = Field(gt=0)
    mime_type: str
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class UploadComplete(BaseModel):
    document_id: UUID
    classification: str | None = None


class CalendarEventIn(BaseModel):
    title: str
    event_type: str
    start_at: datetime | None = None
    end_at: datetime | None = None
    event_date: date | None = None
    all_day: bool = False
    time_unspecified: bool = False
    status: Literal["confirmed", "needs_review", "rejected"] = "needs_review"

    @model_validator(mode="after")
    def preserve_unspecified_time(self):
        if self.event_date and not self.start_at:
            self.all_day = True
            self.time_unspecified = True
        return self


class GenerateAssetRequest(BaseModel):
    asset_type: Literal[
        "comprehensive_guide", "weekly_summary", "glossary", "flashcards", "practice_quiz",
        "practice_exam", "reading_brief", "lecture_outline", "concept_map", "formula_sheet",
        "assignment_planner", "final_exam_pack"
    ]
    title: str | None = None
    scope: dict[str, Any] = Field(default_factory=dict)


class AssetPatch(BaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None
    status: Literal["confirmed", "needs_review", "rejected"] | None = None


class ReviewPatch(BaseModel):
    status: Literal["confirmed", "needs_review", "rejected"]
    resolution_note: str | None = Field(default=None, max_length=2000)
    corrected_payload: dict[str, Any] | None = None

    @model_validator(mode="after")
    def bound_corrected_payload(self):
        if self.corrected_payload is not None:
            encoded = json.dumps(self.corrected_payload, separators=(",", ":")).encode()
            if len(encoded) > 256_000:
                raise ValueError("Corrected payload must be 256 KB or smaller")
        return self


class ConflictResolution(BaseModel):
    action: Literal["choose", "keep_both", "unresolved"]
    value: str | None = None
    note: str | None = None


class CitationRef(BaseModel):
    citation_id: UUID


class GuideSection(BaseModel):
    heading: str
    explanation: str
    key_points: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    citation_ids: list[UUID] = Field(min_length=1)


class GuideContent(BaseModel):
    sections: list[GuideSection]
    study_questions: list[str] = Field(default_factory=list)
    source_gaps: list[str] = Field(default_factory=list)


class Flashcard(BaseModel):
    id: UUID
    front: str
    back: str
    difficulty: int = Field(ge=1, le=5)
    unit: str | None = None
    citation_ids: list[UUID] = Field(min_length=1)


class CardReview(BaseModel):
    course_id: UUID
    concept_id: UUID | None = None
    correct: bool
    confidence: int = Field(ge=1, le=5)


class QuizAttempt(BaseModel):
    course_id: UUID
    answers: list[dict[str, Any]]
