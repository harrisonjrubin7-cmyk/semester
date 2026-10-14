# Traceability & execution (from "continue (9).pdf")

Prototype: `ui_kits/traceability/` (9 tabs). Registry files are generated from its data.

| Path | What |
|---|---|
| `registry/trace/CAP-REG-001.yaml` | 18-link chain decision → retirement, each marked exists-here / drafted / proposed |
| `registry/passports/*.yaml` | WF-READINESS-001, SIS-001, AI-READINESS-001 in the passport schema |
| `registry/decisions.yaml` | 5 decisions incl. DEC-AUTHZ-001 and the pilot wording |
| `registry/evidence-validity.yaml` | What invalidates each evidence type |
| `docs/operations/offboarding/tenant-offboarding.yaml` | 5 phases, 20 steps |
| `scripts/verify/registry.ts.txt` | CI check: incomplete passports, level/status disagreement, unknown prefixes, proposed links counted as evidence, unowned documents |
| `scripts/verify/record-envelope.ts.txt` | Envelope check; also requires `observedAt` on source-backed records and refuses AI-assisted records owned as institution-authoritative |

## Corrections to the PDF
- **WF-READINESS-001 is Level 2, not 4 "verified_not_activated".** Nothing is built or run. The verifier fails a passport whose level and status disagree.
- **Several chain paths don't exist** (`db/migrations/241_readiness.sql`, `apps/student-web/…`, `contracts/asyncapi/…`). The repo uses `app/` and `supabase/migrations/`. They're marked *proposed* — map them to real paths before the chain can carry evidence.
- **Record envelope:** source-backed records also need `observedAt`; without it freshness can't be computed.

Not run: neither script, nothing in CI.
