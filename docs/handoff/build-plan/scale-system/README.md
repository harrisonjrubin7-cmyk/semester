# Platform scale system (from "continue (8).pdf")

Prototype: `ui_kits/scale-system/` (8 tabs). Registry files here are generated from its data so the page and the registry can't drift.

| File | What |
|---|---|
| `registry/boundaries/capability-placement.yaml` | 20 capabilities: placement, honest maturity level, authority, may / may-not, evidence, next proof |
| `registry/integrations/connectors.yaml` | Lifecycle, 12 pilot-certification proofs, change triggers, 5 passports (SIS, LMS, payments, email, IdP) |

## Corrections to the PDF
- **SIS-001 is not pilot_certified.** The connector is drafted code (`live-sis-sync`) that has never run against a sandbox. Listed as `designed`; every passport's health is `not observed`.
- **No capability is above Level 2.** The PDF's ladder is adopted as written; levels are assigned from evidence in this project and the repo audit, not from prototypes. Registration readiness, housing, dining and payments are Level 2 (contracts drafted, not run).
- **Vanderbilt is at the implementation stage** of the commercial lifecycle (signed paid pilot, founder-reported), with all four implementation gates open.

## Portfolio decision encoded
Expansion items (second tenant, connector reuse, cohort growth) and deepening items can't be scheduled while any of the five critical foundations is open, unless a risk acceptance with a named person and reference is recorded.
