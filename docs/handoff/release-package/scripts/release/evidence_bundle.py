"""Evidence-bundle integrity check. Integrity only — never release authorization."""
import argparse, hashlib, json, re
from pathlib import Path


class EvidenceError(ValueError):
    pass


TARGET_KEYS = ("commit_sha", "environment", "configuration_digest", "cohort", "data_mode")


def validate(bundle, base):
    base = Path(base).resolve()
    if not isinstance(bundle, dict) or bundle.get("schema_version") != 1:
        raise EvidenceError("Unsupported manifest schema")
    target = bundle.get("target")
    if not isinstance(target, dict):
        raise EvidenceError("Missing target")
    for key in TARGET_KEYS:
        if not isinstance(target.get(key), str) or not target[key].strip():
            raise EvidenceError("Missing target: " + key)
    if not re.fullmatch(r"[0-9a-f]{40}", target["commit_sha"]):
        raise EvidenceError("Invalid commit SHA")
    if target["environment"] not in ("preview", "staging", "production"):
        raise EvidenceError("Invalid environment")
    if target["data_mode"] not in ("synthetic", "manual", "connected"):
        raise EvidenceError("Invalid data mode")
    if target["data_mode"] != "synthetic" and not target.get("tenant_id"):
        raise EvidenceError("Non-synthetic data mode requires tenant_id")
    artifacts = bundle.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise EvidenceError("Empty bundle")
    seen = set()
    for item in artifacts:
        if not isinstance(item, dict):
            raise EvidenceError("Malformed artifact")
        identity = item.get("id")
        if not isinstance(identity, str) or not identity or identity in seen:
            raise EvidenceError("Missing or duplicate artifact ID")
        seen.add(identity)
        if item.get("target") != target:
            raise EvidenceError("Cross-target artifact: " + identity)
        for key in ("owner", "captured_at", "classification"):
            if not isinstance(item.get(key), str) or not item[key].strip():
                raise EvidenceError("Missing " + key + ": " + identity)
        if item["classification"] != "non-sensitive":
            raise EvidenceError("Use approved restricted storage for " + identity)
        relative = item.get("path")
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise EvidenceError("Artifact path must be relative: " + identity)
        raw = base / relative
        if raw.is_symlink():
            raise EvidenceError("Symlinked artifact: " + identity)
        path = raw.resolve()
        if not path.is_relative_to(base) or not path.is_file():
            raise EvidenceError("Artifact outside bundle or missing: " + identity)
        digest = item.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise EvidenceError("Invalid sha256: " + identity)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise EvidenceError("Digest mismatch: " + identity)
    return {"integrity": "passed", "artifact_count": len(artifacts), "release_authorized": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evidence integrity only; never release authorization")
    parser.add_argument("manifest")
    args = parser.parse_args()
    path = Path(args.manifest)
    try:
        print(json.dumps(validate(json.loads(path.read_text()), path.parent), indent=2))
    except (EvidenceError, OSError, json.JSONDecodeError) as exc:
        parser.exit(1, str(exc) + "\n")
