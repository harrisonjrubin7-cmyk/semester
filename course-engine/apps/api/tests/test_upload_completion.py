from __future__ import annotations

import base64
import hashlib
import inspect
import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.api import routes
from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models.entities import BackgroundJob, Course, SourceDocument, User
from app.schemas import UploadComplete
from app.services.storage import ObjectStorage


def _database(tmp_path):
    if settings.database_url.startswith("postgresql"):
        engine = create_engine(settings.database_url, pool_pre_ping=True)
    else:
        engine = create_engine(
            f"sqlite:///{tmp_path / 'completion.db'}",
            connect_args={"check_same_thread": False, "timeout": 10},
        )
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def _runtime(tmp_path, monkeypatch):
    engine, sessions = _database(tmp_path)

    def override_db():
        with sessions() as session:
            yield session

    sent: list[tuple[str, list[str]]] = []
    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "local_storage_path", tmp_path / "objects")
    monkeypatch.setattr(routes, "storage", ObjectStorage())
    monkeypatch.setattr(
        routes.celery_client,
        "send_task",
        lambda name, args: sent.append((name, args)),
    )
    client = TestClient(app)
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": f"upload-{tmp_path.name}@example.com", "password": "strong-pass-one"},
    )
    assert registered.status_code == 201
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    created = client.post(
        "/api/v1/courses",
        json={"title": "Upload completion", "timezone": "America/Chicago"},
        headers=headers,
    )
    assert created.status_code == 201
    return SimpleNamespace(
        engine=engine,
        sessions=sessions,
        client=client,
        headers=headers,
        course_id=created.json()["id"],
        sent=sent,
    )


def _initiate(runtime, content: bytes, *, declared_size: int | None = None, sha256: str | None = None):
    digest = sha256 or hashlib.sha256(content).hexdigest()
    initiated = runtime.client.post(
        f"/api/v1/courses/{runtime.course_id}/uploads/initiate",
        json={
            "filename": "source.txt",
            "size_bytes": declared_size if declared_size is not None else len(content),
            "mime_type": "text/plain",
            "sha256": digest,
        },
        headers=runtime.headers,
    )
    assert initiated.status_code == 200
    return initiated.json()


def _upload(runtime, initiated, content: bytes):
    uploaded = runtime.client.put(
        initiated["upload_url"],
        content=content,
        headers=runtime.headers,
    )
    assert uploaded.status_code == 204


def _complete(runtime, document_id: str, classification: str = "lecture"):
    return runtime.client.post(
        f"/api/v1/courses/{runtime.course_id}/uploads/complete",
        json={"document_id": document_id, "classification": classification},
        headers=runtime.headers,
    )


def test_completion_verifies_local_object_and_is_durably_idempotent(tmp_path, monkeypatch):
    runtime = _runtime(tmp_path, monkeypatch)
    try:
        content = b"review this source"
        initiated = _initiate(runtime, content)
        _upload(runtime, initiated, content)

        first = _complete(runtime, initiated["document_id"])
        second = _complete(runtime, initiated["document_id"])

        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json()["document"]["status"] == "quarantined"
        assert second.json()["receipt"] == first.json()["receipt"]
        assert second.json()["job"]["id"] == first.json()["job"]["id"]
        with runtime.sessions() as session:
            assert session.scalar(select(func.count()).select_from(BackgroundJob)) == 1
        assert runtime.sent == [("extract_document", [first.json()["job"]["id"]])]
    finally:
        app.dependency_overrides.clear()
        runtime.engine.dispose()


def test_completion_rejects_conflicting_retry_payload(tmp_path, monkeypatch):
    runtime = _runtime(tmp_path, monkeypatch)
    try:
        content = b"review this source"
        initiated = _initiate(runtime, content)
        _upload(runtime, initiated, content)
        assert _complete(runtime, initiated["document_id"], "lecture").status_code == 200

        conflict = _complete(runtime, initiated["document_id"], "syllabus")

        assert conflict.status_code == 409
        assert conflict.json()["detail"] == "Upload was already completed with different data"
        with runtime.sessions() as session:
            assert session.scalar(select(func.count()).select_from(BackgroundJob)) == 1
        assert len(runtime.sent) == 1
    finally:
        app.dependency_overrides.clear()
        runtime.engine.dispose()


@pytest.mark.parametrize(
    ("declared_size", "declared_sha"),
    [
        (19, None),
        (18, hashlib.sha256(b"different content").hexdigest()),
    ],
)
def test_completion_rejects_local_size_or_checksum_mismatch(
    tmp_path, monkeypatch, declared_size, declared_sha
):
    runtime = _runtime(tmp_path, monkeypatch)
    try:
        content = b"review this source"
        initiated = _initiate(
            runtime,
            content,
            declared_size=declared_size,
            sha256=declared_sha,
        )
        _upload(runtime, initiated, content)

        rejected = _complete(runtime, initiated["document_id"])

        assert rejected.status_code == 409
        with runtime.sessions() as session:
            document = session.get(SourceDocument, initiated["document_id"])
            assert document.status == "uploaded"
            assert session.scalar(select(func.count()).select_from(BackgroundJob)) == 0
        assert runtime.sent == []
    finally:
        app.dependency_overrides.clear()
        runtime.engine.dispose()


@pytest.mark.parametrize(
    ("field", "bad_value"),
    [
        ("bucket", "other-bucket"),
        ("key", "courses/other/originals/source.txt"),
        ("owner_verified", False),
        ("content_type", "text/html"),
        ("checksum_sha256", "0" * 64),
        ("encryption", "none"),
    ],
)
def test_nonlocal_completion_rejects_untrusted_object_metadata(
    tmp_path, monkeypatch, field, bad_value
):
    runtime = _runtime(tmp_path, monkeypatch)
    try:
        content = b"review this source"
        initiated = _initiate(runtime, content)
        metadata = {
            "backend": "s3",
            "bucket": settings.s3_bucket,
            "key": initiated["storage_key"],
            "size_bytes": len(content),
            "content_type": "text/plain",
            "checksum_sha256": hashlib.sha256(content).hexdigest(),
            "encryption": settings.s3_sse,
            "owner_verified": True,
        }
        metadata[field] = bad_value
        monkeypatch.setattr(
            routes,
            "storage",
            type("ContractStorage", (), {"inspect": lambda _self, _key: SimpleNamespace(**metadata)})(),
        )

        rejected = _complete(runtime, initiated["document_id"])

        assert rejected.status_code == 409
        with runtime.sessions() as session:
            assert session.scalar(select(func.count()).select_from(BackgroundJob)) == 0
        assert runtime.sent == []
    finally:
        app.dependency_overrides.clear()
        runtime.engine.dispose()


def test_simultaneous_completion_creates_one_receipt_and_job(tmp_path, monkeypatch):
    runtime = _runtime(tmp_path, monkeypatch)
    try:
        content = b"review this source"
        initiated = _initiate(runtime, content)
        with runtime.sessions() as session:
            document = session.get(SourceDocument, initiated["document_id"])
            user_id = session.scalar(select(Course.user_id).where(Course.id == document.course_id))
            document_id = document.id
            course_id = document.course_id

        inspection_barrier = threading.Barrier(2)
        metadata = SimpleNamespace(
            backend="local",
            bucket=None,
            key=initiated["storage_key"],
            size_bytes=len(content),
            content_type="text/plain",
            checksum_sha256=hashlib.sha256(content).hexdigest(),
            encryption=None,
            owner_verified=True,
        )

        class ConcurrentStorage:
            def inspect(self, _key):
                inspection_barrier.wait(timeout=10)
                return metadata

        monkeypatch.setattr(routes, "storage", ConcurrentStorage())
        start = threading.Barrier(2)

        def complete():
            start.wait(timeout=10)
            with runtime.sessions() as session:
                return routes.complete_upload(
                    course_id,
                    UploadComplete(document_id=document_id, classification="lecture"),
                    session.get(User, user_id),
                    session,
                )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _index: complete(), range(2)))

        assert len({str(result["job"]["id"]) for result in results}) == 1
        assert results[0]["receipt"] == results[1]["receipt"]
        with runtime.sessions() as session:
            assert session.scalar(select(func.count()).select_from(BackgroundJob)) == 1
        assert len(runtime.sent) == 1
    finally:
        app.dependency_overrides.clear()
        runtime.engine.dispose()


class FakeS3Client:
    def __init__(self):
        self.head_request = None
        self.presign_request = None

    def head_object(self, **kwargs):
        self.head_request = kwargs
        return {
            "ContentLength": 18,
            "ContentType": "text/plain",
            "ChecksumSHA256": base64.b64encode(bytes.fromhex("a" * 64)).decode(),
            "ServerSideEncryption": "AES256",
        }

    def generate_presigned_url(self, operation, *, Params, ExpiresIn):
        self.presign_request = (operation, Params, ExpiresIn)
        return "https://objects.example/upload"


def test_s3_adapter_pins_owner_and_reads_server_metadata(monkeypatch):
    client = FakeS3Client()
    adapter = object.__new__(ObjectStorage)
    adapter.local = False
    adapter.client = client

    assert hasattr(adapter, "inspect"), "Object storage metadata inspection is not implemented"
    metadata = adapter.inspect("courses/course-id/originals/source.txt")

    assert client.head_request == {
        "Bucket": settings.s3_bucket,
        "Key": "courses/course-id/originals/source.txt",
        "ExpectedBucketOwner": settings.s3_expected_bucket_owner,
        "ChecksumMode": "ENABLED",
    }
    assert metadata.checksum_sha256 == "a" * 64
    assert metadata.owner_verified is True


def test_s3_presign_binds_declared_size_content_and_checksum():
    client = FakeS3Client()
    adapter = object.__new__(ObjectStorage)
    adapter.local = False
    adapter.client = client
    parameters = inspect.signature(adapter.presign_put).parameters

    assert {"size_bytes", "sha256"}.issubset(parameters), (
        "Presigned upload contract does not bind size and checksum"
    )
    adapter.presign_put(
        "courses/course-id/originals/source.txt",
        "text/plain",
        size_bytes=18,
        sha256="a" * 64,
    )

    operation, params, expires = client.presign_request
    assert operation == "put_object"
    assert params["ContentLength"] == 18
    assert params["ChecksumSHA256"] == base64.b64encode(bytes.fromhex("a" * 64)).decode()
    assert expires == 900
