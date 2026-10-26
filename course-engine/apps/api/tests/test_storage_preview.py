from app.services import storage as storage_module
from app.services.storage import ObjectStorage


class _Body:
    def __init__(self, payload: bytes):
        self.payload = payload

    def read(self, _amount: int) -> bytes:
        return self.payload


class _S3Client:
    def __init__(self, payload: bytes):
        self.payload = payload
        self.request = None

    def get_object(self, **kwargs):
        self.request = kwargs
        return {"ContentLength": len(self.payload), "Body": _Body(self.payload)}


def test_s3_preview_reads_owner_scoped_object_with_a_size_cap(monkeypatch):
    payload = b"%PDF-1.7\npreview"
    client = _S3Client(payload)
    storage = ObjectStorage.__new__(ObjectStorage)
    storage.local = False
    storage.client = client
    monkeypatch.setattr(storage_module.settings, "s3_bucket", "course-sources")
    monkeypatch.setattr(storage_module.settings, "s3_expected_bucket_owner", "123456789012")

    assert storage.read_bytes("courses/course-1/original.pdf", max_bytes=1024) == payload
    assert client.request == {
        "Bucket": "course-sources",
        "Key": "courses/course-1/original.pdf",
        "ExpectedBucketOwner": "123456789012",
    }
