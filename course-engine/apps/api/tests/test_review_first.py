from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.extractors.base import ExtractedChunk
from app.main import app
from app.models.entities import (
    BackgroundJob,
    Citation,
    Course,
    ReviewItem,
    ReviewStatus,
    SourceChunk,
    SourceDocument,
    StudyAsset,
    StudyAssetCitation,
    User,
)


def _worker_module():
    worker_path = Path(__file__).resolve().parents[2] / "worker" / "tasks.py"
    spec = importlib.util.spec_from_file_location("course_engine_worker_tasks", worker_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_unmeasured_extraction_confidence_has_no_numeric_default():
    assert ExtractedChunk("Text").confidence is None


def test_extraction_routes_even_high_confidence_evidence_through_review(tmp_path: Path):
    testing_session = _database()
    source = tmp_path / "syllabus.txt"
    source.write_text("Final exam: December 10.", encoding="utf-8")

    with testing_session() as session:
        user = User(email="review@example.com", password_hash="not-used")
        session.add(user)
        session.flush()
        course = Course(user_id=user.id, title="Review First")
        session.add(course)
        session.flush()
        document = SourceDocument(
            course_id=course.id,
            filename=source.name,
            storage_key="private/originals/syllabus.txt",
            mime_type="text/plain",
            size_bytes=source.stat().st_size,
            sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        )
        session.add(document)
        session.flush()
        job = BackgroundJob(course_id=course.id, document_id=document.id, job_type="extract")
        session.add(job)
        session.commit()
        job_id = job.id
        document_id = document.id
        course_id = course.id
        user_id = user.id

    worker = _worker_module()
    worker.SessionLocal = testing_session
    worker.storage = type("Storage", (), {"path": lambda _self, _key: source})()
    scan_states = []

    class Scanner:
        def scan(self, _path):
            with testing_session() as session:
                scan_states.append(session.get(SourceDocument, document_id).status)

    worker.DevelopmentMalwareScanner = Scanner
    worker.extractor_for = lambda _path: lambda _source: [
        ExtractedChunk("Final exam: December 10.", "document", confidence=0.99)
    ]
    worker.extract_document.run(str(job_id))
    worker.extract_document.run(str(job_id))

    with testing_session() as session:
        document = session.get(SourceDocument, document_id)
        chunk = session.scalar(select(SourceChunk).where(SourceChunk.document_id == document_id))
        citation = session.scalar(select(Citation).where(Citation.chunk_id == chunk.id))
        reviews = session.scalars(
            select(ReviewItem).where(ReviewItem.document_id == document_id)
        ).all()

        assert chunk.confidence == 0.99
        assert citation.status == ReviewStatus.needs_review
        assert document.status == "needs_review"
        assert scan_states == ["scanning"]
        assert [review.item_type for review in reviews] == ["extracted_evidence"]
        review_id = reviews[0].id
        citation_id = citation.id

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {create_access_token(user_id)}"}
        reviewed = client.patch(
            f"/api/v1/review-items/{review_id}",
            json={"status": "confirmed", "resolution_note": "Checked original"},
            headers=headers,
        )
        assert reviewed.status_code == 200
        with testing_session() as session:
            assert session.get(Citation, citation_id).status == ReviewStatus.confirmed
            generation = BackgroundJob(
                course_id=course_id,
                job_type="generate:comprehensive_guide",
                result={"request": {"title": "Reviewed guide"}},
            )
            session.add(generation)
            session.commit()
            generation_id = generation.id
        worker.generate_study_asset.run(str(generation_id))
        with testing_session() as session:
            assert session.scalar(select(StudyAsset).where(StudyAsset.course_id == course_id))

        with testing_session() as session:
            retry = BackgroundJob(course_id=course_id, document_id=document_id, job_type="extract")
            session.add(retry)
            session.commit()
            retry_id = retry.id
        worker.extractor_for = lambda _path: lambda _source: (_ for _ in ()).throw(
            ValueError("parser failed")
        )
        with pytest.raises(ValueError, match="parser failed"):
            worker.extract_document.run(str(retry_id))
        with testing_session() as session:
            assert session.get(ReviewItem, review_id) is not None

        with testing_session() as session:
            replacement = BackgroundJob(
                course_id=course_id,
                document_id=document_id,
                job_type="extract",
            )
            session.add(replacement)
            session.commit()
            replacement_id = replacement.id
        worker.extractor_for = lambda _path: lambda _source: [
            ExtractedChunk("Replacement text", "document", confidence=0.9)
        ]

        def fail_after_review_cleanup(_db, _document):
            raise ValueError("replacement failed")

        worker.invalidate_document_assets = fail_after_review_cleanup
        with pytest.raises(ValueError, match="replacement failed"):
            worker.extract_document.run(str(replacement_id))
        with testing_session() as session:
            assert session.get(ReviewItem, review_id) is not None
            assert session.get(SourceChunk, chunk.id) is not None
            assert session.get(Citation, citation_id) is not None
    finally:
        app.dependency_overrides.clear()


def test_generated_study_asset_requires_review_before_use(tmp_path: Path, monkeypatch):
    testing_session = _database()

    with testing_session() as session:
        user = User(email="generator-review@example.com", password_hash="not-used")
        session.add(user)
        session.flush()
        course = Course(user_id=user.id, title="Reviewed Sources")
        session.add(course)
        session.flush()
        document = SourceDocument(
            course_id=course.id,
            filename="syllabus.txt",
            storage_key="private/originals/syllabus.txt",
            mime_type="text/plain",
            size_bytes=10,
            sha256="a" * 64,
        )
        session.add(document)
        session.flush()
        chunk = SourceChunk(
            document_id=document.id,
            chunk_index=0,
            content="Office hours are Tuesday.",
            confidence=0.8,
        )
        session.add(chunk)
        session.flush()
        citation = Citation(
            chunk_id=chunk.id,
            quote=chunk.content,
            status=ReviewStatus.confirmed,
        )
        session.add(citation)
        session.flush()
        citation_id = citation.id
        job = BackgroundJob(
            course_id=course.id,
            job_type="generate:comprehensive_guide",
            result={"request": {"title": "Course guide"}},
        )
        session.add(job)
        session.commit()
        user_id = user.id
        job_id = job.id
        course_id = course.id

    worker = _worker_module()
    worker.SessionLocal = testing_session
    worker.generate_study_asset.run(str(job_id))
    worker.generate_study_asset.run(str(job_id))

    with testing_session() as session:
        asset = session.scalar(select(StudyAsset).where(StudyAsset.course_id == course_id))
        reviews = session.scalars(
            select(ReviewItem).where(
                ReviewItem.course_id == course_id,
                ReviewItem.item_type == "generated_study_asset",
            )
        ).all()

        assert asset.status == ReviewStatus.needs_review
        assert asset.generation_version == 1
        assert len(reviews) == 1
        assert reviews[0].payload["asset_id"] == str(asset.id)
        review_id = reviews[0].id
        asset_id = asset.id
        citations = {key: dict(value) for key, value in asset.content["citations"].items()}
        citations[str(citation_id)]["label"] = "Fabricated source label"
        asset.content = {**asset.content, "citations": citations}
        session.commit()

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr("app.api.routes.settings.local_storage_path", tmp_path)
    try:
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {create_access_token(user_id)}"}
        approved = client.patch(
            f"/api/v1/review-items/{review_id}",
            json={"status": "confirmed", "resolution_note": "Checked source"},
            headers=headers,
        )
        assert approved.status_code == 200
        with testing_session() as session:
            approved_asset = session.get(StudyAsset, asset_id)
            assert approved_asset.content["citations"][str(citation_id)]["label"] == (
                "syllabus.txt, source"
            )
        assert client.post(
            f"/api/v1/study-assets/{asset_id}/exports/docx",
            headers=headers,
        ).status_code == 200
        with testing_session() as session:
            evidence_review = ReviewItem(
                course_id=course_id,
                document_id=document.id,
                item_type="extracted_evidence",
                title="Correct evidence",
                payload={
                    "chunk_id": str(chunk.id),
                    "citation_id": str(citation_id),
                    "confidence": 0.8,
                },
            )
            session.add(evidence_review)
            session.commit()
            evidence_review_id = evidence_review.id
        corrected = client.patch(
            f"/api/v1/review-items/{evidence_review_id}",
            json={
                "status": "confirmed",
                "corrected_payload": {"content": "Office hours moved to Thursday."},
            },
            headers=headers,
        )
        assert corrected.status_code == 200
        stale_export = client.post(
            f"/api/v1/study-assets/{asset_id}/exports/docx",
            headers=headers,
        )
        assert stale_export.status_code == 409
        with testing_session() as session:
            assert session.get(StudyAsset, asset_id).status == ReviewStatus.needs_review
            assert session.scalar(
                select(StudyAssetCitation).where(StudyAssetCitation.study_asset_id == asset_id)
            ) is None
    finally:
        app.dependency_overrides.clear()


def test_unapproved_study_asset_cannot_be_exported(tmp_path: Path, monkeypatch):
    testing_session = _database()

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr("app.api.routes.settings.local_storage_path", tmp_path)
    try:
        client = TestClient(app)
        registered = client.post(
            "/api/v1/auth/register",
            json={"email": "asset-review@example.com", "password": "strong-pass-one"},
        )
        headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
        created = client.post(
            "/api/v1/courses",
            json={"title": "Private Course", "timezone": "America/Chicago"},
            headers=headers,
        )
        course_id = UUID(created.json()["id"])
        with testing_session() as session:
            asset = StudyAsset(
                course_id=course_id,
                asset_type="comprehensive_guide",
                title="Draft guide",
                content={"sections": [], "citations": {}},
                status=ReviewStatus.needs_review,
            )
            session.add(asset)
            session.commit()
            asset_id = asset.id

        response = client.post(
            f"/api/v1/study-assets/{asset_id}/exports/docx",
            headers=headers,
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "Study asset must be confirmed before export"
        direct_confirmation = client.patch(
            f"/api/v1/study-assets/{asset_id}",
            json={"status": "confirmed"},
            headers=headers,
        )
        assert direct_confirmation.status_code == 409

        with testing_session() as session:
            asset = session.get(StudyAsset, asset_id)
            asset.status = ReviewStatus.confirmed
            session.commit()
        edited = client.patch(
            f"/api/v1/study-assets/{asset_id}",
            json={"title": "Edited draft guide"},
            headers=headers,
        )
        assert edited.status_code == 200
        assert edited.json()["status"] == "needs_review"
        reviews = client.get(
            f"/api/v1/courses/{course_id}/review-items",
            headers=headers,
        ).json()
        asset_review = next(item for item in reviews if item["item_type"] == "generated_study_asset")
        invalid_approval = client.patch(
            f"/api/v1/review-items/{asset_review['id']}",
            json={"status": "confirmed"},
            headers=headers,
        )
        assert invalid_approval.status_code == 422
        assert client.post(
            f"/api/v1/study-assets/{asset_id}/exports/docx",
            headers=headers,
        ).status_code == 409
        assert not list(tmp_path.iterdir())
    finally:
        app.dependency_overrides.clear()
