# OAS 3.0 → 3.1 migration comparison (v2)

`original/` is the uploaded package. **Not run** — no Python here.

```bash
pip install openapi-schema-validator jsonschema        # pin reviewed versions
python compare_oas_payloads.py --self-test             # 8 built-in migration traps
python compare_oas_payloads.py --fixtures fixtures.json --schema30 s30.json --schema31 s31.json --report report.json
```

`fixtures.json` is a list of `{ "name", "payload", "expect" }` where `expect` is `both-valid`, `both-invalid` or `diverge-ok`; leave it out to require the same verdict from both.

## What changed

- **Divergence is the result.** Each payload gets `same` or `diverged` plus the keywords involved — the thing a migration review needs. The original only printed each side's validity for one payload.
- **Batch fixtures with intent.** `expect: "diverge-ok"` records a deliberate tightening (e.g. a tuple position the 3.0 schema couldn't type); any other divergence fails the run.
- **Self-test of known traps:** nullable, nullable + enum, boolean `exclusiveMinimum`, tuple `items` → `prefixItems`, discriminator without `const`, and a leftover `nullable` in a 3.1 schema being refused rather than silently ignored.
- **3.1 schemas with the boolean `exclusiveMinimum/Maximum` form are refused**, like `nullable`.

The Streamlit UI in `original/` still works with v2's `compare(payload, s30, s31)`; it now also returns `verdict` and `keywords`. Keep it on 127.0.0.1 and never load student fixtures into it.

`original/access_operation_coverage.csv` covers only the eight access-control operations, all `not_evidenced`. Use `../live-runner` for the two GETs and `../validator` captured fixtures for the six writes.
