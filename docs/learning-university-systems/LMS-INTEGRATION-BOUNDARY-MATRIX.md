# LMS Integration Boundary Matrix

Launch/context uses LTI 1.3; roster/roles use NRPS or OneRoster; assignments/grades use AGS; assessment portability uses QTI; content migration uses rights-checked import; calendar uses approved feeds/connectors. Semester owns only configured scopes. External writes are previewable, explicit, idempotent, audited, reconcilable, and reversible where the provider permits.

Until live UAT exists, UI must say “connection not configured” or “prepared for official system,” never “synced.”

---

Evidence baseline: `origin/main` at `8ccf55af`, assessed 2026-10-03. “Implemented” means repository evidence, not institutional approval or observed production operation.
