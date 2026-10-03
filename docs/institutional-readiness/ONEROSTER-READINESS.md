# OneRoster Readiness

| Control | Value |
| --- | --- |
| Status | **DESIGNED ONLY — NO ONEROSTER CONNECTOR OR CONFORMANCE EVIDENCE** |
| Owner | Harrison Rubin — company-side integration owner; customer SIS/LMS data owner, privacy approver and backup operator unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../INTEROPERABILITY-ROADMAP.md`](../INTEROPERABILITY-ROADMAP.md), [`../DOMAIN-REPLACEMENT-REGISTER.md`](../DOMAIN-REPLACEMENT-REGISTER.md), and [`../INTEGRATION-QUALITY-AND-RECONCILIATION.md`](../INTEGRATION-QUALITY-AND-RECONCILIATION.md) |

## Present state

The repository documents OneRoster 1.2 principles, but contains no OneRoster connector, import/export implementation, provider profile, conformance suite result, certification or institutional feed. Generic pipeline, validation, lineage, freshness and reconciliation controls are reusable foundations; they do not establish OneRoster support.

## Proposed bounded profile

The first profile, if a customer need justifies it, should be read-only and adopted service by service rather than declared wholesale.

| Decision | Proposed boundary | Authority required |
| --- | --- | --- |
| version/transport | OneRoster 1.2; choose REST or CSV only after provider discovery | customer system owner and implementation owner |
| entities | orgs, academic sessions, courses, classes, users and enrollments only when needed | documented purpose and approved field map |
| direction | institution → Semester | source-system owner; no reciprocal write implied |
| source of truth | designated SIS/LMS remains authoritative | customer record authority |
| personal data | opaque/minimum identifiers; exclude unnecessary demographic, accommodation, discipline, financial and free-text data | privacy/security review and contract/data authority |
| cadence/freshness | customer-approved, displayed and monitored | business/system owner |
| deletes/status changes | deliberate suspension/end-date workflow; never silently delete student-created work | records/privacy owner |
| errors | quarantine, sanitized diagnostics and reconciliation before release | integration/data steward |
| fallback | retain last accepted data with source/freshness warning or revert to approved manual path | customer owner and support |
| writes/grades/resources | out of scope until separately specified, implemented and accepted | explicit additional authority |

## Evidence plan

1. Record the exact use case, authoritative system, provider product/version, transport and supported OneRoster profile.
2. Freeze the data dictionary, required/optional fields, classifications, identifiers, term/status mappings, retention and deletion behavior.
3. Implement a tenant-scoped connector and mapping through the governed pipeline; store credentials by reference only.
4. Add schema/profile, tenant isolation, field minimization, enum, duplicate, timestamp, pagination, retry/rate-limit and malformed-input tests.
5. Test adds, drops, section moves, cross-listing, term rollover, re-delivery, partial failure, stale source, suspension and recovery with synthetic data.
6. Produce reconciliation counts/exceptions before release; require human resolution for ambiguity and protect student-created work.
7. Complete qualified conformance/certification work only if commercially and institutionally required.
8. Obtain customer system, privacy, security and operational acceptance before production authorization.

## Evidence state

**Repository evidence.** General integration governance, mocks, validation, freshness, lineage and reconciliation mechanisms exist; OneRoster principles are documented.

**Operational evidence.** There is no OneRoster implementation, target feed, credential, provider test, conformance report, certification, production run, reconciliation or customer acceptance.

**Missing test/proof.** Complete every evidence-plan step for a named target and exact profile. Until then, use a separately approved manual/read-only alternative and describe OneRoster as planned, not supported.

## Claim ceiling

Semester may say it has a documented OneRoster design intention and reusable integration-control foundations. OneRoster capability remains not implemented.

## Prohibited claims

Do not claim OneRoster support, compatibility, conformance, certification, roster sync, grade/resource exchange, production readiness, provider partnership, live feed or institutional acceptance.
