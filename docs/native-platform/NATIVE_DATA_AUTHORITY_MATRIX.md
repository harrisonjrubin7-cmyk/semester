# Native data authority matrix

**As of** 2026-10-05 · **Project** `lzrqvlugnawcgywkhqlz` · **Rule** from [`docs/master/SEMESTER_DATA_AUTHORITY_MATRIX.md`](../master/SEMESTER_DATA_AUTHORITY_MATRIX.md)

> A fact has exactly one authoritative holder per tenant per domain. Every surface says who, and says how fresh. A native Semester record becomes authoritative for an institution's data only by passing the replacement gates and a signed change record.

No domain is authoritative for an institution's data. Class totals from the master matrix, unchanged by this pass: **S 15, X 18, S+X 2, C 5.** Replacement register: **0 of 14**.

## Classes

| Class | Meaning |
| --- | --- |
| S | Semester holds data it owns: student content, its consent, its audit, its tenant config, its own subscriptions |
| X | An external system is the record. Semester reads, plans, labels, and hands off |
| S+X | Student-owned part in Semester; official part outside |
| C | Company-internal. No student record |

## Eight kinds a screen must not blur

| Kind | Holder | Example |
| --- | --- | --- |
| Official record | Institution | Grade, transcript, enrolment, balance |
| Guidance | Institution or faculty | Policy, course guidance |
| Recommendation | Semester, explained | Next action on Today |
| Student-owned | Student | Note, plan, draft |
| Institutional content | Institution | A syllabus the institution published |
| External source | Third party | Calendar feed |
| AI output | Never official | Summary, draft, study plan |
| Community | Authors, moderated | Post |

Source states already in `app/src/lib/source.ts`: Institution verified, Imported, Student entered, Estimated, Needs review, Stale, Unavailable.

## PDF facts

| Fact | Class | Holder today | Native target | Becomes authoritative only when |
| --- | --- | --- | --- | --- |
| Today plan, tasks, notes | S+X | Device, optional sync | Semester for the student's own items | Not a replacement. Official items stay labelled |
| Calendar feed | X | Feed owner | Semester copy with freshness | Never replaces the calendar system by import |
| Degree plan | X | SIS degree audit, unconnected | Planning copy | Catalog and rules signed; registrar parity |
| Course shell, roster, submissions | X | LMS | Course Studio only after a course moves | Faculty sign-off, gradebook parity, a11y, retention, rollback |
| Grade, moderation, release | X | LMS gradebook | Ledger candidate | Term dual-run, registrar, immutable history |
| Enrolment, hold, time ticket | X | SIS | Registration RPCs are a candidate | Window rehearsal, hold sync, two terms reconciled |
| Academic record | X | SIS | `academic_record_*` | All replaceability gates, legal review, no transcript claim before that |
| Student balance, plan, refund | X | Bursar and payment provider | Ledger tables | Auditor, provider contract, term reconciliation. No raw PANs |
| Aid decision | X | Aid office | Handoff only | Counsel and the aid office |
| Dining balance / order | X | Dining partner | `dining_*` | Partner contract |
| Housing assignment | X | Housing system | Handoff | Institution |
| Community post | S | Semester | Semester | Not a replacement. Still unsafe to activate |
| Skill claim | S+X | Student | Student-owned, never "institution verified" by default | Institution verification is a separate signed act |
| Family grant | S | Semester | Consent ledger | Privacy review, not a SIS replacement |
| Membership, role grant | X for identity, S for the grant | IdP, then `role_grants` | Semester grants | IdP is not replaced |
| Integration row | S for the connection, X for the payload | Source system | Mapping and sync tables | Connector does not confer authority |
| AI completion | Never S | Provider subprocess | Audit and usage in Semester | Never |
| Audit event | S | Semester | `audit_event` | Company evidence, not a student transcript |
| Commercial subscription | S | Semester, flag-gated | Individual Plus test path | Not institutional billing |
| Company finance | C | Placeholder model | Docs | A real ledger is an accounting system of record, not this schema |

## Node metadata the PDF requires

The education graph lists person, institution, course, enrolment, grade, consent, policy, audit, outcome, and others. Each node is supposed to carry canonical id, tenant, owner, authority, source, freshness, classification, consent, capability, policy, version, audit, retention, export, deletion, migration source, verification.

| Metadata | Where it lives now | Gap |
| --- | --- | --- |
| Id and tenant | Primary keys; `school_id` / account id where the migration added them | F-01: tenant isolation off for schools |
| Authority and source | `lib/source.ts` labels; integration precedence doc | Not a column on every table |
| Freshness | `source_freshness_events` named on the D01 card | Not on every read model |
| Classification | `docs/trust/DATA-CLASSIFICATION-STANDARD.md` T0–T6 | Rule-derived, not human-reviewed per table |
| Consent | Family, advisor, support, notification grants | Not a universal predicate in front of AI tools |
| Retention, hold, export, erase | Legal-hold migrations, `export_my_data`, erasure sweeps | Holds must keep winning. Human privacy review open |
| Version / audit | `audit_event`, ledger chains | F-10 tamper-evidence open |
| Verification | Per workflow | Almost none staffed |

Do not create a parallel graph database to hold these. Add the missing fields to the owning table when a domain is actually built.

## Live data, so authority is not inferred from schema

Planner estimates (`n_live_tup`), public schema, this project:

- 42 of 321 tables look nonempty. Estimated sum about 600 rows.
- Largest prefixes: `role` and `app` (the role and capability seed).
- Smaller estimates sit on commercial catalog, community seed, institution, entitlements, a handful of enrollment/subscription/payment/invoice/profile/audit rows.
- Prefixes for registration, grade, gradebook, academic record, dining, family, migration, and scim do not appear in the nonempty list.

Those estimates can lag. They are enough to reject the reading "the tables are full, so the institution is live." They are not enough to publish a customer count. This document does not.

## Cutover sequence (unchanged)

1. Read-only connect. Label source and freshness.
2. Import with lineage. Reconcile until exceptions are explained.
3. Shadow-write in a sandbox.
4. Dual-run one unit. External system still authoritative.
5. Institution signs. Two people approve. Effective date.
6. Cut over. External system stays readable for rollback.
7. Rehearse rollback before step 5 and again after.

Skipping to step 6 because a screen exists is the failure this folder exists to prevent.
