"""Tests for the registrar OAS validator.

Run from the repository root with the pinned requirements installed:

    python -I -m unittest discover -s scripts/registrar-oas -v
"""

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import registrar_oas_validator as v

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
SPEC = json.loads((FIXTURES / "synthetic_validator_spec.json").read_text())
CAPTURES = json.loads((FIXTURES / "synthetic_captures.json").read_text())
EXPECTED_CASES = 10
ONE_OF = SPEC["paths"]["/registration"]["post"]["requestBody"]["content"]["application/json"]["schema"]["oneOf"]
ADD_BRANCH, SWAP_BRANCH = ONE_OF[0], ONE_OF[2]


def case(report, name):
    return next(c for c in report["cases"] if c["case"] == name)


def codes(report):
    return {f["code"] for f in report["findings"]}


class SyntheticFixtures(unittest.TestCase):
    def test_every_synthetic_case_passes_with_document_validation(self):
        report = v.audit(SPEC, CAPTURES)
        self.assertEqual(report["document_validation"], "passed")
        self.assertEqual(len(report["cases"]), EXPECTED_CASES)
        self.assertEqual([c["case"] for c in report["cases"] if not c["passed"]], [])
        self.assertEqual(report["findings"], [])
        self.assertTrue(report["passed"])

    def test_cli_exit_status_follows_the_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            report_path = Path(tmp) / "report.json"
            run = subprocess.run(
                [
                    sys.executable, "-I", str(HERE / "registrar_oas_validator.py"),
                    "--spec", str(FIXTURES / "synthetic_validator_spec.json"),
                    "--captures", str(FIXTURES / "synthetic_captures.json"),
                    "--report", str(report_path),
                ],
                capture_output=True, text=True,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            report = json.loads(report_path.read_text())
            self.assertTrue(report["passed"])
            self.assertEqual(len(report["spec_sha256"]), 64)

            without_responses = [c for c in CAPTURES if c["direction"] == "request"]
            captures_path = Path(tmp) / "captures.json"
            captures_path.write_text(json.dumps(without_responses))
            run = subprocess.run(
                [
                    sys.executable, "-I", str(HERE / "registrar_oas_validator.py"),
                    "--spec", str(FIXTURES / "synthetic_validator_spec.json"),
                    "--captures", str(captures_path),
                    "--report", str(report_path),
                ],
                capture_output=True, text=True,
            )
            self.assertEqual(run.returncode, 1)
            self.assertFalse(json.loads(report_path.read_text())["passed"])


class ControlMutations(unittest.TestCase):
    """Each control breaks the contract on purpose. The matching case must fail."""

    def test_swap_without_source_requirement_is_accepted_and_the_case_fails(self):
        spec = copy.deepcopy(SPEC)
        swap = spec["paths"]["/registration"]["post"]["requestBody"]["content"]["application/json"]["schema"]["oneOf"][2]
        swap["required"] = ["operation", "sectionIds"]
        report = v.audit(spec, CAPTURES, document_validation=False)
        self.assertTrue(case(report, "invalid swap")["valid"])
        self.assertFalse(case(report, "invalid swap")["passed"])
        self.assertFalse(report["passed"])

    def test_dropping_null_from_receipt_fails_the_nullable_response_case(self):
        spec = copy.deepcopy(SPEC)
        response = spec["paths"]["/registration"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
        response["properties"]["receiptId"]["type"] = "string"
        report = v.audit(spec, CAPTURES, document_validation=False)
        self.assertFalse(case(report, "nullable receipt")["passed"])


class ContractRules(unittest.TestCase):
    def test_local_component_references_resolve_for_payloads(self):
        spec = copy.deepcopy(SPEC)
        body = spec["paths"]["/registration"]["post"]["requestBody"]["content"]["application/json"]
        spec["components"] = {"schemas": {"Command": body["schema"]}}
        body["schema"] = {"$ref": "#/components/schemas/Command"}
        report = v.audit(spec, CAPTURES, document_validation=False)
        self.assertTrue(report["passed"], report["findings"])

    def test_external_reference_blocks_the_bundle(self):
        spec = copy.deepcopy(SPEC)
        body = spec["paths"]["/registration"]["post"]["requestBody"]["content"]["application/json"]
        body["schema"] = {"$ref": "https://example.com/schema.json"}
        report = v.audit(spec, CAPTURES, document_validation=False)
        self.assertIn("EXTERNAL_REF", codes(report))
        self.assertFalse(report["passed"])

    def test_unsupported_dialect_is_blocked(self):
        spec = copy.deepcopy(SPEC)
        spec["jsonSchemaDialect"] = "https://example.com/custom-dialect"
        report = v.audit(spec, CAPTURES, document_validation=False)
        self.assertIn("UNSUPPORTED_DIALECT", codes(report))
        self.assertFalse(report["passed"])

    def test_legacy_nullable_and_bare_discriminator_are_flagged(self):
        spec = copy.deepcopy(SPEC)
        spec["components"] = {"schemas": {
            "Legacy": {"type": "string", "nullable": True},
            "Bare": {"type": "object", "discriminator": {"propertyName": "kind"}},
        }}
        found = {f["code"] for f in v.lint(spec)}
        self.assertIn("NULLABLE_HAS_NO_31_ASSERTION", found)
        self.assertIn("DISCRIMINATOR_COMPOSITION", found)

    def test_readonly_field_in_a_request_is_rejected(self):
        spec = copy.deepcopy(SPEC)
        add = copy.deepcopy(ADD_BRANCH)
        add["properties"]["receiptId"] = {"type": "string", "readOnly": True}
        spec["paths"]["/registration"]["post"]["requestBody"]["content"]["application/json"]["schema"] = {"oneOf": [add]}
        payload = {"operation": "add", "sectionIds": ["11111111-1111-4111-8111-111111111111"], "receiptId": "x"}
        errors = v.payload_errors(spec, spec["paths"]["/registration"]["post"]["requestBody"]["content"]["application/json"]["schema"], payload, "request")
        self.assertIn({"code": "DIRECTIONAL_FIELD", "instance_path": "/receiptId"}, [
            {"code": e["code"], "instance_path": e["instance_path"]} for e in errors if e["code"] == "DIRECTIONAL_FIELD"
        ])

    def test_operation_without_captures_is_reported_uncovered(self):
        requests_only = [c for c in CAPTURES if c["direction"] == "request"]
        report = v.audit(SPEC, requests_only, document_validation=False)
        self.assertIn("UNCOVERED_OPERATION", codes(report))
        self.assertFalse(report["passed"])

    def test_no_captures_is_a_failure(self):
        report = v.audit(SPEC, [], document_validation=False)
        self.assertIn("NO_CAPTURED_CASES", codes(report))
        self.assertFalse(report["passed"])


class Privacy(unittest.TestCase):
    def test_reports_do_not_echo_payload_values(self):
        marker = "SECRET-MARKER-7731"
        captures = copy.deepcopy(CAPTURES)
        next(c for c in captures if c["case"] == "invalid UUID")["payload"]["sectionIds"] = [marker]
        report = v.audit(SPEC, captures)
        self.assertIn("PAYLOAD_SCHEMA", json.dumps(report))
        self.assertNotIn(marker, json.dumps(report))


if __name__ == "__main__":
    unittest.main()
