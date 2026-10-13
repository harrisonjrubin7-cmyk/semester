#!/usr/bin/env python3
"""Parse every YAML file in the registration-readiness pilot package.

Checks syntax only. Content is checked against the PDF by a person.
Exit status 1 if any file fails to parse, or if PyYAML is missing.
"""
import pathlib
import sys

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

ROOT = pathlib.Path(__file__).resolve().parent.parent / "docs/pilot/registration-readiness"

failures = []
files = sorted(ROOT.rglob("*.yaml"))
for path in files:
    try:
        with path.open(encoding="utf-8") as handle:
            yaml.safe_load(handle)
    except yaml.YAMLError as error:
        failures.append((path, error))

for path in files:
    status = "FAIL" if any(p == path for p, _ in failures) else "ok"
    print(f"{status:4} {path.relative_to(ROOT.parent.parent.parent)}")

if not files:
    print("no YAML files found", file=sys.stderr)
    sys.exit(1)

for path, error in failures:
    print(f"\n{path}:\n{error}", file=sys.stderr)

sys.exit(1 if failures else 0)
