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

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **high** (no major defect tolerated; minor at 0.5%).

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `identity.person.crosswalk` | crosswalk | critical | Every person maps to exactly one target person; no two collapse into one; nothing appears from nowhere. |
| `identity.person.preserved` | preserved | critical | person: legal_name, preferred_name, email, date_of_birth, status, affiliation mean the same thing after the move. |
| `identity.person.suppression` | preserved | critical | person: directory_suppressed mean the same thing after the move. |
| `identity.person.email_unique` | unique | critical | No two person rows repeat (email). |
| `identity.external_identity.crosswalk` | crosswalk | high | Every external_identity maps to exactly one target external_identity; no two collapse into one; nothing appears from nowhere. |
| `identity.external_identity.unique` | unique | critical | No two external_identity rows repeat (idp, subject). |
| `identity.external_identity.reference` | reference | critical | Every external_identity.person_id points at a real person, and none that were fine in the source are orphaned. |
| `identity.external_identity.binding` | preserved | critical | external_identity:  mean the same thing after the move. |
| `identity.alias.crosswalk` | crosswalk | high | Every person_alias maps to exactly one target person_alias; no two collapse into one; nothing appears from nowhere. |
| `identity.alias.history` | history | high | person_alias: every event of each person, in order, with the same values. |
| `identity.role_grant.crosswalk` | crosswalk | high | Every role_grant maps to exactly one target role_grant; no two collapse into one; nothing appears from nowhere. |
| `identity.role_grant.access` | permission | critical | role_grant: nobody gains access they did not have; lost access is reported. |
| `identity.role_grant.expiry` | preserved | high | role_grant: expires_on mean the same thing after the move (compared as date). |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`.
**Still needs results from outside the two extracts:** `outcome`, supplied as `external-checks.json` (see the workbook checks above for what to run). The gate refuses the domain until they arrive.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| government identifiers | T4 | Never migrated (national ID, SSN, passport). Semester keys on person_id and the institutional email. |
| authentication secrets | T6 | Never exported or imported (password hashes, MFA seeds). People sign in again through the institution identity provider. |
| immigration status | T4 | Not migrated. Remains with the international office. |

## Scope approvals

No field here is refused or needs a named approval.

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
