from __future__ import annotations

import hashlib
from pathlib import Path, PurePosixPath
from uuid import uuid4

import boto3

from app.core.config import settings

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".rtf", ".txt", ".md", ".odt", ".ppt", ".pptx",
    ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png", ".heic", ".webp", ".tiff",
    ".html", ".mhtml", ".zip", ".epub", ".mp3", ".m4a", ".wav", ".mp4", ".mov",
}

MIME_FAMILIES = {
    ".pdf": {"application/pdf"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".txt": {"text/plain"}, ".md": {"text/plain"}, ".csv": {"text/plain", "text/csv"},
    ".jpg": {"image/jpeg"}, ".jpeg": {"image/jpeg"}, ".png": {"image/png"},
}


def validate_upload(filename: str, size_bytes: int) -> None:
    if size_bytes > settings.max_upload_bytes:
        raise ValueError("File exceeds upload limit")
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file format")
    if Path(filename).name != filename or "\x00" in filename:
        raise ValueError("Unsafe filename")


def storage_key(course_id: str, filename: str) -> str:
    safe = "".join(c for c in Path(filename).name if c.isalnum() or c in "._-")
    return str(PurePosixPath("courses", course_id, "originals", f"{uuid4()}-{safe}"))


class ObjectStorage:
    def __init__(self) -> None:
        self.local = settings.storage_backend == "local"
        self.client = None if self.local else boto3.client(
            "s3", endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key, aws_secret_access_key=settings.s3_secret_key,
        )

    def presign_put(self, key: str, mime_type: str) -> str:
        if self.local:
            return f"/api/v1/uploads/local/{key}"
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": key,
                "ContentType": mime_type,
                "ServerSideEncryption": settings.s3_sse,
            },
            ExpiresIn=900,
        )

    def path(self, key: str) -> Path:
        root = settings.local_storage_path.resolve()
        path = (root / key).resolve()
        if root != path and root not in path.parents:
            raise ValueError("Unsafe storage key")
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def delete(self, key: str) -> None:
        if self.local:
            self.path(key).unlink(missing_ok=True)
        else:
            self.client.delete_object(Bucket=settings.s3_bucket, Key=key)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_actual_mime(path: Path) -> str:
    try:
        import magic

        actual = magic.from_file(str(path), mime=True)
    except ImportError:
        header = path.read_bytes()[:4096]
        if header.startswith(b"%PDF-"):
            actual = "application/pdf"
        elif header.startswith(b"PK\x03\x04"):
            actual = "application/zip"
        elif header.startswith(b"\x89PNG\r\n\x1a\n"):
            actual = "image/png"
        elif header.startswith(b"\xff\xd8\xff"):
            actual = "image/jpeg"
        else:
            try:
                header.decode("utf-8")
                actual = "text/plain"
            except UnicodeDecodeError:
                actual = "application/octet-stream"
    expected = MIME_FAMILIES.get(path.suffix.lower())
    if expected and actual not in expected:
        raise ValueError(f"File content is {actual}, not a valid {path.suffix.lower()} file")
    return actual
