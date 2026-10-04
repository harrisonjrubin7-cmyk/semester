# 03 Mapping, cleansing and transformation

Stages: **mapping**, **cleaning**, **preview**. Code: `mapping.ts` beside the
Center's `preview` (`center.ts`).

## 1. One declared rule per field

`MappingSpec` (`mapping.ts`) is the artifact a data steward approves
(`mapping_approved` gate). For every source field exactly one of:

- a **rule**: source → target, with cleansing steps, `required`, optional
  **code table**;
- a **declared drop**: the field was looked at and not brought, with a reason.

A source field in neither is an issue (`unmapped_source_field`) **on every
row**. This is how a field the mapping never mentions stops disappearing
without anyone deciding it should.

Every output value gets a lineage line: target, source, steps applied,
mapping version. Bump `version` whenever any rule changes; the version is in
the evidence.

## 2. Rules that have no default

| Situation | Behaviour | Why |
| --- | --- | --- |
| Code not in the code table | Issue `unknown_code`; no value written | A default grade, status or role is a silent decision |
| `a/b/yyyy` date | Read only if the spec says `month_first` or `day_first`; else `bad_date` | `03/04/2025` is two different days. The Center's `date_iso` now behaves the same way: it refuses an ambiguous slash date until the order is chosen ([README findings](README.md#findings-while-building-this)) |
| Impossible date (`2025-02-30`) | `bad_date` | Never normalised |
| Money | Integer minor units, or `bad_amount`. More than two decimals is an error, never rounded | A float or a rounded cent is a ledger difference nobody can explain |
| Empty required field | `missing_required` | Not defaulted |
| Null tokens (`N/A`, `-`, …) | Treated as no value only if the spec lists them (defaults provided) | "NONE" can be a surname |

## 3. Cleansing

Cleansing changes representation, not meaning: trim, collapse whitespace,
Unicode NFC, case, null tokens, date and money normalisation. Anything that
changes meaning (merging two people, inferring a missing term, repairing a
grade) is **not cleansing**; it is a correction, made in the source by the
data steward or recorded as an exception with an approver.

- **Duplicates.** The Center's rule (`reject` / `keep_first` / `keep_last`) is
  per file. Across systems, use `integration/duplicates.ts`: natural-key
  candidates, a suggestion, a person decides, a merge records its exact
  before-state and reverses. Never merge on email or name; never merge two
  people because their records look alike.
- **Corrections are evidence.** Each is a ledger entry with who approved it.
- **Baseline first.** Run the checks on the *source alone* (key uniqueness,
  referential integrity inside the source, orphaned rows) before mapping. A
  defect that is already in the legacy system is queued as such, so it is not
  attributed to the migration or silently inherited.

## 4. Transformation

Pure, deterministic, repeatable: the same extract and the same spec produce the
same target and the same lineage. Rehearsals re-run the whole transform and
compare; a transform that is not repeatable cannot be rehearsed.

- **Idempotent load.** Every target row carries its source key and the
  mapping version. Re-running a load updates, never doubles
  (`keyParity` catches `duplicated_in_target`).
- **Crosswalk.** A table from source key to Semester id is a first-class
  output, kept for the life of the migration. It is how every later check knows
  which row is which. It is student data; treat it as such.
- **Time.** Every timestamp keeps its original instant and records the zone it
  was read in. The migration host's zone is never used.
- **No re-derivation of history.** A target field "computed" at migration
  time (last-updated, created-by) is a failure when the source had a value.

## 5. Preview

The Center's preview runs the mapping over a sample and lists issues by row.
Review it with the data steward: every distinct issue code, with counts and a
decision (fix in source, change the rule, descope, accept). A preview with
issues the team has not decided on does not leave this stage.

## 6. Scope: what may move at all

A mapping decides *how* a field moves. Whether it may move is decided first, by
rules that are not the institution's to loosen (`scope.ts`, reusing
`integration/classification.ts` and `integration/catalog.ts`; each domain's
declaration is in `domain-specs.ts`):

- **Never migrated: T4 and above.** Accommodations, health and counseling,
  conduct, government identifiers, immigration status, card and bank data,
  authentication secrets. The platform floor sends these to no destination, so a
  migration cannot be the way they get in. Every domain lists what stays behind
  and what happens instead (the owning office keeps it; a hold moves as a code
  and dates with no reason). An omission nobody wrote down looks, in a year, like
  a loss.
- **Needs a named approval: fields the platform never ingests by default.**
  Grades, GPA, submissions, aid, balances, instructor notes. Moving a transcript
  is the point of a migration, which is exactly why it is never implicit: each
  such entity needs `scope.migration.<domain>.<entity>` from the records owner and
  the privacy lead before the mapping is approved. `scopeProblems(domain,
  approvals)` lists what is open; each workbook page lists what its domain needs
  and what is refused, and the mapping sheet written by `init` shows, field by
  field, whether it is in scope, needs an approval, or is blocked.
- A school may be stricter than the floor, never looser.

Whether something is an education record, and whether it may move for a given
institution, is for the institution and counsel. This records the answer and
enforces it; it does not decide it.

## 7. Exit criteria

- [ ] Spec covers every source field (rule or declared drop with reason)
- [ ] Code tables approved by the owning office; every observed code present
- [ ] Date order and null tokens declared
- [ ] Source-only baseline run; its defects queued
- [ ] Transform re-run produces an identical target and lineage
- [ ] `mapping_approved` signed ([06](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md))
