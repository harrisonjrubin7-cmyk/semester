from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.entities import ReviewItem, SourceChunk, SourceDocument


def test_course_ownership_boundary_returns_not_found_for_other_user():
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
            session.add(SourceChunk(
                document_id=document.id,
                chunk_index=0,
                content="Office hours are Tuesday at 2 PM.",
                content_type="paragraph",
                page_number=3,
                confidence=0.98,
            ))
            session.commit()
            document_id = document.id

        source = client.get(f"/api/v1/files/{document_id}/source-view", headers=first_headers)
        assert source.status_code == 200
        assert source.json()["document"]["filename"] == "syllabus.pdf"
        assert source.json()["chunks"][0]["page_number"] == 3
        assert source.json()["chunks"][0]["content"] == "Office hours are Tuesday at 2 PM."
        assert source.json()["has_more"] is False
        assert client.get(f"/api/v1/files/{document_id}/source-view", headers=second_headers).status_code == 404
        assert client.get(f"/api/v1/files/{document_id}/source-view").status_code == 401

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
    finally:
        app.dependency_overrides.clear()
