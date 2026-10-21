import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import build_manifest
from evidence_bundle import EvidenceError, validate


def git(repo, *args):
    subprocess.run(
        ["git", "-C", str(repo), "-c", "user.email=t@example.com", "-c", "user.name=t", *args],
        check=True,
        capture_output=True,
    )


class BuildManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        git(self.repo, "init", "-q")
        for _, _, rel in build_manifest.INPUTS:
            path = self.repo / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"synthetic {rel}\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "fixture")
        self.out = Path(self.temp.name) / "bundle"

    def build(self, environment="preview"):
        return build_manifest.build(self.repo, self.out, environment, "pilot-a")

    def test_bundle_validates_and_authorizes_nothing(self):
        result = self.build()
        self.assertEqual(result["integrity"], "passed")
        self.assertFalse(result["release_authorized"])
        self.assertEqual(result["artifact_count"], len(build_manifest.INPUTS))

    def test_manifest_is_reproducible(self):
        self.build()
        first = (self.out / "manifest.json").read_text()
        second_out = Path(self.temp.name) / "again"
        build_manifest.build(self.repo, second_out, "preview", "pilot-a")
        self.assertEqual(first, (second_out / "manifest.json").read_text())

    def test_dirty_worktree_is_refused(self):
        (self.repo / "package.json").write_text("changed but uncommitted\n")
        with self.assertRaisesRegex(RuntimeError, "dirty"):
            self.build()

    def test_existing_output_is_refused(self):
        self.out.mkdir()
        with self.assertRaisesRegex(RuntimeError, "already exists"):
            self.build()

    def test_unknown_environment_is_refused(self):
        with self.assertRaisesRegex(ValueError, "environment"):
            self.build("live")

    def test_tampered_copy_fails_validation(self):
        self.build()
        (self.out / "artifacts/root-lockfile/package-lock.json").write_text("tampered\n")
        bundle = json.loads((self.out / "manifest.json").read_text())
        with self.assertRaisesRegex(EvidenceError, "digest mismatch"):
            validate(bundle, self.out)

    def test_configuration_digest_moves_when_an_input_changes(self):
        self.build()
        before = json.loads((self.out / "manifest.json").read_text())["target"]["configuration_digest"]
        (self.repo / "deploy/nginx.conf").write_text("changed\n")
        git(self.repo, "commit", "-aqm", "change")
        other = Path(self.temp.name) / "after"
        build_manifest.build(self.repo, other, "preview", "pilot-a")
        after = json.loads((other / "manifest.json").read_text())["target"]["configuration_digest"]
        self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
