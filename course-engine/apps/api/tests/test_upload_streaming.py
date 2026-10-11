import asyncio
import hashlib
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import routes
from app.core.config import settings
from app.services.storage import validate_upload


class FakeDatabase:
    def __init__(self, document):
        self.document = document

    def scalar(self, _statement):
        if "upload_completions" in str(_statement):
            return None
        return self.document


class FakeRequest:
    def __init__(self, chunks, body_error=None):
        self.chunks = chunks
        self.body_error = body_error

    async def body(self):
        if self.body_error:
            raise self.body_error
        return b"".join(chunk for chunk in self.chunks if isinstance(chunk, bytes))

    async def stream(self):
        for chunk in self.chunks:
            if isinstance(chunk, BaseException):
                raise chunk
            yield chunk


def _run_upload(tmp_path: Path, monkeypatch, request: FakeRequest, limit: int = 5):
    target = tmp_path / "objects" / "source.txt"
    document = SimpleNamespace(
        id="document-id",
        course_id="course-id",
        size_bytes=5,
        sha256=hashlib.sha256(b"abcde").hexdigest(),
        status="uploaded",
    )
    monkeypatch.setattr(settings, "max_upload_bytes", limit)
    monkeypatch.setattr(routes.storage, "path", lambda _key: target)
    monkeypatch.setattr(routes, "owned_course", lambda *_args: object())
    asyncio.run(routes.local_upload("source.txt", request, object(), FakeDatabase(document)))
    return target


def test_declared_upload_limit_uses_conservative_100_mib_boundary(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 100 * 1024 * 1024)
    validate_upload("source.zip", settings.max_upload_bytes)
    with pytest.raises(ValueError, match="upload limit"):
        validate_upload("source.zip", settings.max_upload_bytes + 1)


def test_local_upload_streams_without_calling_request_body(tmp_path: Path, monkeypatch):
    target = _run_upload(
        tmp_path,
        monkeypatch,
        FakeRequest([b"ab", b"cde"], AssertionError("whole request body was buffered")),
    )
    assert target.read_bytes() == b"abcde"


def test_local_upload_rejects_stream_over_limit_without_replacing_original(
    tmp_path: Path, monkeypatch
):
    target = tmp_path / "objects" / "source.txt"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"original")
    with pytest.raises(HTTPException) as error:
        _run_upload(tmp_path, monkeypatch, FakeRequest([b"abc", b"def"]))
    assert error.value.status_code == 413
    assert target.read_bytes() == b"original"
    assert list(target.parent.glob(".*.uploading-*")) == []


def test_local_upload_cancellation_cleans_partial_file_and_preserves_original(
    tmp_path: Path, monkeypatch
):
    target = tmp_path / "objects" / "source.txt"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"original")
    with pytest.raises(asyncio.CancelledError):
        _run_upload(
            tmp_path,
            monkeypatch,
            FakeRequest([b"abc", asyncio.CancelledError()]),
        )
    assert target.read_bytes() == b"original"
    assert list(target.parent.glob(".*.uploading-*")) == []
