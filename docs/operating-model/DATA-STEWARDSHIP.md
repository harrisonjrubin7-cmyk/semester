# Data stewardship and the data contract registry

Technical governance already exists: T0–T6 classification, RLS as the authorization boundary, and connection and scope
approval. What it lacks is people. "Source of truth" stays a slogan until someone can answer, for a given field, who
decides what it means and who fixes it. They also need to say how fresh it has to be and what breaks downstream when
it isn't. This document gives Semester a defensible answer when a university asks: *who owns this data, and what
happens when it is wrong?*

Registry: [`app/src/lib/governance/data-contracts.ts`](../../app/src/lib/governance/data-contracts.ts). Its test fails
for a connector flag without a contract, for a contract naming a connector that doesn't exist, and for a contract over
data Semester may not store at all (T4+).

## Stewardship roles

| Role | Accountability | Who, typically |
| --- | --- | --- |
| Data owner | Accountable for a domain's meaning and approved use | Registrar, director of advising, bursar |
| Data steward | Maintains quality, definitions, freshness and corrections | Office data lead |
| System owner | Operates the source system | Campus IT |
| Integration owner | Owns mapping and sync health | Campus integration lead, with Semester integrations |
| Privacy owner | Sets use, retention and privacy boundary | Campus privacy officer |
| Security owner | Controls technical access and incident response | CISO's office |
| Metric owner | Defines calculation and reporting use | Institutional research |
| Content owner | Maintains student-facing text and resources | Each service office |

**Go-live rule:** a tenant's connection is not ready until a **named person**, not a department inbox, holds the data
owner, data steward, integration owner and privacy owner roles for that contract. `readiness()` reports every missing
role. This is the human gap the code can't close, and the registry says so openly.

The people themselves are rows in `governance_steward_assignments`: one live holder per school, connector and role,
named rather than an address or a placeholder (the table refuses `TBD` and anything with an `@`). An assignment is
revoked and replaced, never edited into someone else, so the record shows who held a role and when.

## What every contract states

Definition · owner and steward · source system · field definitions · classification · allowed uses · authorized roles ·
freshness SLA · quality checks · mapping version · known limitations · correction process · downstream dependencies ·
retention/deletion policy.

## Registered contracts

| Domain | Connector | Class | Freshness SLA | Owner role |
| --- | --- | --- | --- | --- |
| Enrollment and schedule | `integration.sis_read` | T3 | 24 h | University Registrar |
| Assignment dates | `integration.lms_lti` | T1 | 6 h | Instructor of record |
| Degree audit status | `integration.degree_audit_read` | T3 | 72 h | University Registrar |
| Advising appointments | `integration.advising_crm` | T3 | 12 h | Director of Advising |
| Career opportunities | `integration.career` | T0 | 24 h | Director of Career Services |
| Campus services | `integration.campus_services` | T0 | 24 h | Dean of Students (per office) |
| Bursar and aid actions | `integration.erp_bursar_actions` | T3 | 24 h | Bursar and Director of Financial Aid |

The full field lists, quality checks, known limitations and correction processes are in the registry. They are not
repeated here, because a copy is what drifts.

## The correction loop

Semester **never edits an institutional fact**. When a student flags one as wrong:

```text
Student flags row (in the card)
→ routed to the domain's data steward, with the source record reference and freshness
→ steward corrects in the source system
→ next sync overwrites; the stale label stays until it does
→ steward closes the flag; the student sees "corrected at source"
```

The **integration-quality review** each term (see [RESEARCH-AND-SERVICE-DESIGN.md](RESEARCH-AND-SERVICE-DESIGN.md))
covers flags opened, time to correction, freshness-SLA misses and mapping-version changes for each contract.

## Data classification matrix

The platform floor lives in `app/src/lib/integration/classification.ts` and is seeded into the database. Tenants may
only be stricter.

| Tier | Examples | Storage | AI | Extensions | Export |
| --- | --- | --- | --- | --- | --- |
| T0 Public | Public catalog, public events | Standard tenant store | Policy-permitted | Approved | Permitted |
| T1 Course-authorized | Non-sensitive slides, rubric | Tenant store + permissions | Approved per course | Scoped | Course policy |
| T2 Student-owned | Notes, drafts, plan, portfolio | Private by default | Student/course policy | Consent required | Student export |
| T3 Education records | Enrollment, grades, advising | Minimum necessary, encrypted, audited | Approved institutional environment only | No general extensions | Governed |
| T4 Regulated/sensitive | Health, disability, counseling, conduct, aid | Blocked by default | No general AI | None | Strict legal route |
| T5 Restricted research/IP | Unpublished research, export-controlled | Blocked by default | No general AI | Approved secure route only | Restricted |
| T6 Highly restricted | Classified/controlled | No general processing | No AI | None | No export |
