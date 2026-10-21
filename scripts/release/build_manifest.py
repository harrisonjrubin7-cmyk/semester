#!/usr/bin/env python3
"""Snapshot the release inputs of one commit as an evidence bundle.

Writes manifest.json (the schema evidence_bundle.py validates) and a copy of
each file it digests, so the bundle can be checked without the repository.
Integrity only: a valid bundle never authorizes a release. Refuses a dirty
worktree, so the digests name exactly one commit. Nothing here reads a secret;
every input is a tracked configuration or lock file.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from evidence_bundle import validate  # noqa: E402

# (artifact id, owning role, repository path). Roles, not people: no named approver is implied.
INPUTS = [
    ("root-lockfile", "engineering", "package-lock.json"),
    ("root-manifest", "engineering", "package.json"),
    ("app-manifest", "engineering", "app/package.json"),
    ("vercel-gateway", "platform", "vercel.json"),
    ("app-vercel", "platform", "app/vercel.json"),
    ("frontend-image", "platform", "deploy/Dockerfile.frontend"),
    ("frontend-compose", "platform", "deploy/compose.frontend.yml"),
    ("frontend-nginx", "platform", "deploy/nginx.conf"),
    ("infra-policy-terraform", "security", "infra/policy/terraform.rego"),
    ("infra-policy-workflows", "security", "infra/policy/workflows.rego"),
]
ENVIRONMENTS = ("preview", "staging", "production")


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout.strip()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(repo, out, environment, cohort):
    repo, out = Path(repo).resolve(), Path(out)
    if environment not in ENVIRONMENTS:
        raise ValueError("environment must be one of " + ", ".join(ENVIRONMENTS))
    if git(repo, "status", "--porcelain"):
        raise RuntimeError("worktree is dirty; commit or stash so the digests name one commit")
    if out.exists():
        raise RuntimeError(f"{out} already exists; choose a new directory")

    commit = git(repo, "rev-parse", "HEAD")
    captured_at = git(repo, "show", "-s", "--format=%cI", commit)  # commit time: reproducible, not wall-clock
    digests = {}
    for _, _, rel in INPUTS:
        digests[rel] = sha256(repo / rel)
    # The configuration digest covers the inputs, in a fixed order, so any input change moves it.
    config_digest = hashlib.sha256(
        "".join(f"{rel}={digests[rel]}\n" for rel in sorted(digests)).encode()
    ).hexdigest()

    target = dict(
        commit_sha=commit,
        environment=environment,
        configuration_digest=config_digest,
        cohort=cohort,
        data_mode="synthetic",
    )
    artifacts = []
    for ident, owner, rel in INPUTS:
        src = repo / rel
        dest_rel = f"artifacts/{ident}/{src.name}"
        dest = out / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        artifacts.append(
            dict(
                id=ident,
                target=dict(target),
                owner=owner,
                captured_at=captured_at,
                classification="non-sensitive",
                path=dest_rel,
                sha256=digests[rel],
            )
        )

    bundle = dict(schema_version=1, target=target, artifacts=artifacts)
    manifest = out / "manifest.json"
    manifest.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n")
    return validate(bundle, out)


def main():
    parser = argparse.ArgumentParser(description="Evidence bundle for one commit. Integrity only; never release authorization.")
    parser.add_argument("--repo", default=".")
    parser.add_argument("--out", required=True)
    parser.add_argument("--environment", default="preview", choices=ENVIRONMENTS)
    parser.add_argument("--cohort", default="unassigned")
    args = parser.parse_args()
    try:
        result = build(args.repo, args.out, args.environment, args.cohort)
    except (RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
        parser.exit(1, str(exc) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
