from uuid import UUID

import pymupdf as fitz
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import routes as api_routes
from app.core.database import Base, get_db
from app.main import app
from app.models.entities import Citation, ReviewItem, SourceChunk, SourceDocument


def test_course_ownership_boundary_returns_not_found_for_other_user(monkeypatch, tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        first = client.post(
            "/api/v1/auth/register",
            json={"email": "one@example.com", "password": "strong-pass-one"},
        )
        second = client.post(
            "/api/v1/auth/register",
            json={"email": "two@example.com", "password": "strong-pass-two"},
        )
        assert first.status_code == 201
        assert second.status_code == 201
        first_headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
        second_headers = {"Authorization": f"Bearer {second.json()['access_token']}"}
        created = client.post(
            "/api/v1/courses",
            json={"title": "Private Course", "timezone": "America/Chicago"},
            headers=first_headers,
        )
        assert created.status_code == 201
        course_id = created.json()["id"]
        assert client.get(f"/api/v1/courses/{course_id}", headers=first_headers).status_code == 200
        assert client.get(f"/api/v1/courses/{course_id}", headers=second_headers).status_code == 404
        assert client.get(f"/api/v1/courses/{course_id}").status_code == 401

        with testing_session() as session:
            document = SourceDocument(
                course_id=UUID(course_id),
                filename="syllabus.pdf",
                storage_key=f"{course_id}/syllabus.pdf",
                mime_type="application/pdf",
                size_bytes=1024,
                sha256="a" * 64,
                status="completed",
            )
            session.add(document)
            session.flush()
            chunk = SourceChunk(
                document_id=document.id,
                chunk_index=0,
                content="Office hours are Tuesday at 2 PM.",
                content_type="page_block",
                page_number=1,
                bounding_box={
                    "coordinate_space": "normalized",
                    "x": 0.1,
                    "y": 0.2,
                    "width": 0.4,
                    "height": 0.1,
                },
                confidence=0.98,
            )
            session.add(chunk)
            session.flush()
            citation = Citation(chunk_id=chunk.id, quote=chunk.content)
            session.add(citation)
            session.flush()
            extracted_review = ReviewItem(
                course_id=UUID(course_id),
                document_id=document.id,
                item_type="extracted_evidence",
                title="Review syllabus.pdf",
                payload={"chunk_id": str(chunk.id), "citation_id": str(citation.id)},
            )
            session.add(extracted_review)
            session.commit()
            document_id = document.id
            extracted_review_id = extracted_review.id

        source = client.get(f"/api/v1/files/{document_id}/source-view", headers=first_headers)
        assert source.status_code == 200
        assert source.json()["document"]["filename"] == "syllabus.pdf"
        assert source.json()["chunks"][0]["page_number"] == 1
        assert source.json()["chunks"][0]["content"] == "Office hours are Tuesday at 2 PM."
        assert source.json()["chunks"][0]["bounding_box"]["x"] == 0.1
        assert source.json()["chunks"][0]["preview_available"] is True
        assert source.json()["chunks"][0]["review_item_id"] == str(extracted_review_id)
        assert source.json()["has_more"] is False
        assert client.get(f"/api/v1/files/{document_id}/source-view", headers=second_headers).status_code == 404
        assert client.get(f"/api/v1/files/{document_id}/source-view").status_code == 401

        pdf_path = tmp_path / "syllabus.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page()
            page.insert_text((72, 72), "Office hours are Tuesday at 2 PM.")
            pdf.save(pdf_path)
        monkeypatch.setattr(
            api_routes.storage,
            "read_bytes",
            lambda _storage_key, *, max_bytes: pdf_path.read_bytes(),
        )
        preview = client.get(
            f"/api/v1/files/{document_id}/pages/1/preview",
            headers=first_headers,
        )
        assert preview.status_code == 200
        assert preview.headers["content-type"] == "image/png"
        assert preview.headers["cache-control"] == "no-store"
        assert client.get(
            f"/api/v1/files/{document_id}/pages/1/preview",
            headers=second_headers,
        ).status_code == 404
        assert client.get(f"/api/v1/files/{document_id}/pages/1/preview").status_code == 401
        assert client.get(
            f"/api/v1/files/{document_id}/pages/2/preview",
            headers=first_headers,
        ).status_code == 404

        with testing_session() as session:
            archive = session.get(SourceDocument, document_id)
            archive.filename = "course-materials.zip"
            session.commit()
        archive_source = client.get(
            f"/api/v1/files/{document_id}/source-view",
            headers=first_headers,
        )
        assert archive_source.json()["chunks"][0]["preview_available"] is False
        assert client.get(
            f"/api/v1/files/{document_id}/pages/1/preview",
            headers=first_headers,
        ).status_code == 415

        with testing_session() as session:
            review = ReviewItem(
                course_id=UUID(course_id),
                document_id=document_id,
                item_type="date_conflict",
                title="Confirm assignment date",
                payload={"due_date": "2026-10-20"},
            )
            session.add(review)
            session.commit()
            review_id = review.id

        correction = {
            "status": "confirmed",
            "resolution_note": "Checked against page 4",
            "corrected_payload": {"due_date": "2026-10-22"},
        }
        assert client.patch(f"/api/v1/review-items/{review_id}", json=correction, headers=second_headers).status_code == 404
        resolved = client.patch(f"/api/v1/review-items/{review_id}", json=correction, headers=first_headers)
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "confirmed"
        assert resolved.json()["payload"] == {"due_date": "2026-10-22"}
        assert resolved.json()["resolution_note"] == "Checked against page 4"

        calendar_payload = {
            "title": "Midterm",
            "event_type": "exam",
            "event_date": "2026-10-20",
            "status": "confirmed",
        }
        calendar_event = client.post(
            f"/api/v1/courses/{course_id}/calendar-events",
            json=calendar_payload,
            headers=first_headers,
        )
        assert calendar_event.status_code == 201
        event_id = calendar_event.json()["id"]
        edited_payload = {**calendar_payload, "title": "Final exam", "event_date": "2026-10-21"}
        assert client.patch(f"/api/v1/calendar-events/{event_id}", json=edited_payload, headers=second_headers).status_code == 404
        edited = client.patch(f"/api/v1/calendar-events/{event_id}", json=edited_payload, headers=first_headers)
        assert edited.status_code == 200
        assert edited.json()["title"] == "Final exam"
        assert edited.json()["event_date"] == "2026-10-21"
    finally:
        app.dependency_overrides.clear()
