# Migration and Cutover Playbook

Inventory → export with checksums → quarantine → transform with mapping version → validate counts/relationships/files/permissions → accessibility and content review → reconcile → user acceptance → parallel run → freeze → cutover → verify → hypercare → archive/offboard.

Rollback triggers include identity mismatch, authorization defect, unreconciled record variance, failed accessibility blocker, unavailable support, or broken provider receipt. Preserve source exports and audit evidence according to approved retention.

---

Evidence baseline: `origin/main` at `8ccf55af`, assessed 2026-10-03. “Implemented” means repository evidence, not institutional approval or observed production operation.
