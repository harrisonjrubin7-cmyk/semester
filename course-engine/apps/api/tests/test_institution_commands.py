from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.entities import (
    CommandReceipt,
    Institution,
    OutboxEvent,
    TenantCapability,
    User,
    WorkspaceGrant,
)


def test_institution_commands_are_tenant_scoped_approved_and_idempotent():
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

        def register(email: str) -> dict[str, str]:
            response = client.post(
                "/api/v1/auth/register",
                json={"email": email, "password": "strong-passphrase"},
            )
            assert response.status_code == 201
            return {"Authorization": f"Bearer {response.json()['access_token']}"}

        student_headers = register("student@example.com")
        faculty_headers = register("faculty@example.com")
        registrar_headers = register("registrar@example.com")
        outsider_headers = register("outsider@example.com")

        with testing_session() as db:
            users = {
                user.email: user
                for user in db.scalars(select(User).where(User.email.like("%@example.com"))).all()
            }
            institution = Institution(name="Example University", slug="example-university")
            db.add(institution)
            db.flush()
            db.add_all(
                [
                    WorkspaceGrant(
                        institution_id=institution.id,
                        user_id=users["student@example.com"].id,
                        role="student",
                    ),
                    WorkspaceGrant(
                        institution_id=institution.id,
                        user_id=users["faculty@example.com"].id,
                        role="faculty",
                    ),
                    WorkspaceGrant(
                        institution_id=institution.id,
                        user_id=users["registrar@example.com"].id,
                        role="registrar",
                    ),
                    TenantCapability(
                        institution_id=institution.id,
                        capability="registration.write",
                        enabled=False,
                    ),
                    TenantCapability(
                        institution_id=institution.id,
                        capability="grades.write",
                        enabled=True,
                        approval_reference="CAB-2026-1001",
                        enabled_by=users["registrar@example.com"].id,
                    ),
                ]
            )
            db.commit()
            institution_id = institution.id
            student_id = users["student@example.com"].id

        endpoint = f"/api/v1/institutions/{institution_id}/commands"
        registration_body = {
            "command_type": "registration.add",
            "payload": {
                "student_user_id": str(student_id),
                "course_section_id": "BIO-101-01",
            },
        }
        request_headers = {**student_headers, "Idempotency-Key": "registration-0001"}

        assert client.post(endpoint, json=registration_body, headers=request_headers).status_code == 423
        assert (
            client.post(
                endpoint,
                json=registration_body,
                headers={**outsider_headers, "Idempotency-Key": "outsider-command-01"},
            ).status_code
            == 403
        )

        with testing_session() as db:
            capability = db.scalar(
                select(TenantCapability).where(
                    TenantCapability.institution_id == institution_id,
                    TenantCapability.capability == "registration.write",
                )
            )
            capability.enabled = True
            capability.approval_reference = "CAB-2026-1002"
            db.commit()

        accepted = client.post(endpoint, json=registration_body, headers=request_headers)
        assert accepted.status_code == 202
        assert accepted.json()["status"] == "accepted"
        assert accepted.json()["replayed"] is False

        replay = client.post(endpoint, json=registration_body, headers=request_headers)
        assert replay.status_code == 202
        assert replay.json()["id"] == accepted.json()["id"]
        assert replay.json()["replayed"] is True

        invalid_registration = client.post(
            endpoint,
            json={
                "command_type": "registration.add",
                "payload": {"student_user_id": None, "course_section_id": ""},
            },
            headers={**student_headers, "Idempotency-Key": "invalid-input-0001"},
        )
        assert invalid_registration.status_code == 422

        conflict_body = {
            **registration_body,
            "payload": {**registration_body["payload"], "course_section_id": "CHEM-101-01"},
        }
        assert client.post(endpoint, json=conflict_body, headers=request_headers).status_code == 409

        student_grade = client.post(
            endpoint,
            json={
                "command_type": "grades.submit_final",
                "payload": {"course_section_id": "BIO-101-01", "grades": []},
            },
            headers={**student_headers, "Idempotency-Key": "student-grade-0001"},
        )
        assert student_grade.status_code == 403

        faculty_grade = client.post(
            endpoint,
            json={
                "command_type": "grades.submit_final",
                "payload": {
                    "course_section_id": "BIO-101-01",
                    "grades": [{"student_user_id": str(student_id), "grade": "A"}],
                },
            },
            headers={**faculty_headers, "Idempotency-Key": "0000000000000001"},
        )
        assert faculty_grade.status_code == 202
        empty_grades = client.post(
            endpoint,
            json={
                "command_type": "grades.submit_final",
                "payload": {"course_section_id": "BIO-101-01", "grades": []},
            },
            headers={**faculty_headers, "Idempotency-Key": "0000000000000002"},
        )
        assert empty_grades.status_code == 422

        with testing_session() as db:
            receipt_id = UUID(accepted.json()["id"])
            assert db.scalar(
                select(func.count()).select_from(OutboxEvent).where(
                    OutboxEvent.receipt_id == receipt_id
                )
            ) == 1
            assert db.scalar(select(func.count()).select_from(CommandReceipt)) == 2
            capability = db.scalar(
                select(TenantCapability).where(
                    TenantCapability.institution_id == institution_id,
                    TenantCapability.capability == "registration.write",
                )
            )
            capability.kill_switch_active = True
            db.commit()

        assert (
            client.post(
                endpoint,
                json=registration_body,
                headers={**student_headers, "Idempotency-Key": "registration-0002"},
            ).status_code
            == 423
        )
        assert client.get(endpoint, headers=student_headers).status_code == 403
        listed = client.get(endpoint, headers=registrar_headers)
        assert listed.status_code == 200
        assert len(listed.json()["items"]) == 2
        assert listed.json()["next_cursor"] is None
        first_page = client.get(f"{endpoint}?limit=1", headers=registrar_headers)
        assert first_page.status_code == 200
        assert len(first_page.json()["items"]) == 1
        assert first_page.json()["next_cursor"]
        second_page = client.get(
            f"{endpoint}?limit=1&cursor={first_page.json()['next_cursor']}",
            headers=registrar_headers,
        )
        assert second_page.status_code == 200
        assert len(second_page.json()["items"]) == 1
        assert second_page.json()["items"][0]["id"] != first_page.json()["items"][0]["id"]
    finally:
        app.dependency_overrides.clear()
