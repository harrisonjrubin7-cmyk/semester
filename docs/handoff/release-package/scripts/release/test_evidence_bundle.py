import copy, hashlib, os, tempfile, unittest
from pathlib import Path
from evidence_bundle import validate, EvidenceError


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name); (self.base / "proof.txt").write_text("synthetic proof")
        target = dict(commit_sha="a" * 40, environment="preview", configuration_digest="fixture",
                      cohort="synthetic-cohort", data_mode="synthetic")
        self.b = dict(schema_version=1, target=target, artifacts=[dict(
            id="ci", target=copy.deepcopy(target), owner="Engineering", captured_at="2026-10-13T00:00:00Z",
            classification="non-sensitive", path="proof.txt",
            sha256=hashlib.sha256(b"synthetic proof").hexdigest())])

    def reject(self):
        with self.assertRaises(EvidenceError):
            validate(self.b, self.base)

    def test_valid(self): self.assertFalse(validate(self.b, self.base)["release_authorized"])
    def test_tamper(self): (self.base / "proof.txt").write_text("changed"); self.reject()
    def test_target(self): self.b["artifacts"][0]["target"]["cohort"] = "other"; self.reject()
    def test_escape(self): self.b["artifacts"][0]["path"] = "../proof.txt"; self.reject()
    def test_absolute(self): self.b["artifacts"][0]["path"] = str(self.base / "proof.txt"); self.reject()
    def test_duplicate(self): self.b["artifacts"] *= 2; self.reject()
    def test_missing(self): (self.base / "proof.txt").unlink(); self.reject()
    def test_empty(self): self.b["artifacts"] = []; self.reject()
    def test_sensitive(self): self.b["artifacts"][0]["classification"] = "restricted"; self.reject()
    def test_tenant(self): self.b["target"]["data_mode"] = "connected"; self.reject()
    def test_scope(self): del self.b["target"]["cohort"]; self.reject()
    def test_sha(self): self.b["target"]["commit_sha"] = "main"; self.reject()

    def test_symlink(self):
        outside = Path(self.temp.name).parent / ("outside-" + os.urandom(4).hex())
        outside.write_text("synthetic proof"); self.addCleanup(outside.unlink)
        (self.base / "link.txt").symlink_to(outside)
        self.b["artifacts"][0]["path"] = "link.txt"; self.reject()


if __name__ == "__main__":
    unittest.main()
