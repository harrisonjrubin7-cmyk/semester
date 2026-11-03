import argparse, hashlib, json
from pathlib import Path

def compare(payload, schema30, schema31):
    from openapi_schema_validator import OAS30Validator, OAS31Validator
    from jsonschema import FormatChecker
    reports = {}
    for version, cls, schema in [("3.0", OAS30Validator, schema30), ("3.1", OAS31Validator, schema31)]:
        def inspect(node):
            if isinstance(node, dict):
                if any(k in node for k in ("$ref", "$dynamicRef", "$id")):
                    raise ValueError("Standalone self-contained schemas only; bundle and review references separately")
                dialect = node.get("$schema")
                if dialect and dialect not in ("https://json-schema.org/draft/2020-12/schema", "https://spec.openapis.org/oas/3.1/dialect/base"):
                    raise ValueError("Unsupported dialect")
                if version == "3.1" and "nullable" in node:
                    raise ValueError("nullable has no standard 3.1 assertion; migrate it")
                for value in node.values(): inspect(value)
            elif isinstance(node, list):
                for value in node: inspect(value)
        try:
            inspect(schema)
            cls.check_schema(schema)
            errors = list(cls(schema, format_checker=FormatChecker()).iter_errors(payload))
            reports[version] = {"status": "valid" if not errors else "invalid", "errors": [
                {"instance_path": "/" + "/".join(map(str, e.absolute_path)),
                 "schema_path": "/" + "/".join(map(str, e.absolute_schema_path)),
                 "keyword": e.validator} for e in errors]}
        except Exception as exc:
            reports[version] = {"status": "blocked", "exception_type": type(exc).__name__}
    reports["limitations"] = ["Payload Schema Objects only; not full OAS or HTTP compliance",
        "No authentication or registrar business-policy validation",
        "No reference resolution; no full directional annotation validation"]
    return reports

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for name in ("payload", "schema30", "schema31"): parser.add_argument("--" + name, required=True)
    parser.add_argument("--report", default="comparison-report.json")
    args = parser.parse_args()
    documents = [json.loads(Path(getattr(args, key)).read_text()) for key in ("payload", "schema30", "schema31")]
    try: result = compare(*documents)
    except ImportError: result = {"status": "blocked", "code": "DEPENDENCY_MISSING"}
    result["schema_sha256"] = {key: hashlib.sha256(Path(getattr(args, key)).read_bytes()).hexdigest() for key in ("schema30", "schema31")}
    Path(args.report).write_text(json.dumps(result, indent=2))
    raise SystemExit(0 if all(result.get(v, {}).get("status") == "valid" for v in ("3.0", "3.1")) else 1)
