# 04 Validation and reconciliation

Stages: **sample_import**, **validation**, **reconciliation**. Code:
`checks.ts`, `gate.ts`, `exceptions.ts`, `bridge.ts`.

Validation asks *did the transform produce what the spec says*. Reconciliation
asks *does the target equal the source in everything that matters*. Both use
the same checks; reconciliation runs them against the live target and adds the
recomputed outcomes.

## 1. The seven evidence classes

| Class | Question | Primitive (`checks.ts`) | Typical failure it alone finds |
| --- | --- | --- | --- |
| `count` | Do the volumes agree? | `countParity` | A whole file missing. Nothing subtler |
| `key` | Same identities, none twice, none lost? | `keyParity` | A re-run doubled 4,000 charges; two students merged |
| `semantic` | Same field, same meaning? | `valueParity` | `W` became `F`; a local code mapped to the wrong status; a time shifted an hour |
| `relationship` | Does every reference land on the *right* thing? | `referentialIntegrity` | A result attached to the right course in the wrong term; an orphaned prerequisite |
| `history` | Did the past arrive? | `historyPreserved`, `temporalContinuity` | Every grade change restamped "migration"; a hold's end date lost |
| `permission` | Same people can do the same things, nobody gains? | `permissionParity` | A guardian reads what they could not; an advisor lost access on day one |
| `outcome` | Does a recomputed business result equal the one the institution relies on? | `aggregateParity`, `outcomeParity` | GPA, balance, degree eligibility differ while every row matches |

Rules for writing a check:

- It compares **both sides**, from extracts, never from a connection, so it runs
  identically in a rehearsal, the parallel run and a test.
- It returns **opaque references** (`integration/redact.ts` `redactReference`,
  salted per tenant), never ids or values.
- **Outcomes are recomputed, not copied.** If Semester stored the number the
  source produced, matching it proves nothing about the inputs. Recompute GPA
  from migrated results, a balance from migrated transactions, eligibility from
  migrated requirements, and compare to the figure the institution certifies.
- Money is integer minor units, tolerance zero unless the institution
  documents why.
- A check that examines nothing is a broken probe (below).

## 2. The gate

`evaluateGate(domain, results, thresholds, dispositioned)` (`gate.ts`). A
domain passes only if **all** hold:

1. Every evidence class has at least one check that **examined something**.
   Otherwise `missing_evidence_class`; if only counts, `row_count_only`.
2. No check has `examined = 0` (`vacuous_check`). An empty extract makes every
   comparison trivially true; the first thing to suspect is the probe.
3. No open **critical** failure. Zero tolerance, no waiver.
4. For `high`, `medium`, `low`: the **open** failure rate is within threshold.

| Severity | Meaning | Default max open failure rate |
| --- | --- | --- |
| critical | Wrong data a person will act on, or access that should not exist | 0, and never waivable |
| high | Wrong, and noticed by someone within a term | 0.1% |
| medium | Wrong but cosmetic or recoverable | 1% |
| low | Noted | 5% |

`DEFAULT_THRESHOLDS` is a **floor**. `tighten()` lets a domain or institution
ask for stricter and throws on anything looser. These numbers are defaults to
be argued with the first institution, not findings.

*Open* means not dispositioned: `dispositioned()` (`exceptions.ts`) returns the
failures that are verified-fixed, descoped, or waived with an unexpired waiver.
The gate and the queue read the same set, so they cannot disagree about what is
still open.

Thresholds say whether a **rehearsal is converging**. The recorded validation
and reconciliation that go to the Center require **zero open** failures
(`bridge.ts`), each exception that remains being dispositioned by name. This is
deliberate: "99.9% correct" is a number about rehearsals, not a state a
registrar signs for.

## 3. Exception queue

Every failure becomes a row (`raise`) keyed by check + opaque ref + code, so
re-running a check never duplicates it.

```
open → triaged → resolved → verified → closed
              ↘ waived        (not critical; approver ≠ raiser, ≠ owner; reason; expires)
              ↘ out_of_scope  (approver ≠ raiser, ≠ owner; reason)
```

| Severity | Owner within | Fix within |
| --- | --- | --- |
| critical | 4 h | 24 h |
| high | 24 h | 72 h |
| medium | 72 h | 7 days |
| low | 7 days | 14 days |

- **Resolved is a claim; verified is a fact.** Only a later run of the same
  check that no longer fails, named by its ledger evidence id and by someone
  other than the owner, moves a row to verified. A fix that does not hold
  reopens it (`verify(..., stillFailing = true)`).
- **A critical failure cannot be waived by anyone.** It is fixed or the
  migration waits.
- **A waiver expires.** After expiry the gate counts the failure as open again.
- **Nothing is deleted.** Each row carries its own history; the ledger carries
  each transition ([06 §4](06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

Routing by code: `access_widened` → privacy officer and security today;
`access_narrowed` → the domain approver the same day (someone is locked out);
`history_rewritten`/`history_truncated` → data steward, usually a transform
defect; `outcome_differs` → registrar or bursar, usually a rule the transform
did not carry.

## 4. Sampling

Use full population for `key`, `relationship`, `permission` and the financial
`outcome` checks: they are cheap and a sample misses the one student who
matters. Sample only where a human or a rendering is needed (document retrieval,
rendered guardian views, course render), **stratified** across term, program,
section type, role, and always including: every graduating student; every
student with a hold, accommodation, appeal or revoked release; every account
with an adjustment, refund or payment plan; every course with a non-default
grading scheme. The sampling frame and seed go in the ledger so a reviewer can
reproduce it.

## 5. Controls on the probe itself

A clean result is a claim about the probe too.

- **Seeded defects.** Before trusting a run, inject known defects into a copy
  of the target (swap two results, restamp a history row, widen one grant,
  shift one amount by a cent) and confirm each is found. A probe that cannot
  find a defect it was handed has told you nothing.
- **Mirror run.** Run each check with source and target swapped; asymmetric
  findings (found one way, not the other) point at a probe bug.
- **Automated, on the institution's own data.** For every check the engine
  runs, `proveProbes` injects a defect of that check's own kind into a copy of
  the real extract (a row dropped, a grade moved to another student under a
  perfectly valid key, an amount shifted, a grant added, a sibling order swapped)
  and requires the check to find strictly more than before. `validate` hands the
  gate every check that did not (`unproven_check`), so a check nobody has seen
  fail is never taken as a pass. A check with nothing to inject into is `vacuous`
  or `unmutable`, which is the same conclusion reached from the other side.
- **Empty means suspicious.** `examined = 0` fails the gate on purpose. The
  institution may attest in writing that a population is legitimately empty (no
  waitlists this term); that lifts the vacuity refusal for that check only and
  never the need for the evidence class.
- **Counts are never the only evidence.** `row_count_only` exists so the reason
  is readable.

## 6. Recording a run in the Center

The Center's `passed` is generated from counts. Do not record raw counts.
Evaluate the semantic gate, then record `toRunCounts(kind, results, gate,
dispositioned)` (`bridge.ts`): open failures by kind, and any structural
failure in the place that kind of run looks (`rows_failed` for validation,
`rows_differing` otherwise). Then the Center's rule and the gate cannot
disagree. Also append the run to the ledger (`check_run`, `gate_result`).

For a validation, an open failing case is **also** a failed row, because
`rows_failed` is all the Center reads for that kind. This was missing: a
validation with an open critical failure was recorded as one the Center passes,
found when the engine's results were first run through this bridge
(`bridge.test.ts`).

## 7. How the tooling itself was proved

Per this repository's standard, each guard was reverted under its test and the
test watched go red, then restored. Mutations and the test that caught each:

| Reverted | Red |
| --- | --- |
| No evidence-class requirement in the gate | `gate.test.ts`, `bridge.test.ts` |
| Empty check allowed to pass | `gate.test.ts` |
| Critical failure tolerated | `gate.test.ts` |
| Threshold loosening allowed | `gate.test.ts` |
| Critical exception waivable | `exceptions.test.ts` |
| Owner may verify their own fix | `exceptions.test.ts` |
| Waiver never expires | `exceptions.test.ts` |
| Ledger link check removed | `evidence.test.ts` |
| Stale sign-off accepted | `signoff.test.ts` |
| Preparer may sign | `signoff.test.ts` |
| Unexercised rollback accepted | `rehearsal.test.ts` |
| Missing observation read as healthy | `rehearsal.test.ts` |
| Slash date defaults to month-first | `mapping.test.ts` |
| Structural gate reasons not written to counts | `bridge.test.ts` |
| Structural reasons not routed to `rows_differing` for reconciliation | `bridge.test.ts` |
| Open failures not counted as failed rows for a validation | `bridge.test.ts`, `adapter.test.ts` |
| Unproven check not held by the gate | `gate.test.ts`, `adapter.test.ts` |
| Attested-empty exemption widened or removed | `gate.test.ts`, `adapter.test.ts` |
| Defect the migration introduced waivable or descopable | `exceptions.test.ts` |
| Verified or closed exception not reopened when found again | `exceptions.test.ts` |
| An exception verified by a run that did not run its check | `exceptions.test.ts` |
| Rollback triggers loosened or dropped | `rehearsal.test.ts` |
| Archive before the window, or with an unchecked legal hold | `rehearsal.test.ts` |
| A check claiming an evidence class it did not examine | `adapter.test.ts` |
| An attestation covering only one result of a two-result check | `adapter.test.ts` |
| Wrong-parent link check removed | `engine.test.ts`, `adapter.test.ts` |
| Parallel-run explanation without a name or reason; default tolerance | `observations.test.ts` |
| Independent-read attestation or retention date not required | `institution-migration.test.ts` |

A no-op "mutation" was run as a control and stayed green.

Every guard in this table was reverted and watched go red; the controls were
run again after the engine was merged in (21 further mutations, all red). The
first of those, for the validation bridge, was a real defect and is now fixed.

What this does **not** prove: that the checks are sufficient for a real
institution's data. They have only run on synthetic fixtures. The first
institution's rehearsal is the first real test, and its seeded-defect run
(§5) is how the checks earn trust.

## 8. Running the checks against extracts

`checks.ts` holds primitives over rows a caller has already assembled, and the
workbooks say which checks each kind of data needs. Nothing connected the two to
actual files. `engine.ts` does: each domain is declared once (`domain-specs.ts`:
entities, keys, field classes, what stays behind, and the checks) and the engine
executes those checks against `source.json`, `target.json` and `crosswalk.json`.
`adapter.ts` turns what it finds into the `CheckResult`s the gate already reads,
so there is one gate, one exception queue, one ledger and one Center bridge.

| Kind of check | Asks | Evidence class |
| --- | --- | --- |
| `crosswalk` | Every source row maps to exactly one target; none merge; none appear from nowhere | `key` |
| `unique` | No duplicate natural key | `key` |
| `reference` | Every foreign key resolves, and none that resolved before are orphaned | `relationship` |
| `preserved` | Field values mean the same; **links still point at the same parent** through the crosswalk | `semantic`, and `relationship` for links |
| `derived` | A sum or weighted mean recomputed from rows on both sides agrees, and with the stated figure | `outcome` |
| `history` | Every event, in order, with the same values; the current value is the last | `history` |
| `permission` | Nobody gains access; every grant has an active consent; lost access is reported | `permission` |
| `order` | Sibling order preserved | `relationship` |
| `bounded` | Members per group within capacity and equal to the source | `outcome` |
| `temporal` | Start not after end | `semantic` |

**Introduced or inherited.** A finding says whose it is. `migration`: the
target is wrong and the source was right; only a fix in the mapping resolves it
and nobody may waive or descope it. `source`: the source already had it (a
stated GPA that disagrees with the student's own results, a guardian grant with no
consent), so the institution decides. Both hold the gate until dispositioned.
Mixing them is how a clean migration gets blamed for a dirty registrar and a dirty
one hides behind it.

**A valid key to the wrong parent.** `reference` cannot see a grade moved to
another student, because the key is valid. `preserved` checks links through the
crosswalk and does.

**What the engine cannot derive.** Counts and the five classes above are
covered for every domain; six domains (academic records, learning content,
enrollments, finance, family, campus services) are fully covered, so the gate can
pass them on executable evidence alone. Identity, courses, career and documents
still need an `outcome` the extracts cannot supply (a sample of real sign-ins, a
seat count at the same instant, a retrieval test). These arrive as
`<domain>/external-checks.json` (`CheckResult`s, produced with the primitives in
`checks.ts`) and the gate refuses the domain until they do. Each workbook page
states, for its domain, what the engine covers and what is left.
`adapter.test.ts` pins the set.

**Running it.**

```bash
cd app
node scripts/institution-migration.ts init <dir> --tenant T --wave W --domains identity,academic_records --retain-until 2036-01-01 --actor NAME
# put source.json, target.json and crosswalk.json under <dir>/<domain>/ (entity → rows; entity → sourceKey → targetKey)
node scripts/institution-migration.ts validate <dir> academic_records --actor NAME --independent-source-read
node scripts/institution-migration.ts queue <dir>
node scripts/institution-migration.ts exception <dir> <key-prefix> triage --owner NAME --actor NAME
node scripts/institution-migration.ts sign <dir> mapping_approved identity it --actor NAME --decision approve
node scripts/institution-migration.ts signoffs <dir> mapping_approved identity
node scripts/institution-migration.ts plan plan.json
node scripts/institution-migration.ts verify <dir>
```

`validate` refuses without `--independent-source-read`, an attestation that the
source side was read by a path other than the transform; a validation that
shares the transform's read cannot catch the transform's mistakes. It also
prints the counts to record in the Migration Center, from `bridge.ts`. The
optional files beside the extracts are `excluded.json` (each row left out, with a
reason of at least 20 characters), `merges.json` (target keys the institution
approved collapsing several people into) and `attest.json` (checks attested
empty). `--retain-until` comes from the institution's records schedule and every
ledger entry carries it; nothing is defaulted.

The tool never connects to a source system and never writes to production.
