<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Family and guardian relationships

**Done means:** Each guardian or authorised contact can see exactly what the student and the institution's policy have consented to, and nothing more, on the first day.

**Institution approver:** `data_owner` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| relationship (guardian, parent, authorised payer, emergency contact) | student + related person + type | full | restricted |
| consent and release (what may be shared, with whom, until when) | student + related person + scope + dates | full | restricted |
| contact method | person + method + verified-at | summary | restricted |
| age and majority status | person + effective date | full | restricted |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `family.count.relationships` | count | low | `countParity` | Relationships by type |
| `family.key.relationships` | key | high | `keyParity` | Each (student, related person, type) once; a guardian shared by siblings is one person |
| `family.semantic.scope_and_dates` | semantic | critical | `valueParity` | Consent scope, start and expiry, revocation, and whether the release was given by the student or an authorised proxy |
| `family.relationship.targets` | relationship | critical | `referentialIntegrity` | Every relationship joins two real people, in the right direction |
| `family.history.consent_trail` | history | critical | `historyPreserved` | Consent grants and revocations keep original time and actor; a revocation is never dropped |
| `family.history.access_windows` | history | high | `temporalContinuity` | Release windows keep their shape; none silently extended or left open-ended |
| `family.permission.guardian_visibility` | permission | critical | `permissionParity` | For every guardian: the set of things visible equals the consented set. Widening is a stop-the-line failure |
| `family.outcome.visible_to_guardian` | outcome | critical | `outcomeParity` | For sampled guardians (and every one with a revoked or expired release) the rendered view equals the permitted view |

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **high** (no major defect tolerated; minor at 0.5%).

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `family.relationship.crosswalk` | crosswalk | critical | Every guardian_relationship maps to exactly one target guardian_relationship; no two collapse into one; nothing appears from nowhere. |
| `family.relationship.preserved` | preserved | critical | guardian_relationship: relationship, status mean the same thing after the move. |
| `family.consent.crosswalk` | crosswalk | critical | Every consent_record maps to exactly one target consent_record; no two collapse into one; nothing appears from nowhere. |
| `family.consent.preserved` | preserved | critical | consent_record: scope, basis, active mean the same thing after the move. |
| `family.consent.dates` | preserved | critical | consent_record: granted_on, revoked_on mean the same thing after the move (compared as date). |
| `family.consent.window` | temporal | high | consent_record.granted_on is not after consent_record.revoked_on. |
| `family.consent.student` | reference | critical | Every consent_record.student_id points at a real student_record, and none that were fine in the source are orphaned. |
| `family.event.crosswalk` | crosswalk | critical | Every consent_event maps to exactly one target consent_event; no two collapse into one; nothing appears from nowhere. |
| `family.event.history` | history | critical | consent_event: every event of each consent_record, in order, with the same values. |
| `family.student.consented` | derived | critical | family.student.consented: the sum of consent_record.scope_level per student_record, recomputed from rows on both sides, agrees within 0. |
| `family.proxy.crosswalk` | crosswalk | critical | Every proxy_access maps to exactly one target proxy_access; no two collapse into one; nothing appears from nowhere. |
| `family.proxy.access` | permission | critical | proxy_access: nobody gains access they did not have; every grant has an active consent_record record; lost access is reported. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`, `outcome`.
**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| court orders and custody documents | T4 | Not migrated as data. Held by the registrar as documents under counsel's direction; any restriction they impose is entered as an explicit block by a person. |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |
| health and counseling records | T4 | Not migrated. Remains with the health and counseling service under its own rules. |

## Scope approvals

No field here is refused or needs a named approval.

## What a count will not show

- Legacy portals gave parents blanket access; migrating that as "consent" creates consent nobody gave.
- A student who has reached majority keeps a minor's release record that no longer applies.
- Custody and court orders are free text in notes; the restriction is lost with the notes.
- What counts as valid consent or a valid proxy, by jurisdiction and policy, is a legal question for qualified counsel.

## Business outcomes to recompute, not copy

- Visible set per guardian
- Revoked-access set stays empty
- Notification recipients per student

## Calendar events the parallel run must include

- `term_start`
- `consent_revocation_batch`
