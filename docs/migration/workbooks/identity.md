<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Identity

**Done means:** Every person who can sign in today can sign in as themselves, to the same things, and nobody else can.

**Institution approver:** `it` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| person | institutional person id (not email, not name) | summary | restricted |
| account / credential link | identity-provider subject + person id | summary | restricted |
| role and group membership | person + group + effective dates | full | confidential |
| alias (former name, former email) | person + alias + valid-from | full | restricted |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `identity.count.persons` | count | low | `countParity` | Persons by type (student, faculty, staff, alumnus, guest) against the source after declared exclusions |
| `identity.key.person_crosswalk` | key | critical | `keyParity` | Every source person has exactly one Semester person; none without a source; no two people merged |
| `identity.semantic.name_and_status` | semantic | high | `valueParity` | Legal name, preferred name, status code and privacy flags after the code table, including FERPA-style directory suppression |
| `identity.relationship.membership_targets` | relationship | high | `referentialIntegrity` | Every role and group membership lands on a real person and a real group, and the right one |
| `identity.history.role_timeline` | history | high | `temporalContinuity` | Role and status timelines keep their overlaps and gaps (a person who was student then staff is not both, and not neither) |
| `identity.history.aliases` | history | medium | `historyPreserved` | Former names and emails keep their original dates so old records still resolve to the person |
| `identity.permission.effective_roles` | permission | critical | `permissionParity` | Effective roles after group mapping equal the source's; no person gains administrator or advisor reach |
| `identity.outcome.sign_in_resolution` | outcome | critical | `outcomeParity` | A sample of real sign-ins (SSO assertion in, person out) resolves to the same person the legacy system resolved |

## What a count will not show

- Email is reused: a graduate's address is reissued to a new student, and matching on it merges two people.
- A person with two source ids (admissions id, then student id) becomes two people, each with half a transcript.
- Suppression flags are optional fields in the source; a dropped flag publishes a student who had opted out.
- Group-to-role mapping is the largest silent escalation path; a broad "staff" group mapped to a role with advisor reach.

## Business outcomes to recompute, not copy

- Sign-in resolves to the same person
- Effective role set per person
- Directory visibility per person

## Calendar events the parallel run must include

- `term_start_sign_in_peak`
- `role_change_batch`
