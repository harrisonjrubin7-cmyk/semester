"""Generate the standalone enrollment-command JSON Schema from the reference OpenAPI, so the two can't drift.
Source of truth: ../reference-package/enrollment.openapi.json  →  components.schemas.EnrollmentCommand
Output: enrollment_commands.generated.schema.json (draft 2020-12; OpenAPI-only keywords removed).
Run:  python generate_from_openapi.py           # writes the file
      python generate_from_openapi.py --check   # exit 1 if the committed file is stale (use in CI)
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE.parent / "reference-package" / "enrollment.openapi.json"
OUT = HERE / "enrollment_commands.generated.schema.json"
OAS_ONLY = {"discriminator", "xml", "externalDocs", "example"}  # not JSON Schema assertions


def strip(node):
    if isinstance(node, dict):
        if "$ref" in node:
            raise SystemExit(f"EnrollmentCommand has a $ref ({node['$ref']}); inline it before generating")
        return {k: strip(v) for k, v in node.items() if k not in OAS_ONLY}
    if isinstance(node, list):
        return [strip(v) for v in node]
    return node


def build():
    oas = json.loads(SRC.read_text())
    if not oas.get("openapi", "").startswith("3.1"):
        raise SystemExit("Source must be OpenAPI 3.1 (JSON Schema 2020-12 compatible)")
    cmd = strip(oas["components"]["schemas"]["EnrollmentCommand"])
    return {"$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "semester:registrar/enrollment-commands/generated",
            "$comment": f"Generated from {SRC.name} — do not edit by hand", **cmd}


if __name__ == "__main__":
    text = json.dumps(build(), indent=2, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        stale = not OUT.exists() or OUT.read_text() != text
        print("stale — run generate_from_openapi.py" if stale else "up to date")
        sys.exit(1 if stale else 0)
    OUT.write_text(text)
    print(f"wrote {OUT.name}")
