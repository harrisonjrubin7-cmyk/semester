"""v2 enrollment-command schema tests. Runs the shared fixtures in v2-fixtures.json (also checked with ajv in v2-results.json),
plus a guard that v1 still accepts what v2 deliberately tightens — so the change is visible, not silent.
Run: python -m unittest -v test_enrollment_v2.py   (needs jsonschema; same pin as test_registrar_schemas.py)
"""
import json, unittest
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

HERE = Path(__file__).parent
V2 = json.loads((HERE / "enrollment_commands.v2.schema.json").read_text())
V1 = json.loads((HERE / "enrollment_commands.schema.json").read_text())
FIXTURES = json.loads((HERE / "v2-fixtures.json").read_text())
fc = FormatChecker()
ok = lambda schema, body: Draft202012Validator(schema, format_checker=fc).is_valid(body)


class SchemaTests(unittest.TestCase):
    def test_v2_is_a_valid_2020_12_schema(self):
        Draft202012Validator.check_schema(V2)

    def test_v2_fixtures(self):
        for f in FIXTURES:
            with self.subTest(f["name"]):
                self.assertEqual(ok(V2, f["payload"]), f["expect"] == "valid")

    def test_v1_to_v2_tightening_is_intended(self):
        # v1 accepted these; v2 must reject them. If v1 starts rejecting one, update this list on purpose.
        tightened = {"swap 1→2 rejected", "swap 2→1 rejected", "term 0000FA rejected"}
        for f in FIXTURES:
            if f["name"] in tightened:
                with self.subTest(f["name"]):
                    self.assertTrue(ok(V1, f["payload"]), "v1 should still accept this (documents the change)")
                    self.assertFalse(ok(V2, f["payload"]))

    def test_no_idempotency_field_anywhere_in_body(self):
        for branch in V2["oneOf"]:
            self.assertNotIn("idempotencyKey", branch["properties"])
            self.assertFalse(branch.get("additionalProperties", True))


if __name__ == "__main__":
    unittest.main(verbosity=2)
