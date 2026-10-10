from __future__ import annotations

import base64
import binascii
import hashlib
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".rtf", ".txt", ".md", ".odt", ".ppt", ".pptx",
    ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png", ".heic", ".webp", ".tiff",
    ".html", ".mhtml", ".zip", ".epub", ".mp3", ".m4a", ".wav", ".mp4", ".mov",
}

MIME_FAMILIES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    ".rtf": {"application/rtf", "text/rtf"},
    ".odt": {"application/vnd.oasis.opendocument.text", "application/zip"},
    ".ppt": {"application/vnd.ms-powerpoint"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"},
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".txt": {"text/plain"}, ".md": {"text/plain", "text/markdown"}, ".csv": {"text/plain", "text/csv"},
    ".jpg": {"image/jpeg"}, ".jpeg": {"image/jpeg"}, ".png": {"image/png"},
    ".heic": {"image/heic", "image/heif"}, ".webp": {"image/webp"},
    ".tiff": {"image/tiff"}, ".html": {"text/html"},
    ".mhtml": {"multipart/related", "message/rfc822"},
    ".epub": {"application/epub+zip", "application/zip"},
    ".mp3": {"audio/mpeg"}, ".m4a": {"audio/mp4", "video/mp4"},
    ".wav": {"audio/wav", "audio/x-wav"}, ".mp4": {"video/mp4"},
    ".mov": {"video/quicktime"},
}


@dataclass(frozen=True)
class StoredObjectMetadata:
    backend: str
    bucket: str | None
    key: str
    size_bytes: int
    content_type: str | None
    checksum_sha256: str | None
    encryption: str | None
    owner_verified: bool


@dataclass(frozen=True)
class PresignedDownload:
    url: str
    headers: dict[str, str]
    expires_in_seconds: int


class ObjectInspectionError(ValueError):
    pass


def validate_upload(filename: str, size_bytes: int, mime_type: str | None = None) -> None:
    if size_bytes > settings.max_upload_bytes:
        raise ValueError("File exceeds upload limit")
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file format")
    if Path(filename).name != filename or "\x00" in filename:
        raise ValueError("Unsafe filename")
    expected_mimes = MIME_FAMILIES.get(Path(filename).suffix.lower())
    if not expected_mimes:
        raise ValueError("File format has no verified content-type policy")
    if (
        mime_type is not None
        and mime_type != "application/octet-stream"
        and mime_type not in expected_mimes
    ):
        raise ValueError("Declared content type does not match the file extension")


def normalize_upload_mime(filename: str, mime_type: str) -> str:
    expected_mimes = MIME_FAMILIES[Path(filename).suffix.lower()]
    if mime_type == "application/octet-stream":
        return sorted(expected_mimes)[0]
    return mime_type


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

    def presign_put(
        self,
        key: str,
        mime_type: str,
        *,
        size_bytes: int,
        sha256: str,
    ) -> str:
        if self.local:
            return f"/api/v1/uploads/local/{key}"
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": key,
                "ContentType": mime_type,
                "ContentLength": size_bytes,
                "ChecksumSHA256": base64.b64encode(bytes.fromhex(sha256)).decode(),
                "ServerSideEncryption": settings.s3_sse,
            },
            ExpiresIn=900,
        )

    def presign_get(self, key: str, *, expires_in: int = 120) -> PresignedDownload:
        """Issue the citation viewer's deliberately short-lived original URL."""
        if expires_in != 120:
            raise ValueError("Original access must expire after 120 seconds")
        if self.local:
            raise ValueError("Local originals use the authenticated download endpoint")
        if not settings.s3_expected_bucket_owner:
            raise ValueError("S3 expected bucket owner is not configured")
        url = self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": key,
                "ExpectedBucketOwner": settings.s3_expected_bucket_owner,
            },
            ExpiresIn=expires_in,
        )
        return PresignedDownload(
            url=url,
            headers={
                "x-amz-expected-bucket-owner": settings.s3_expected_bucket_owner,
            },
            expires_in_seconds=expires_in,
        )

    def inspect(self, key: str) -> StoredObjectMetadata:
        if self.local:
            path = self.path(key)
            if not path.is_file():
                raise ValueError("Uploaded object is missing")
            return StoredObjectMetadata(
                backend="local",
                bucket=None,
                key=key,
                size_bytes=path.stat().st_size,
                content_type=validate_actual_mime(path),
                checksum_sha256=sha256_file(path),
                encryption=None,
                owner_verified=True,
            )
        if not settings.s3_expected_bucket_owner:
            raise ValueError("S3 expected bucket owner is not configured")
        try:
            response = self.client.head_object(
                Bucket=settings.s3_bucket,
                Key=key,
                ExpectedBucketOwner=settings.s3_expected_bucket_owner,
                ChecksumMode="ENABLED",
            )
            encoded_checksum = response.get("ChecksumSHA256")
            checksum = (
                base64.b64decode(encoded_checksum, validate=True).hex()
                if encoded_checksum
                else None
            )
            size_bytes = int(response["ContentLength"])
        except (BotoCoreError, ClientError, binascii.Error, KeyError, TypeError, ValueError) as exc:
            raise ObjectInspectionError("Stored object metadata could not be verified") from exc
        return StoredObjectMetadata(
            backend="s3",
            bucket=settings.s3_bucket,
            key=key,
            size_bytes=size_bytes,
            content_type=response.get("ContentType"),
            checksum_sha256=checksum,
            encryption=response.get("ServerSideEncryption"),
            owner_verified=True,
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
