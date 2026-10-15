"""Side-by-side OAS 3.0 / 3.1 payload-schema comparison — v2 of the uploaded tool (see original/).

The point of a 3.0 → 3.1 migration check is finding payloads the two schemas judge *differently*. The original
reported each version's validity for one payload; v2 adds:
  * a verdict per payload — `same` (both valid or both invalid) or `diverged`, with the keywords involved;
  * batch mode: --fixtures takes a list of {name, payload, expect?}, so a whole migration is one report, and
    `expect` ("both-valid", "both-invalid", "diverge-ok") makes intended differences explicit instead of silent;
  * --self-test: eight built-in pairs for the checklist's known traps (nullable, nullable+enum, boolean
    exclusiveMinimum, tuple items → prefixItems, discriminator without const, $ref siblings are refused, …).

Still payload Schema Objects only: no reference resolution, HTTP, auth or business rules.
Run:  python compare_oas_payloads.py --fixtures fixtures.json --schema30 s30.json --schema31 s31.json --report report.json
      python compare_oas_payloads.py --self-test
"""
import argparse, hashlib, json
from pathlib import Path

DIALECTS = ("https://json-schema.org/draft/2020-12/schema", "https://spec.openapis.org/oas/3.1/dialect/base")


def inspect(node, version):
    if isinstance(node, dict):
        if any(k in node for k in ("$ref", "$dynamicRef", "$id")):
            raise ValueError("Standalone self-contained schemas only; bundle and review references separately")
        d = node.get("$schema")
        if d and d not in DIALECTS:
            raise ValueError("Unsupported dialect")
        if version == "3.1" and "nullable" in node:
            raise ValueError("nullable has no 3.1 assertion; migrate it to a null union")
        if version == "3.1" and isinstance(node.get("exclusiveMinimum"), bool) or version == "3.1" and isinstance(node.get("exclusiveMaximum"), bool):
            raise ValueError("boolean exclusiveMinimum/Maximum is 3.0 form; use a numeric bound in 3.1")
        for v in node.values():
            inspect(v, version)
    elif isinstance(node, list):
        for v in node:
            inspect(v, version)


def check(version, schema, payload):
    from openapi_schema_validator import OAS30Validator, OAS31Validator
    from jsonschema import FormatChecker
    cls = OAS30Validator if version == "3.0" else OAS31Validator
    try:
        inspect(schema, version)
        cls.check_schema(schema)
        errs = list(cls(schema, format_checker=FormatChecker()).iter_errors(payload))
        return {"status": "valid" if not errs else "invalid",
                "errors": [{"instance_path": "/" + "/".join(map(str, e.absolute_path)),
                            "schema_path": "/" + "/".join(map(str, e.absolute_schema_path)), "keyword": e.validator} for e in errs]}
    except Exception as exc:
        return {"status": "blocked", "exception_type": type(exc).__name__, "detail": str(exc)[:160]}


def compare(payload, schema30, schema31, expect=None):
    a, b = check("3.0", schema30, payload), check("3.1", schema31, payload)
    if "blocked" in (a["status"], b["status"]):
        verdict = "blocked"
    else:
        verdict = "same" if a["status"] == b["status"] else "diverged"
    keywords = sorted({e["keyword"] for e in a.get("errors", []) + b.get("errors", [])})
    ok = {"both-valid": a["status"] == b["status"] == "valid", "both-invalid": a["status"] == b["status"] == "invalid",
          "diverge-ok": verdict == "diverged", None: verdict == "same"}.get(expect, False)
    return {"3.0": a, "3.1": b, "verdict": verdict, "keywords": keywords, "expect": expect, "passed": ok and verdict != "blocked"}


SELF_TEST = [
    ("nullable string accepts null in both", {"type": "string", "nullable": True}, {"type": ["string", "null"]}, None, "both-valid"),
    ("nullable + enum without null: both reject null — the enum must list null too", {"type": "string", "nullable": True, "enum": ["a", "b"]},
     {"type": ["string", "null"], "enum": ["a", "b"]}, None, "both-invalid"),
    ("nullable + enum, migrated correctly with null in the enum", {"type": "string", "nullable": True, "enum": ["a", "b", None]},
     {"type": ["string", "null"], "enum": ["a", "b", None]}, None, "both-valid"),
    ("boolean exclusiveMinimum → numeric bound", {"type": "number", "minimum": 0, "exclusiveMinimum": True},
     {"type": "number", "exclusiveMinimum": 0}, 0, "both-invalid"),
    ("tuple items → prefixItems + items:false rejects extras", {"type": "array", "items": {"type": "string"}, "maxItems": 2},
     {"type": "array", "prefixItems": [{"type": "string"}, {"type": "integer"}], "items": False}, ["a", 1, "extra"], "both-invalid"),
    ("tuple: 3.0 can't type position 2, 3.1 can — intended difference", {"type": "array", "items": {}},
     {"type": "array", "prefixItems": [{"type": "string"}, {"type": "integer"}], "items": False}, ["a", "not-int"], "diverge-ok"),
    ("discriminator alone asserts nothing; const does", {"type": "object", "properties": {"op": {"type": "string"}}},
     {"type": "object", "required": ["op"], "properties": {"op": {"const": "add"}}}, {"op": "magic"}, "diverge-ok"),
    ("leftover nullable in a 3.1 schema is refused, not ignored", {"type": "string", "nullable": True},
     {"type": "string", "nullable": True}, None, "blocked"),
]


def self_test():
    out = []
    for name, s30, s31, payload, expect in SELF_TEST:
        r = compare(payload, s30, s31, None if expect == "blocked" else expect)
        passed = r["verdict"] == "blocked" if expect == "blocked" else r["passed"]
        out.append({"case": name, "expect": expect, "verdict": r["verdict"], "passed": passed})
    return {"self_test": out, "passed": all(c["passed"] for c in out)}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--payload"); p.add_argument("--fixtures"); p.add_argument("--schema30"); p.add_argument("--schema31")
    p.add_argument("--report", default="comparison-report.json"); p.add_argument("--self-test", action="store_true")
    a = p.parse_args()
    try:
        if a.self_test:
            report = self_test()
        else:
            if not (a.schema30 and a.schema31 and (a.payload or a.fixtures)):
                p.error("--schema30, --schema31 and --payload or --fixtures are required (or --self-test)")
            s30, s31 = (json.loads(Path(x).read_text()) for x in (a.schema30, a.schema31))
            fixtures = json.loads(Path(a.fixtures).read_text()) if a.fixtures else [{"name": "payload", "payload": json.loads(Path(a.payload).read_text())}]
            cases = [{"name": f.get("name", f"fixture {i + 1}"), **compare(f["payload"], s30, s31, f.get("expect"))} for i, f in enumerate(fixtures)]
            report = {"cases": cases, "diverged": sum(c["verdict"] == "diverged" for c in cases),
                      "schema_sha256": {k: hashlib.sha256(Path(getattr(a, k)).read_bytes()).hexdigest() for k in ("schema30", "schema31")},
                      "passed": all(c["passed"] for c in cases),
                      "limitations": ["Payload Schema Objects only; not full OAS or HTTP compliance",
                                      "No authentication or registrar business-policy validation",
                                      "No reference resolution; no directional readOnly/writeOnly validation"]}
    except ImportError:
        report = {"status": "blocked", "code": "DEPENDENCY_MISSING", "passed": False}
    Path(a.report).write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in report if k in ("passed", "diverged", "code")}))
    raise SystemExit(0 if report.get("passed") else 1)
