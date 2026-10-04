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
- **Empty means suspicious.** `examined = 0` fails the gate on purpose.
- **Counts are never the only evidence.** `row_count_only` exists so the reason
  is readable.

## 6. Recording a run in the Center

The Center's `passed` is generated from counts. Do not record raw counts.
Evaluate the semantic gate, then record `toRunCounts(kind, results, gate,
dispositioned)` (`bridge.ts`): open failures by kind, and any structural
failure in the place that kind of run looks (`rows_failed` for validation,
`rows_differing` otherwise). Then the Center's rule and the gate cannot
disagree. Also append the run to the ledger (`check_run`, `gate_result`).

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

A no-op "mutation" was run as a control and stayed green.

What this does **not** prove: that the checks are sufficient for a real
institution's data. They have only run on synthetic fixtures. The first
institution's rehearsal is the first real test, and its seeded-defect run
(§5) is how the checks earn trust.
