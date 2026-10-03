# Academic Records Data Model

Core entities: Institution, Person, IdentityLink, Term, Program, Course, Section, Enrollment, Requirement, Plan, RegistrationIntent, OfficialActionReceipt, HoldReference, GradeEntry, TranscriptReference, TransferCreditReference, Approval, Appeal, and AuditEvent.

Every consequential record includes tenant, source system, source identifier, authority class, observed/effective time, freshness, status, actor, purpose, consent/legal basis where applicable, correlation ID, retention class, and supersession link. Derived plans never overwrite authoritative records.

---

Evidence baseline: `origin/main` at `8ccf55af`, assessed 2026-10-03. “Implemented” means repository evidence, not institutional approval or observed production operation.
