import stat
import zipfile
from pathlib import Path

import pytest

from app.core.config import settings
from app.extractors.files import safe_zip_members


def _archive(path: Path, names: list[str]) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for name in names:
            archive.writestr(name, "x")


def test_safe_zip_rejects_path_traversal_and_cleans_partial_output(tmp_path: Path):
    archive = tmp_path / "bad.zip"
    _archive(archive, ["good.txt", "../escape.txt"])
    output = tmp_path / "out"

    with pytest.raises(ValueError, match="Unsafe archive path"):
        safe_zip_members(archive, output)

    assert not output.exists()


def test_safe_zip_enforces_entry_count_at_exact_boundary(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(settings, "max_archive_entries", 100, raising=False)
    allowed = tmp_path / "allowed.zip"
    _archive(allowed, [f"item-{index}.txt" for index in range(100)])
    assert len(safe_zip_members(allowed, tmp_path / "allowed")) == 100

    rejected = tmp_path / "rejected.zip"
    _archive(rejected, [f"item-{index}.txt" for index in range(101)])
    with pytest.raises(ValueError, match="more than 100 entries"):
        safe_zip_members(rejected, tmp_path / "rejected")
    assert not (tmp_path / "rejected").exists()


def test_safe_zip_rejects_duplicate_member_names(tmp_path: Path):
    archive = tmp_path / "duplicate.zip"
    with zipfile.ZipFile(archive, "w") as writer:
        writer.writestr("notes.txt", "first")
        writer.writestr("notes.txt", "second")

    with pytest.raises(ValueError, match="duplicate member"):
        safe_zip_members(archive, tmp_path / "out")
    assert not (tmp_path / "out").exists()


def test_safe_zip_rejects_symlink_members(tmp_path: Path):
    archive = tmp_path / "symlink.zip"
    member = zipfile.ZipInfo("linked.txt")
    member.create_system = 3
    member.external_attr = (stat.S_IFLNK | 0o777) << 16
    with zipfile.ZipFile(archive, "w") as writer:
        writer.writestr(member, "target.txt")

    with pytest.raises(ValueError, match="symbolic link"):
        safe_zip_members(archive, tmp_path / "out")
    assert not (tmp_path / "out").exists()


def test_safe_zip_uses_configured_member_and_cumulative_limits(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 5)
    monkeypatch.setattr(settings, "max_archive_expanded_bytes", 8, raising=False)

    exact = tmp_path / "exact.zip"
    with zipfile.ZipFile(exact, "w") as writer:
        writer.writestr("one.txt", "12345")
        writer.writestr("two.txt", "123")
    assert len(safe_zip_members(exact, tmp_path / "exact")) == 2

    member_too_large = tmp_path / "member-too-large.zip"
    with zipfile.ZipFile(member_too_large, "w") as writer:
        writer.writestr("large.txt", "123456")
    with pytest.raises(ValueError, match="member exceeds 5 bytes"):
        safe_zip_members(member_too_large, tmp_path / "large")

    total_too_large = tmp_path / "total-too-large.zip"
    with zipfile.ZipFile(total_too_large, "w") as writer:
        writer.writestr("one.txt", "12345")
        writer.writestr("two.txt", "1234")
    with pytest.raises(ValueError, match="expanded data exceeds 8 bytes"):
        safe_zip_members(total_too_large, tmp_path / "total")


def test_safe_zip_reports_malformed_archives_and_leaves_no_output(tmp_path: Path):
    archive = tmp_path / "malformed.zip"
    archive.write_bytes(b"not a zip")

    with pytest.raises(ValueError, match="Invalid ZIP archive"):
        safe_zip_members(archive, tmp_path / "out")
    assert not (tmp_path / "out").exists()
