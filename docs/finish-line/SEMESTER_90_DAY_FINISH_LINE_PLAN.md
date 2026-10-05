# Semester 90-day finish-line plan

| | |
| --- | --- |
| **Version** | 0.1 |
| **Window** | 2026-10-05 (day 1) to 2027-01-03 (day 91) |
| **Owner** | Harrison Rubin |
| **Status** | Proposed. Dates, efforts and capacity are the author's estimates and become commitments only when the founder adopts them. |

## Goal

By day 90, **pilot gate P-1 passes**: the Registration Readiness Pilot's steps 1
to 13 run end to end on a synthetic tenant, each leaving its evidence, on a
`main` that is protected and green, with the cheap security defects closed and a
named backup able to receive an alert. In parallel the commercial work that has
long lead times (counsel, price, pipeline) is under way, so a customer
conversation can become a signed pilot without waiting on the code.

Day 90 is **not** "pilot signed", "domain authoritative" or "paid". Those depend
on counterparties.

## Capacity check

Effort per action below is estimated in person-weeks (pw) of focused work.

| Bucket | Actions | Estimate |
| --- | --- | --- |
| Engineering | 1–8, 13–16 (partly), 17–20 | about 23 pw |
| Founder commercial and legal | 9–12, 22–23, and coordinating 10, 21 | about 5 pw |
| Total | | about 28 pw |

Assumption to confirm: **one person, about 1.0 pw per calendar week**, which is
13 pw in the window. The plan as listed needs roughly 2.2 such people. It does
not fit one person.

Options, a founder decision:

| Option | What it means |
| --- | --- |
| A. Add engineering capacity | A second engineer or contractor for about 10–12 weeks. The plan fits. Cost belongs in the finance model; not stated here because no real number exists. |
| B. Cut to one person | Do tier 1 only (below, about 13 pw). Move the tenant sweep (4), champion dashboard (16), source labels (17), AI baseline (19), target drills (20) beyond day 90. A second tenant is then not allowed before the sweep exists. |
| C. Stretch | The same work over about 26 weeks. The first conversations then run ahead of a deployable pilot. |

**Tier 1 (fits one person):** 1, 2, 3, 6, 7, 5, 8 (partial), 13, 14 plus the
commercial items 9–12, 22, 23. About 9.8 pw engineering and 4 pw commercial.
This reaches P-1 for steps 1–10; steps 11–13 need 15 and 16.

## The next 25 actions

Type: **E** engineering · **D** founder decision · **H** needs a human or
counterparty · **V** verification. `Exit evidence` is the artifact that closes
it, per [the completion definition](SEMESTER_COMPLETION_DEFINITION.md).

| # | Action | Type | Est. | Start → due | Depends on | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Re-read branch protection via the API; decide the reviewer rule a one-person repo can satisfy; apply `.github/rulesets/main.json` (or a corrected copy); get the last 10 `main` runs green | E + D | 0.5 | wk 1 → 10-19 | — | API read showing protection; run history |
| 2 | Fix `fetchcal`: `redirect: 'manual'`, check every hop before the request, resolve and check addresses; failing test first | E | 0.3 | wk 1–2 | — | test red on revert, green with fix; merged |
| 3 | Refuse device-key AI routes when kill switch or school AI-off applies | E | 0.5 | wk 2 | — | route test; `docs/security/FINDINGS-REGISTER.md` F-04 closed |
| 4 | Generic cross-tenant sweep over every tenant table (TI-01/TI-04) as a CI gate; storage tests on real Storage; enable membership enforcement on a staging school | E | 3 | wk 2–6 (tier 2) | — | suite green; seeded policy-less table caught; `TENANT-ISOLATION-VERIFICATION.md` rows closed |
| 5 | Production restore drill with `restore-drill.sh`; verify PITR; record date, owner, recovery point and time | E + H | 0.5 | wk 3 | — | `docs/evidence/restore/` record |
| 6 | Disable GraphQL exposure; decide and apply the remaining `anon` DML reduction on the 32 tables and the `authenticated` allowlist (`database/GRANT_ALLOWLIST.md`; the TRUNCATE/TRIGGER/REFERENCES/MAINTAIN part landed in D-1251); fix DR-01; refresh the definer register | E | 0.5 | wk 2 | — | `grants.check.sql` asserts it; advisor read before and after |
| 7 | Alert path: probe failure and ticket-queue age to a phone; non-personal support and security address; name a backup | E + H | 0.5 | wk 2–3 | — | induced failure received by two people, timestamped |
| 8 | Reconcile stale material to the code: domain register (registration, gradebook), tenant-isolation doc, definer-sweep header, data-inventory counts, the status documents, the four risk registers; extend `finishline.test.ts` to read the domain scorecard and per-row release fields | E + doc | 1 | wk 2–4 | — | diffs merged; test extended and shown red on a seeded contradiction |
| 9 | Freeze the pilot wedge as a one-page offer: cohort, term, 26 weeks, two or three metrics, midpoint date | D | — | wk 1–2 | — | decision file `docs/decisions/D-<pr>.md` |
| 10 | Engage counsel: pilot agreement, DPA, public policies, FERPA wording; assign a queue owner | H | — | start wk 1 | 9 | engagement letter; `LEGAL_REVIEW_QUEUE.md` rows moving |
| 11 | Record entity name, state, formation date, signing authority, tax and insurance advisers, bank | H | — | wk 1–3 | — | `docs/company/` record (no secrets) |
| 12 | Approve one price book; reconcile the three number sets and the public band; withdraw unbacked claims | D + H | — | wk 3–4 | 9, 10 | decision file; site diff; claims register updated |
| 13 | Operator spine on a synthetic tenant: create tenant, import cohort (over the `private.roster_*` RPCs), send invites, view status | E | 4 | wk 3–8 | 9 | screens; tests; evidence for pilot steps 4, 6, 8 |
| 14 | Wire `pilotReadiness` and `pilotVerdict` and `gtm_pilot*` to a pilot screen | E | 1.5 | wk 6–8 | 13 | screen; test; pilot steps 2, 16, 17 |
| 15 | Decide and build activation and first-action events within the privacy rules (the three-mark limit is a decision) | D + E | 2 | decide wk 3; build wk 6–9 | 9 | decision file; events tested; `activity.check.sql` updated |
| 16 | Champion role and cohort dashboard with the `MIN_COHORT = 10` suppression floor | E | 2.5 | wk 8–11 (tier 2) | 13, 15 | screen; small-cell test; pilot step 13 |
| 17 | Source-label the 12 institution-flavoured screens; wire `onReport`; one non-student role reviewable in a plain build | E | 2 | wk 4–9 (tier 2) | — | `clm018`-style guard widened; screenshots |
| 18 | Put `keyboard-pass`, `targets-sweep` in CI; close A11Y-0001, -0002, -0004, -0008; run the manual assistive-technology pass on the pilot path | E + H | 1.5 | wk 4–10 (tier 2) | — | CI jobs; recorded AT pass; ledger rows person-confirmed |
| 19 | File a live model-quality baseline; build the prompt registry; repeat the red team on each allowed model | E + V | 1.5 | wk 4–7 (tier 2) | — | `docs/evidence/ai/` records; registry test |
| 20 | Target-environment drills: rollback, data rights, revocation, offboarding, alert-to-person | E + H | 1 | wk 8–11 (tier 2) | 5, 7 | one record per drill under `docs/evidence/` |
| 21 | Commission the independent security assessment and a qualified accessibility review (long lead) | H | — | start wk 6; report after day 90 | 4, 18 | engagement; later report |
| 22 | Build the 100-account institutional target list in the CRM tables | H + E | 0.5 | wk 1–4 | 9 | rows in `gtm_accounts` with stakeholders mapped |
| 23 | Run 15–25 buyer conversations; log each; refine the offer from evidence | H | 3 (founder) | wk 3–13 | 9, 22 | `docs/pilot/DISCOVERY-EVIDENCE-LOG.md` entries |
| 24 | Secure the first paid pilot **only after** the go/no-go conditions are met | H | — | not scheduled | 3, 4, 10, 12, 13–16, 23 | executed agreement in `contracts/` |
| 25 | Convert measured pilot evidence into an annual contract, case study and expansion plan | H | — | after a pilot | 24 | decision record; outcome report |

Actions 24 and 25 are listed because the finish line requires them. They cannot
be completed from this repository, and no date is promised for them.

## Weekly shape

| Weeks | Focus | Exit check |
| --- | --- | --- |
| 1–2 | Protect `main`; cheap defects (2, 3, 6); decide wedge (9); start counsel (10), entity (11), target list (22) | `main` protected and green; three defects closed with failing tests first |
| 3–4 | Restore drill (5); alert path (7); doc reconciliation (8); price (12); start conversations (23) | backup named; restore record; contradictions removed |
| 5–8 | Operator spine (13); privacy decision and events (15); start tenant sweep (4) if capacity allows | create-tenant, import, invite run on a synthetic tenant |
| 9–11 | Pilot screen (14); champion dashboard (16); AT pass (18); drills (20) | dress rehearsal P-1, steps 1–13 |
| 12–13 | Dress rehearsal; fix; record; quarterly review; next-quarter plan | P-1 evidence filed; risk burn-down re-scored |

## Day-90 exit criteria

| Criterion | Evidence |
| --- | --- |
| `main` protected; last 10 runs green | API read; run history |
| SEC-03, SEC-09, SEC-10, SEC-16 closed | tests, merged |
| A named backup has received an induced alert | timestamped record |
| Production restore recorded | evidence file |
| Stale documents reconciled; guard extended | merged; test red-then-green record |
| Wedge and price decisions made | decision files |
| Counsel engaged; entity facts recorded | letters; record |
| Pilot dress rehearsal (P-1) passed on a synthetic tenant | step-by-step evidence |
| ≥ 15 buyer conversations logged | evidence log |

If a criterion is missed, it is reported as missed with the cause. It is not
re-labelled.

## 12-month roadmap

Each quarter's content is conditional on the previous quarter's exit evidence.
Items that need a customer are marked `C`.

| Quarter | Theme | Planned outcomes |
| --- | --- | --- |
| Q4 2026 (Oct–Dec) | Foundation and rehearsal | Everything above; pilot dress rehearsal; first 15–25 conversations; counsel engaged |
| Q1 2027 (Jan–Mar) | First pilot | Tenant sweep and enforcement done (before a second tenant); AT pass and ACR path; pen test and HawkScan filed; HECVAT Lite sent; first pilot launched `C`; weekly reviews run `C` |
| Q2 2027 (Apr–Jun) | Prove the wedge | Midpoint and final outcome report `C`; first real data path accepted (one adapter, real-source acceptance) `C`; annual conversion decision `C`; domain replacement review: choose the first candidate domain `C` |
| Q3 2027 (Jul–Sep) | Repeat and extend | Second pilot or expansion `C`; first dual-run period for the chosen domain `C`; SOC 2 readiness decision; support staffing per measured load |
| Q4 2027 (Oct–Dec) | Authority for one domain, if earned | Only if gates 1–21 pass with evidence for one domain; otherwise the quarter's work is the failing gate. No domain is promised authoritative. |

The long-term vision (the unified, AI-native operating system for education) is
unchanged. This roadmap sets the order in which it earns trust.

## Team and owner model

The PDF names 20 functions. One person holds all of them today
(`OWNER-AND-ACCOUNTABILITY-MATRIX.md`; backups `UNASSIGNED`). The model records
who answers for each function and the measurable trigger for the first
additional person. **Hire when the bottleneck has a measurable revenue,
delivery, risk or reliability cost, not for title prestige.**

| Function | Today | Trigger for a dedicated person |
| --- | --- | --- |
| CEO / founder | HR | — |
| Product, design | HR | pilot feedback backlog older than 4 weeks |
| Engineering, platform/SRE | HR | **now**: the plan needs about 2.2 FTE (see capacity check) |
| Security, privacy/legal | HR + counsel (H) | counsel first; a security hire after the independent assessment |
| Learning science | HR | a metric the pilot cannot interpret |
| Academic operations / registrar | HR | the first real institutional data path |
| Student success, customer success, implementation | HR | **first signed pilot** |
| Sales, marketing, partnerships | HR | pipeline conversations exceed about 5 per week |
| Finance, people operations | HR + adviser (H) | cash decisions delayed more than a week |
| Support | HR | **first launched cohort**; ticket age breaches the clock |
| Data/analytics | HR | outcome measurement cannot be run on the founder's time |
| AI governance | HR | a second AI route or tenant AI policy in use |
| Developer relations | HR | an external integrator asks |

The hiring order in the PDF: founding product/engineering reliability capacity;
customer implementation and success; institutional sales; security and
compliance support; product design and research; data and analytics;
partnerships and integrations; finance and operations; support; developer
ecosystem. This plan agrees with the first two and puts the second person on
**on-call and backup** before either.

## Budget and capacity assumptions

No real financial figure exists in the repository. `docs/finance/` holds a
model marked "NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST" with opening cash
$0 as a placeholder. This plan therefore states **inputs the founder must
supply** instead of inventing totals.

| Input | Value | Source |
| --- | --- | --- |
| Founder productive capacity | 1.0 pw per week (assumed) | founder to confirm |
| Additional engineering capacity | 0 to 1.2 FTE for 10–12 weeks | decision A/B/C above |
| Counsel scope and budget | to be quoted | action 10 |
| Independent security assessment | to be quoted | action 21 |
| Qualified accessibility review | to be quoted | action 21 |
| Assistive-technology testers | to be quoted | action 18 |
| Cloud, domains, providers | actuals from the provider consoles | monthly finance review |
| Real opening cash and monthly burn | actuals | action 11 and the monthly review |
| Insurance | to be quoted | EXT-005 |

Rule: nothing in the plan is committed to a customer or an advisor until the
corresponding input is a recorded actual and the finance model is updated from
placeholders.

## Decisions this plan requests

Each is its own `docs/decisions/D-<pull request number>.md`, written after its
pull request is open (`CLAUDE.md`). None is made by this document.

1. Capacity option A, B or C.
2. Branch-protection reviewer rule for a one-person repository (action 1).
3. Pilot wedge and scope (action 9).
4. Price book and withdrawn claims (action 12).
5. Analytics scope beyond three marks (action 15).
6. Whether the first pilot is paid or an unpaid design partnership.
7. The second seat for backup and on-call.
