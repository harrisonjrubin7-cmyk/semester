# Domain authority matrix (Phase 0 delta)

**As of** 2026-10-05 · **Status** Phase 0. The full matrix is [`SEMESTER_DATA_AUTHORITY_MATRIX.md`](SEMESTER_DATA_AUTHORITY_MATRIX.md) and the replacement gates are [`SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](SEMESTER_DOMAIN_REPLACEMENT_GATES.md). This page only adds what the live schema shows.

Rule: no domain is the authoritative record until it passes the 16 gates in the master command. **No domain below has been assessed against those gates here, so none is classed above "Ready for internal use".**

| Domain | Where it lives | Mode the schema supports | Rows in live project | Class |
| --- | --- | --- | --- | --- |
| Registration | `registration_*` | Connect (SIS reads) / Core (switch via `tenant_module_mode`) | 0 | Native but incomplete; requires institutional approval, reconciliation, rollback |
| Gradebook | `gradebook_*`, `grade_entries`, `regrade_*`, `grade_passbacks` | LMS passback queue | 0 | Native but incomplete; requires institutional approval |
| Academic record | `academic_record_*` | Append-only ledger, "not an official transcript" | 0 | Native but incomplete; never authoritative without gates |
| Student accounts | `student_account_*`, `student_payment_plan*` | Ledger and agreement only; "no money moves here" | 0 | Native but incomplete; requires legal and finance review |
| Identity / SSO / SCIM | `institution_*`, `scim_*`, `tenant_sso_policy` | DB gateway; HTTP SCIM endpoint not found | 0 | Native but incomplete; requires security review |
| Dining | `dining_*` | Card-office adapter; nothing charges unless live | 0 | Integrated-by-design, unverified |
| Integrations | `integration_*`, `source_*` | Born disconnected; approval before write | 0 | Native but incomplete |
| Billing | `commercial_*`, `billing_*`, `subscriptions`, `invoices`, `payment_events` | Provider webhooks; no card data | 3–11 | Pilot-only |
| GTM | `gtm_*`, `site_leads` | Workers/service role | `site_leads` 9, rest 0 | Native but incomplete |
| Trust room | `trust_*` | Hashed expiring grants | 0 | Native but incomplete; claims need owner evidence |

Source distinctions the PDFs require (official / connected / student-entered / Semester-derived / AI-assisted / community / sample) are enforced in schema comments and the status vocabulary; no cross-domain audit of the UI labels was run in this pass.
