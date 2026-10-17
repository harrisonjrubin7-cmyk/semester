from urllib.parse import parse_qs, urlsplit

import boto3
from botocore.config import Config

from app.core.config import settings
from app.services.storage import ObjectStorage


class _RecordingS3Client:
    def __init__(self):
        self.calls = []

    def generate_presigned_url(self, operation, *, Params, ExpiresIn):
        self.calls.append((operation, Params, ExpiresIn))
        return "https://private.example.invalid/source"


def test_original_source_access_is_scoped_and_expires_after_120_seconds(monkeypatch):
    monkeypatch.setattr(settings, "s3_expected_bucket_owner", "123456789012")
    client = _RecordingS3Client()
    storage = ObjectStorage.__new__(ObjectStorage)
    storage.local = False
    storage.client = client

    access = storage.presign_get(
        "courses/course-id/originals/source.pdf",
        expires_in=120,
    )

    assert access.url == "https://private.example.invalid/source"
    assert access.headers == {
        "x-amz-expected-bucket-owner": "123456789012",
    }
    assert access.expires_in_seconds == 120
    assert client.calls == [
        (
            "get_object",
            {
                "Bucket": "course-engine",
                "Key": "courses/course-id/originals/source.pdf",
                "ExpectedBucketOwner": "123456789012",
            },
            120,
        )
    ]


def test_original_source_access_returns_every_header_signed_by_botocore(monkeypatch):
    monkeypatch.setattr(settings, "s3_expected_bucket_owner", "123456789012")
    storage = ObjectStorage.__new__(ObjectStorage)
    storage.local = False
    storage.client = boto3.client(
        "s3",
        endpoint_url="https://objects.example.invalid",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
        region_name="us-east-1",
        config=Config(signature_version="s3v4"),
    )

    access = storage.presign_get("courses/course-id/originals/source.pdf")

    signed_headers = parse_qs(urlsplit(access.url).query)["X-Amz-SignedHeaders"][0]
    required_headers = set(signed_headers.split(";")) - {"host"}
    assert required_headers == set(access.headers)
    assert access.headers == {
        "x-amz-expected-bucket-owner": "123456789012",
    }


def test_original_source_access_rejects_expiry_outside_private_viewer_window():
    storage = ObjectStorage.__new__(ObjectStorage)
    storage.local = False
    storage.client = _RecordingS3Client()

    for invalid_expiry in (0, 119, 121, 900):
        try:
            storage.presign_get("courses/course-id/originals/source.pdf", expires_in=invalid_expiry)
        except ValueError as exc:
            assert str(exc) == "Original access must expire after 120 seconds"
        else:
            raise AssertionError("invalid source access expiry was accepted")
