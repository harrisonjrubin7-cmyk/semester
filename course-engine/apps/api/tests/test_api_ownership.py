from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app


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
    finally:
        app.dependency_overrides.clear()
