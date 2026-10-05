# Semester risk burn-down

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin |
| **Scale** | Likelihood and impact 1–5; score = L × I. Scores are the author's judgement on this date, not measurements. Re-scored at each quarterly risk review. |

## Relation to existing registers

`LAUNCH-RISK-REGISTER.md` (v0.2), `docs/company/RISK-REGISTER.md`,
`docs/program/RISK_REGISTER.md` and `docs/strategy/RISK-REGISTER.md` overlap.
This table is the finish-line view: each risk is tied to a gate, a burn-down
action and a closing evidence item. Reconcile the four registers into one
(action 8 in the [plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md)); until then, an id
in any of them that is not here is not dropped, only unranked.

## Open risks

| ID | Risk | L | I | Score | Gate | Burn-down action | Closes when | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | A bad merge reaches `main` and production: unprotected, 26/30 recent runs red | 5 | 4 | 20 | SDLC | protect `main` with a satisfiable rule; green the runs | API shows protection; 10 consecutive green runs | HR |
| R-02 | Cross-tenant data disclosure at a second tenant (no generic sweep; enforcement off) | 3 | 5 | 15 | Tenant isolation | TI-01/TI-04; enable enforcement on staging | sweep green in CI, seeded miss caught | HR |
| R-03 | No customer: no revenue, no outcome data | 4 | 5 | 20 | Commercial | 100-account list; 15–25 conversations; scoped offer | a signed pilot | HR |
| R-04 | Legal exposure: no counsel, draft paper, no public policy in force | 4 | 5 | 20 | Commercial | engage counsel; close queue rows by priority | counsel-reviewed paper filed | HR `H` |
| R-05 | Public claims exceed evidence (24/7, 6–8 weeks, price band, Trust wording) | 4 | 4 | 16 | Claims | withdraw or substantiate each; reconcile site to claims register | each claim cites an available row | HR |
| R-06 | A data loss that cannot be recovered: restore never done in production, PITR unverified | 2 | 5 | 10 | Backups | run `restore-drill.sh` and a PITR test | recorded recovery point and time | HR `H` |
| R-07 | An incident goes unnoticed or unanswered: no alert path, one responder, personal mailbox | 4 | 4 | 16 | Incident | alert path; non-personal address; second person | induced failure received and acted on by two people | HR `H` |
| R-08 | Key-person dependency: one person holds every seat | 5 | 4 | 20 | Operations | name a backup; written runbooks; advisor | backup has run I-1 to I-4 once | HR `H` |
| R-09 | SSRF through `fetchcal` (redirect hop requested before checked; IPv4-in-IPv6 passed the host rule) | 2 | 4 | 8 | Security | per-hop check and host-rule fix **done in code**; remaining: verify deployed, fix the dev forwarder's redirect hop, decide on a DNS-resolution check | deployed function verified and the remaining two decided | HR |
| R-10 | Browser-held provider tokens and AI keys stolen by XSS; no response headers on Pages | 2 | 4 | 8 | Security | server-side tokens; headers via a host that sets them | CSP present on deployed response | HR |
| R-11 | AI bypass: device-key routes ignore kill switch and AI-off policy | 3 | 3 | 9 | AI | refuse when policy says off | route test | HR |
| R-12 | AI quality unmeasured: no live baseline, one model red-teamed | 3 | 3 | 9 | AI | file baseline; repeat red team on change | baseline filed | HR |
| R-13 | Documentation contradicts code and is believed (60/60 verified vs 30 PARTIAL; stale registers) | 4 | 3 | 12 | Truth | reconcile four documents; add a doc-to-code test where cheap | contradictions removed | HR |
| R-14 | Pilot cannot be run: no operator or champion screens; roster import is `service_role` only | 4 | 4 | 16 | Pilot | operator spine on a synthetic tenant | P-1 dress rehearsal passes | HR |
| R-15 | Pilot cannot be measured: three analytics marks | 4 | 4 | 16 | Outcome | privacy decision, then events | events built and tested | HR |
| R-16 | Accessibility claims unsupported: no AT pass, no ACR, unpublished statement | 4 | 4 | 16 | Accessibility | recorded AT pass on the pilot path | pass filed; statement published | HR `H` |
| R-17 | Procurement stall: no SOC 2, pen test, HECVAT sent, ACR | 4 | 3 | 12 | Trust | send HECVAT Lite; commission pen test | package assembled | HR `H` |
| R-18 | Cash: opening cash and runway are placeholders; no financial actuals | 3 | 5 | 15 | Finance | record real balance and burn monthly | runway statement filed | HR `H` |
| R-19 | IP ownership unresolved (Vanderbilt determination unsent) | 3 | 5 | 15 | Legal | send the request; record the answer | determination letter filed | HR `H` |
| R-20 | Scope sprawl: new features without register rows; ~300 docs | 4 | 3 | 12 | Truth | rule 2 of the master plan; guard test | no PR adds a feature without a row | HR |
| R-21 | Parallel models mid-migration (two Today engines, four task models) cause data divergence | 3 | 3 | 9 | Coherence | choose authority; retire flagged duplicates | one model each | HR |
| R-22 | A real connector, once written, is unproven: no real-source acceptance | 3 | 4 | 12 | Integration | acceptance gate in the [factory](SEMESTER_MIGRATION_FACTORY.md) | first adapter accepted | HR |
| R-23 | Audit trail erasable by a service key; verifier jobs hand-applied | 2 | 4 | 8 | Audit | revoke; chain; schedule by migration | `service_role` delete fails | HR |
| R-24 | Registration-window load: no real-load evidence for the target window | 2 | 4 | 8 | Reliability | load scenario at pilot scale before the window; freeze policy | scenario run and filed | HR |

## Burn-down order

Sort by score, then by cost to burn. The first week is cheap and large:

| Order | Risks | Why first |
| --- | --- | --- |
| 1 | R-01 | one setting, removes the largest operational risk |
| 2 | R-09, R-11, R-23 | small code with a failing test first, no customer needed |
| 3 | R-13, R-05, R-20 | documents and claims; cost is attention |
| 4 | R-07, R-08 | the second person and the alert path; unlock every later drill |
| 5 | R-02 | the largest engineering item and the gate for a second tenant |
| 6 | R-14, R-15 | the pilot spine |
| 7 | R-03, R-04, R-18, R-19 | humans: pipeline, counsel, cash, IP; start in week 1 because lead time is long |
| 8 | the rest | in score order |

R-03, R-04, R-18 and R-19 have the longest lead times and need no code. They
start in the first week even though they are not first in the cheap-and-small
list.

## Closing a risk

A risk closes only with an artifact: a dated file, a passing test with its
revert record, or an API read bound to a date. "Mitigated" without one stays
open. A closed risk stays in the table for one quarter with its evidence link.

## Trend

Recorded each quarterly review: count of risks at score ≥ 15, total score, risks
closed with evidence, risks opened. First reading, 2026-10-05: 24 open; 12 at score 15 or above (R-01, R-02, R-03, R-04, R-05, R-07, R-08, R-14, R-15, R-16, R-18, R-19); no risk closed.
