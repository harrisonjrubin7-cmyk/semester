# Review — Housing, Dining & Tuition Specification (uploaded package)

Filed here unchanged. Its 15 pure reference tests passed when you ran them; nothing here was re-run (no Python). All 32 acceptance tests are `UNBOUND · NOT RUN` in the package, and that stays true: nothing below is evidence they pass.

## Agreement with what's already built

| Rule | Package (`reference/campus_reference.py`) | Built here | Same? |
|---|---|---|---|
| Title IV credit-balance deadline | `max(created, classes_start) + 14 days` | `cs_title_iv_due()` — created on/after the first day → created + 14, else first day + 14 | Yes |
| Hold-authorization cancellation | received + 14 | notice of cancellation + 14 | Yes |
| Rollover preview | transfer = min(available, cap) if eligible; reserved units stay pending | prototype: pending order keeps reserved units on the source lot | Yes |
| Roommate similarity | missing or null fields skipped; no compared fields → score `None` | prototype: undisclosed = unknown, not a mismatch | Yes |
| Overlapping periods | half-open `a_start < b_end and b_start < a_end`; invalid period raises | `tstzrange` default `[)`; GiST exclusion `&&` | Yes |

## Acceptance tests → database checks (`../campus_services.check.sql`)

These are **database-level only**; the package's tests also need the API, UI and provider layers.

| Test | Covered by a check | Gap |
|---|---|---|
| AT001 race final bed | exclusion: second occupant refused | Real concurrency still needs two sessions |
| AT002 retry same key / different payload | redemption retry + changed-quantity refusal | Not yet for bed selection |
| AT003 alter group after preview | group version mismatch refused | — |
| AT004 reservation + uncertain payment | kept while deposit outcome unknown, released once failed | — |
| AT006 lottery seed | lottery without seed refused; published run immutable | Independent draw acceptance is a process control |
| AT008 forged acceptance | only the student can accept | Profile leakage needs an API test |
| AT012 last entitlement | can't overdraw the last meal | Concurrent sessions as AT001 |
| AT013 repeat rollover | second run for the same lot + policy version refused | — |
| AT023 duplicate webhook | duplicate provider event refused | Out-of-order needs the payment worker |
| AT026 / AT027 deadlines | three Title IV dates | — |
| AT028 rejected disbursement | can't close without delivery reference | — |

The other 21 (accommodation exposure, maintenance, POS timeout, ingredient data, tuition reassessment, pending aid labels, payer grants, R2T4, cross-tenant, audit failure, restore) need the API, a provider sandbox or a UI test. Bind them to the repo's Playwright suite and the pilot evidence register before claiming any result.

## Bound to staging (`handoff/live-integration/e2e/campus-acceptance.spec.ts.txt`)

Through the new `live-campus-command` edge function (bed, group, redeem; students act only for themselves, staff recorded as actor):
**AT001** real two-session race · **AT002** same key → same assignment, changed bed → 409 (new `cs_select_bed_once`) · **AT003** group version · **AT008** acting for another student → 403 · **AT012** concurrent last meal · **AT030** cross-tenant grant and entitlement id. Status stays **NOT RUN** until you run it against staging and record the run link.

## Next
1. Run the check file on a branch database (`supabase db reset` then the harness).
2. For each acceptance test, record the runner, fixture, run link and approver in the evidence register — the package's `evidence` column lists exactly what's required.
