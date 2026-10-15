# Semester Production System (from "continue (13).pdf")

The operating method over everything else: discover → charter → design → contract → build → verify → activate → operate → measure → decide → scale or retire. Each stage maps to a maturity level (DEC-MATURITY-001).

| File | What |
|---|---|
| docs/operating-system/semester-production-system.yaml | lifecycle, decision owner per stage, stage → level |
| registry/discovery/DISC-001.yaml · registry/capabilities/CAP-DEGREE-002.yaml | advisor-shared degree scenario: discovery packet + charter (Level 0, not before the readiness renewal decision) |
| docs/product/work-item-hierarchy.yaml | theme → outcome → capability → … → evidence → release; priority scoring folds into the existing Domain intake scorer |
| docs/engineering/delivery-standards.yaml | vertical-slice standard + SLICE-REG-001, definitions of ready and done — SLICE-REG-001 is **not ready** (no named owner or support path) |
| docs/release/release-and-change.yaml | release train, freeze conditions, 8 change classes, CHG-001 |
| docs/operations/learning-and-retirement.yaml | incident → roadmap loop (PROB-SOURCE-001), accessibility operating model, institution change control, retirement standard |
| registry/metrics/platform-health.yaml | 9-dimension scorecard with today's honest values |
| scripts/content/status-sentence-lint.mjs.txt | status-sentence linter |

Run here: the linter over 5 status messages (the PDF's stale message, readiness, Canvas, offline, and a bad example). Flagged only the bad example ("Your record is verified." — no meaning, no next step, overclaims without an authoritative source). The first run also flagged the offline message for "no next step"; "keep working on saved items" is a next step, so the rule was widened.

Immediate order (from the PDF): machine-readable maturity on the pilot scope → owners and certifications for the six core pillars → registration readiness as one complete vertical slice → activation gate with the institution → hypercare feeding the recurring-problem register → pilot report with limitations → one adjacent expansion (action center + advisor-shared planning).
