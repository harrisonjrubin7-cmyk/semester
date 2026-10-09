import zipfile
from pathlib import Path

import pytest

from app.extractors.files import safe_zip_members


def test_safe_zip_rejects_path_traversal(tmp_path: Path):
    archive = tmp_path / "bad.zip"
    with zipfile.ZipFile(archive, "w") as zf: zf.writestr("../escape.txt", "bad")
    with pytest.raises(ValueError, match="Unsafe archive path"): safe_zip_members(archive, tmp_path / "out")
