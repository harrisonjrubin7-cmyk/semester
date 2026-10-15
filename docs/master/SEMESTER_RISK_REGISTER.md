# Semester master risk register

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** A risk listed here is a reading from the audits and from the repository's own registers. Likelihood and impact are the author's ratings, not measurements, and they were set by one reviewer. **This register adds a view across the four existing registers; it closes no risk.** Closing a risk needs evidence in `docs/evidence/` and a reviewer who is not the owner.

## Why another register

The repository has four: [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) (16: FR-001 to FR-012 visible), [`docs/program/RISK_REGISTER.md`](../program/RISK_REGISTER.md) (36: R-001..R-036), [`docs/company/RISK-REGISTER.md`](../company/RISK-REGISTER.md) and [`docs/strategy/RISK-REGISTER.md`](../strategy/RISK-REGISTER.md). This page is **the cross-cutting top list**, by theme, that cites the rows it summarises. When a row below and a source row disagree, the source row wins and this page is wrong.

Scale: Likelihood and Impact 1 to 5; score = L × I. P0 ≥ 16, P1 ≥ 10, P2 ≥ 5, P3 otherwise.

## Register

| ID | Theme | Risk | L | I | Score | Pri | Cause (evidence) | Mitigation | Owner seat | Source rows |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| MR-01 | Demand | No institution has asked for the product; every design decision rests on no customer evidence | 5 | 5 | 25 | P0 | No named customer, champion or discovery finding | Ten recorded discovery interviews; do not build domains no partner chose | founder | FR-002; EXT-012 |
| MR-02 | Security | Cross-tenant data exposure once institutional data enters | 3 | 5 | 15 | P1 (rises to P0 at first real data) | F-01; FORCE RLS on none; no negative suite per class | Negative suite; FORCE RLS decision (ADR-0004); anon grant reduction; second review | security | R-001; F-01 |
| MR-03 | Resilience | Cannot restore production within any stated target | 3 | 5 | 15 | P1 | Restore never run on the live project; RTO/RPO unmeasured | Drill into the second project; record time | operations | R-002; RESTORE.md |
| MR-04 | Resilience | Incident goes unnoticed | 4 | 4 | 16 | P0 | F-08: no alert reaches a person | Alert delivery to a person; tested page | operations | F-08; EXT-010 |
| MR-05 | Concentration | One person holds every seat; no independent review; key-person loss halts the company | 4 | 5 | 20 | P0 | Owner matrix; every backup UNASSIGNED | Name an independent reviewer and backups; second operator | founder | R-018; F-09 |
| MR-06 | Legal | Entity, IP chain, signing authority or the Vanderbilt IP/name question blocks contracts | 3 | 5 | 15 | P1 | Attestation only | Counsel engagement; formation certificate | founder | FR-001; EXT-001 |
| MR-07 | Legal | Public or institutional paper contains statements counsel has not reviewed | 4 | 4 | 16 | P0 | 77 `[DECIDE]` placeholders; 15 site statements over evidence | Withdraw or fix C-01..C-15; counsel review | founder | EXT-002, EXT-003; C-01..C-15 |
| MR-08 | Claims | A public claim exceeds evidence (security, accessibility, uptime, price, "replaces LMS") | 4 | 4 | 16 | P0 | Claim register shows prohibited rows; deployed revision unverified | Claims audit of the live site; test that site claims map to rows | trust | CLM-006..016 |
| MR-09 | Accessibility | Product is found inaccessible by an institution's own evaluation | 4 | 4 | 16 | P0 | No qualified evaluation; no ACR; CLM-008 prohibited | Commission evaluation first; fix; then claim | accessibility | EXT-008 |
| MR-10 | Security | An undiscovered vulnerability in 639 definer-function mentions and 16 self-authenticating edge functions | 3 | 4 | 12 | P1 | Per-function review not done; 25-function delta unreconciled | Definer hardening (Phase 1 step 5); edge function auth test | security | Definer register |
| MR-11 | AI | A model path bypasses policy or the kill switch | 3 | 4 | 12 | P1 | F-04; F-05 | Route BYOK through the switch; fence untrusted text in the gateway | engineering | F-04; F-05 |
| MR-12 | AI | AI gives an authoritative-sounding wrong answer about policy, eligibility or money | 3 | 5 | 15 | P1 | Eval set thin; one red-team run | Deterministic engines; citations; refusal tests per role | product | AI-012; DO-NOT-BUILD 7 |
| MR-13 | Privacy | Student data of a minor or a protected class mishandled | 2 | 5 | 10 | P1 | Guardian links not activated; classes unreviewed | Counsel review; human review of classes; age gates tested | privacy | EXT-003 |
| MR-14 | Delivery | `main` is red and has no ruleset; a release cannot be proven | 5 | 3 | 15 | P1 | 26 of 30 runs failed; ruleset not active | Fix the two causes; apply ruleset | engineering | Phase 1 step 0 |
| MR-15 | Delivery | Registers drift and contradict each other; decisions rest on a stale one | 4 | 3 | 12 | P1 | Ten disagreements listed in the capability matrix | Regenerate and reconcile; one claim ceiling | product | Capability matrix |
| MR-16 | Delivery | Doc and test corpus outgrows review capacity | 4 | 2 | 8 | P2 | About 300 docs, 1,340 tests, one reviewer | Prune; generate; cap new registers | product | |
| MR-17 | Integration | The first real SIS/LMS connection reveals the adapters are wrong | 4 | 3 | 12 | P1 | No real connection; sandbox only | Sandbox LMS registration; first read-only adapter | engineering | PGM-03 |
| MR-18 | Integration | Registration load at open exceeds capacity | 2 | 5 | 10 | P1 | Untested against a real SIS | Load test at 5x a partner's peak before write-back | engineering | — |
| MR-19 | Money | A payment, refund, dispute or tax error | 3 | 4 | 12 | P1 | Annual, refund, failed renewal, dispute, tax unexercised | Exercise each path in test mode and live minimum | finance | FR-008; EXT-004 |
| MR-20 | Money | Pricing conflict kills a sale (three institutional number sets; site shows a fourth) | 4 | 3 | 12 | P1 | READINESS_GAP_MATRIX | One price book; consistency test | finance | C-01 |
| MR-21 | Finance | Cash runs out before evidence closes | 3 | 5 | 15 | P1 | Opening cash $0 placeholder; no real runway | Enter real numbers; gate hiring | finance | 13-REAL-NUMBERS-INTAKE |
| MR-22 | Market | An incumbent (LMS, SIS) or a platform copies the front-end and out-sells on trust | 3 | 4 | 12 | P1 | Table stakes are copyable | Build the evidence; stay narrow; do not market features as moat | founder | MOAT-PLAN |
| MR-23 | Market | Buyers will not give a system of record to a one-person vendor | 4 | 5 | 20 | P0 | Single-person company; no certifications | Stay at handoff/connect; seek a champion for a bounded pilot; buy independent assurance | founder | FR-002 |
| MR-24 | Scope | Trying to build all forty domains dilutes everything | 5 | 4 | 20 | P0 | 15 domains with no customer | Customer-led sequencing; defer P3 | founder | backlog rules |
| MR-25 | Scope | A marketplace is built before integrations are certified | 2 | 3 | 6 | P2 | ADR-0024, D-1236 | Do not build | founder | X-17 |
| MR-26 | Safety | A safety or crisis handoff fails to reach a human | 2 | 5 | 10 | P1 | No 24/7; no signed escalation agreement | No activation without agreement and rehearsal | trust | D21 |
| MR-27 | Vendor | A subprocessor change or outage with no DPA or exit | 3 | 3 | 9 | P2 | No vendor risk-assessed; no DPAs | DPAs; second-region plan; export test | trust | EXT-017 |
| MR-28 | Vendor | The AI provider changes terms, price or model behaviour | 4 | 3 | 12 | P1 | One shared-key provider; cost model illustrative | Provider abstraction; eval on change; per-tenant provider policy | engineering | AI toolkit |
| MR-29 | Data | Table classification errors place sensitive data under weak rules | 3 | 4 | 12 | P1 | Rule-derived classes; unreviewed | Human review starting at T3+ | data | database register |
| MR-30 | Continuity | Hosting, domain or mail depend on personal accounts | 3 | 3 | 9 | P2 | F-13; C-12 | Move to company-owned | operations | F-13 |
| MR-31 | Compliance | A questionnaire answer overstates a control | 3 | 4 | 12 | P1 | Draft answers; no certifications | Answers cite `CONTROL-FACTS.md` only | trust | HECVAT matrix |
| MR-32 | Reputational | A "replaces your LMS/SIS" message lands before proof | 3 | 4 | 12 | P1 | CLM-006 prohibited | Message discipline; claim tests | founder | CLM-006 |

## Top five

By score: **MR-01** demand (25), **MR-05** one person (20), **MR-23** a one-person vendor cannot be a system of record (20), **MR-24** scope (20), **MR-04 / MR-07 / MR-08 / MR-09** (16 each). The first four are not engineering problems.

## Review

| Cadence | Action |
| --- | --- |
| Weekly | Re-rate any risk whose evidence changed; add an owner note |
| Monthly | Reconcile with the four source registers; mark any drift |
| Quarterly | Retire a risk only with evidence; record the reviewer who is not the owner |
| On any activation request | Re-score MR-02, MR-04, MR-09, MR-12, MR-26 first |

## Decisions awaiting an owner

PDR-01 to PDR-07 in `docs/program/03-RAID.md`: cut candidates from a green `main` SHA; which duplicate PR proceeds; an escalation level above the founder; whether counsel is engaged and who; whether Track B starts and its T0; the first design-partner profile and cohort; whether feature merges pause during a freeze. They are the same decisions as MR-05, MR-06, MR-14 and MR-24.
