from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.entities import (
    BackgroundJob,
    Course,
    JobStatus,
    ReviewItem,
    ReviewStatus,
    StudyAsset,
    User,
)


def _database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_job_cancellation_is_owner_scoped_idempotent_and_terminal():
    testing_session = _database()
    now = datetime.now(UTC)
    with testing_session() as session:
        owner = User(email="cancel-owner@example.com", password_hash="unused")
        outsider = User(email="cancel-outsider@example.com", password_hash="unused")
        session.add_all([owner, outsider])
        session.flush()
        course = Course(user_id=owner.id, title="Cancellation")
        session.add(course)
        session.flush()
        running = BackgroundJob(
            course_id=course.id,
            job_type="generate:study_guide",
            status=JobStatus.running,
            lease_owner="worker-1",
            lease_generation=1,
            lease_expires_at=now + timedelta(minutes=5),
        )
        completed = BackgroundJob(
            course_id=course.id,
            job_type="generate:study_guide",
            status=JobStatus.completed,
        )
        failed = BackgroundJob(
            course_id=course.id,
            job_type="generate:study_guide",
            status=JobStatus.failed,
            error="Original provider failure",
        )
        session.add_all([running, completed, failed])
        session.commit()
        owner_id, outsider_id = owner.id, outsider.id
        running_id, completed_id, failed_id = running.id, completed.id, failed.id

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_id)}"}
        outsider_headers = {"Authorization": f"Bearer {create_access_token(outsider_id)}"}

        assert client.post(
            f"/api/v1/jobs/{running_id}/cancel", headers=outsider_headers
        ).status_code == 404
        cancelled = client.post(
            f"/api/v1/jobs/{running_id}/cancel", headers=owner_headers
        )
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == JobStatus.failed.value
        assert cancelled.json()["error"] == "Cancelled by user"
        assert cancelled.json()["revoked_at"] is not None
        assert cancelled.json()["lease_owner"] is None
        assert cancelled.json()["lease_expires_at"] is None

        repeated = client.post(
            f"/api/v1/jobs/{running_id}/cancel", headers=owner_headers
        )
        assert repeated.status_code == 200
        assert repeated.json()["revoked_at"] == cancelled.json()["revoked_at"]
        assert client.post(
            f"/api/v1/jobs/{completed_id}/cancel", headers=owner_headers
        ).status_code == 409
        assert client.post(
            f"/api/v1/jobs/{failed_id}/cancel", headers=owner_headers
        ).status_code == 409
        with testing_session() as session:
            assert session.get(BackgroundJob, failed_id).error == "Original provider failure"
    finally:
        app.dependency_overrides.clear()


def test_course_job_feed_is_owner_scoped_and_newest_first():
    testing_session = _database()
    now = datetime.now(UTC)
    with testing_session() as session:
        owner = User(email="jobs-owner@example.com", password_hash="unused")
        outsider = User(email="jobs-outsider@example.com", password_hash="unused")
        session.add_all([owner, outsider])
        session.flush()
        course = Course(user_id=owner.id, title="Job feed")
        session.add(course)
        session.flush()
        older = BackgroundJob(
            course_id=course.id,
            job_type="extract",
            status=JobStatus.completed,
            created_at=now - timedelta(minutes=1),
        )
        newer = BackgroundJob(
            course_id=course.id,
            job_type="extract",
            status=JobStatus.running,
            progress=42,
            created_at=now,
        )
        session.add_all([older, newer])
        session.commit()
        owner_id, outsider_id, course_id = owner.id, outsider.id, course.id
        older_id, newer_id = older.id, newer.id

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_id)}"}
        outsider_headers = {"Authorization": f"Bearer {create_access_token(outsider_id)}"}
        assert client.get(
            f"/api/v1/courses/{course_id}/jobs", headers=outsider_headers
        ).status_code == 404
        response = client.get(
            f"/api/v1/courses/{course_id}/jobs", headers=owner_headers
        )
        assert response.status_code == 200
        assert [row["id"] for row in response.json()] == [str(newer_id), str(older_id)]
        assert response.json()[0]["progress"] == 42
    finally:
        app.dependency_overrides.clear()


def test_deleting_study_asset_revokes_its_inflight_regeneration():
    testing_session = _database()
    with testing_session() as session:
        owner = User(email="delete-asset@example.com", password_hash="unused")
        session.add(owner)
        session.flush()
        course = Course(user_id=owner.id, title="Deletion")
        session.add(course)
        session.flush()
        asset = StudyAsset(
            course_id=course.id,
            asset_type="study_guide",
            title="Delete me",
            content={"sections": []},
            status=ReviewStatus.confirmed,
        )
        session.add(asset)
        session.flush()
        review = ReviewItem(
            course_id=course.id,
            item_type="generated_study_asset",
            title="Review deleted asset",
            payload={"asset_id": str(asset.id), "generation_version": 1},
        )
        session.add(review)
        job = BackgroundJob(
            course_id=course.id,
            target_id=asset.id,
            job_type="regenerate:study_guide",
            result={"asset_id": str(asset.id)},
        )
        session.add(job)
        session.commit()
        owner_id, asset_id, job_id, review_id = owner.id, asset.id, job.id, review.id

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {create_access_token(owner_id)}"}
        assert client.delete(
            f"/api/v1/study-assets/{asset_id}", headers=headers
        ).status_code == 204
        with testing_session() as session:
            deleted = session.get(StudyAsset, asset_id)
            assert deleted is not None
            assert deleted.deleted_at is not None
            revoked = session.get(BackgroundJob, job_id)
            assert revoked is not None
            assert revoked.status == JobStatus.failed
            assert revoked.error == "Study asset deleted"
            assert revoked.revoked_at is not None
        assert client.patch(
            f"/api/v1/review-items/{review_id}",
            json={"status": "rejected"},
            headers=headers,
        ).status_code == 409
        assert client.post(
            f"/api/v1/study-assets/{asset_id}/exports/pdf", headers=headers
        ).status_code == 404
    finally:
        app.dependency_overrides.clear()
