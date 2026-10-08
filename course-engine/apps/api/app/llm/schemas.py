from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ClassifiedFile(BaseModel):
    classification: Literal["syllabus", "reading", "lecture", "assignment", "rubric", "notes", "exam_material", "other"]
    confidence: float = Field(ge=0, le=1)
    citation_ids: list[UUID]


class ExtractedFact(BaseModel):
    kind: Literal["unit", "reading", "assignment", "deadline", "concept", "term", "formula", "learning_objective", "grade_policy"]
    title: str
    value: dict[str, Any]
    citation_ids: list[UUID] = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    status: Literal["confirmed", "needs_review"]


class FactList(BaseModel):
    facts: list[ExtractedFact]


class GeneratedSection(BaseModel):
    heading: str
    explanation: str
    key_points: list[str]
    citation_ids: list[UUID] = Field(min_length=1)


class GeneratedAsset(BaseModel):
    title: str
    sections: list[GeneratedSection]
    items: list[dict[str, Any]] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
