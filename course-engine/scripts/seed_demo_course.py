from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.entities import (
    CalendarEvent,
    Citation,
    Course,
    ReviewStatus,
    SourceChunk,
    SourceDocument,
    StudyAsset,
    User,
)
from sqlalchemy import select


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    email = os.getenv("DEMO_EMAIL", "student@example.com")
    password = os.getenv("DEMO_PASSWORD", "course-engine-demo")

    user = db.scalar(select(User).where(User.email == email)) or User(
        email=email,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()

    course = Course(
        user_id=user.id,
        title="Evidence and Inquiry",
        term="Fall 2026",
        timezone="America/Chicago",
        start_date=date(2026, 8, 24),
        end_date=date(2026, 12, 11),
    )
    db.add(course)
    db.flush()

    source_path = ROOT / "data/demo"
    source_path.mkdir(parents=True, exist_ok=True)
    syllabus = source_path / "sample-syllabus.txt"
    syllabus.write_text(
        "Evidence Review due October 15, 2026. Time not specified.\n"
        "Unit 1: Source reliability and citation chains.\n",
        encoding="utf-8",
    )
    document = SourceDocument(
        course_id=course.id,
        filename=syllabus.name,
        storage_key=str(syllabus),
        mime_type="text/plain",
        size_bytes=syllabus.stat().st_size,
        sha256="0" * 64,
        classification="syllabus",
        status="extracted",
    )
    db.add(document)
    db.flush()

    chunk = SourceChunk(
        document_id=document.id,
        chunk_index=0,
        content=syllabus.read_text(encoding="utf-8"),
        content_type="document",
        page_number=1,
        confidence=1,
    )
    db.add(chunk)
    db.flush()
    citation = Citation(
        chunk_id=chunk.id,
        quote="Unit 1: Source reliability and citation chains.",
        status=ReviewStatus.confirmed,
    )
    db.add(citation)
    db.flush()

    db.add(
        CalendarEvent(
            course_id=course.id,
            title="Evidence Review",
            event_type="assignment",
            event_date=date(2026, 10, 15),
            all_day=True,
            time_unspecified=True,
            status=ReviewStatus.confirmed,
        )
    )
    content = {
        "sections": [
            {
                "heading": "Source reliability",
                "explanation": "The course introduces source reliability and citation chains.",
                "key_points": ["Trace claims to their original course source."],
                "citation_ids": [str(citation.id)],
            }
        ],
        "study_questions": ["How does a citation chain make a claim reviewable?"],
        "citations": {str(citation.id): {"label": "sample-syllabus.txt, p. 1"}},
    }
    db.add(
        StudyAsset(
            course_id=course.id,
            asset_type="comprehensive_guide",
            title="Unit 1 verified guide",
            content=content,
            status=ReviewStatus.confirmed,
        )
    )
    db.commit()
    print(f"Demo login: {email} / {password}")
    print(f"Course URL: http://localhost:3000/courses/{course.id}/overview")


if __name__ == "__main__":
    main()
