# Platform operations (from "continue (10).pdf")

The PDF's 25 artifacts. Nothing here was run against infrastructure; the registry checker was run here over the scale-system capability list (`evidence/registry-report.md`: 26 blocking, mostly REG-001 — no owners named).

Docs: platform layers · environments (lists the 4 known Supabase projects; production still unnamed) · secrets · recovery · observability (adds a never-logged list) · admissions, financial-aid, wellness/safety boundaries · research governance · MET-READINESS-001 (adds a minimum denominator of 30) · workflow-router governance · feature-flag standard · registry checks · 90-day plan (periods start on evidence, not dates) · hiring triggers.

Code (`.ts.txt`): `trace-context` (drops forbidden log fields itself) · recovery `restore / rebuild-projections / reconcile` (dry-run by default; refuse any target that isn't an isolated recovery/drill environment; restore takes synthetic fixtures only) · `verify/feature-flags` (fails an active flag for a capability below Level 4, or global production enablement) · `verify/environment-boundaries` (fails if a non-production build points at the production project or a VITE_ var carries a secret) · `registry/check.mjs`.

Tests: P0 rollback (kill switch → 423, receipt count unchanged), source outage (stale → no definitive outcome; SIS timeout → needs review), access revocation (expired grant → next read empty, next command 403).

`evidence/acceptance/REL-READINESS-001.yaml`: a test that hasn't run counts as failed.

## What not to build yet (from the PDF)
Official enrollment writes, automatic overrides or hold removal · automated grade release, discipline, aid calculations, risk scoring · clinical/crisis/emergency claims · open partner production access · cross-domain student profiling · marketplace use of institutional data · consequential AI agents · broad multi-tenant expansion before a second-tenant simulation.
