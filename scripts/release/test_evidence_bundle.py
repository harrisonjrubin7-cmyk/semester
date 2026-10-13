import copy
import hashlib
import tempfile
import unittest
from pathlib import Path

from evidence_bundle import validate, EvidenceError


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name) / "bundle"
        self.base.mkdir()
        content = "synthetic proof\n"
        (self.base / "proof.txt").write_text(content)
        # A real file one level above the bundle, so an escape is only caught by the path guard.
        (Path(self.temp.name) / "outside.txt").write_text(content)
        target = dict(
            commit_sha="a" * 40,
            environment="preview",
            configuration_digest="fixture-digest",
            cohort="pilot-a",
            data_mode="synthetic",
        )
        self.b = dict(
            schema_version=1,
            target=target,
            artifacts=[
                dict(
                    id="ci",
                    target=copy.deepcopy(target),
                    owner="ci",
                    captured_at="2026-10-13T00:00:00Z",
                    classification="non-sensitive",
                    path="proof.txt",
                    sha256=hashlib.sha256(content.encode()).hexdigest(),
                )
            ],
        )

    def reject(self):
        with self.assertRaises(EvidenceError):
            validate(self.b, self.base)

    def test_valid(self):
        self.assertFalse(validate(self.b, self.base)["release_authorized"])

    def test_tamper(self):
        (self.base / "proof.txt").write_text("changed")
        self.reject()

    def test_target(self):
        self.b["artifacts"][0]["target"]["cohort"] = "other"
        self.reject()

    def test_escape(self):
        self.b["artifacts"][0]["path"] = "../outside.txt"
        self.reject()

    def test_absolute(self):
        self.b["artifacts"][0]["path"] = str(self.base / "proof.txt")
        self.reject()

    def test_duplicate(self):
        self.b["artifacts"] *= 2
        self.reject()

    def test_missing(self):
        (self.base / "proof.txt").unlink()
        self.reject()

    def test_empty(self):
        self.b["artifacts"] = []
        self.reject()

    def test_sensitive(self):
        self.b["artifacts"][0]["classification"] = "restricted"
        self.reject()

    def test_tenant(self):
        self.b["target"]["data_mode"] = "connected"
        self.reject()

    def test_scope(self):
        del self.b["target"]["cohort"]
        self.reject()

    def test_sha(self):
        self.b["target"]["commit_sha"] = "main"
        self.reject()


if __name__ == "__main__":
    unittest.main()
