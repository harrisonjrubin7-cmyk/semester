# Semester — individual student launch readiness (Phase 0)

**Date:** 2026-10-04 · **Status:** BASELINE — authorizes no cohort, price or campaign · **Controlling:** [`GO-NO-GO-DECISION.md`](../GO-NO-GO-DECISION.md) (individual acquisition: **CONDITIONAL GO / YELLOW**, invitation-only unpaid validation) · **Beta plan:** [`PILOT.md`](../PILOT.md) (ten-person private beta, owner Harrison Rubin; *not* an institutional pilot) · **Executable profile:** `invitation-only-individual-validation`, `individual-scale` in `app/src/lib/governance/release-profiles.ts`

> Terms, privacy, minors, refund, tax and accessibility-claim questions are for qualified counsel, a CPA/tax adviser and a qualified assessor. Nothing here is a legal conclusion.

## 1. What a student can do today

See [`PRODUCT_LIVE_STATUS.md` §2](../docs/program/PRODUCT_LIVE_STATUS.md). In short: a device-first PWA that works offline and signed out; optional account sync (one JSON blob + per-course rows); export and erasure; AI through a shared-key function (plan clamp, per-user spend meter, **global** kill switch) **or** the student's own key straight from the browser. **Paying is not possible** (`supabase/functions/billing-checkout/index.ts:27`, V).

## 2. Product must prove

| Requirement | State | Evidence | Gap |
| --- | --- | --- | --- |
| Secure account | Built | Supabase Auth, RLS 352/352, `account-sync` required check, `delete-account` | Restore unmeasured (G-M5); no cross-tenant/IDOR negative run |
| Billing | Built, **held** | `billing-checkout/index.ts:27`; webhooks idempotent on `provider_event_id`; `20261003083000_billing_tax_integrity.sql` | Price conflict; **only monthly purchase exercised**; annual, refund, failed renewal, dispute not; tax $0.00 in the one purchase |
| Premium entitlement | Shadow | `docs/ENTITLEMENT-RESOLUTION.md` "enforces nothing"; `lib/membership.ts` | Gate features on `subscriptions` |
| Core workflows | Built, device-first | `screens/*` | Most state is client-authoritative; only tasks have a per-row engine (flagged off) |
| AI controls | **Partial** | `claude/index.ts` clamp, `add_spend`, `count_call`, global kill | **BYO-key and proxy paths have no policy/kill/budget/redaction** (PR-01); no redaction (A-05) |
| Privacy | Built | `export_my_data`, `erase_account`, `legal_holds`, retention sweeps, `minimum_age` | Policies unreviewed; DSR clock is a human daily check |
| Support | Built, **unstaffed** | `support_tickets`, 12 articles | No staffing/SLA; policy says "no response time is promised" |
| Accessibility | Automated only | `app/src/a11y/` (18 files), `smoke:a11y` | No manual AT evaluation; site over-claims (PC-4) |
| Mobile | PWA | `RESPONSIVE-CONTRACTS.md` | Real-device coverage limited (FR-013); **no native app** |
| Under-minimum accounts | Built | `minimum_age` migration; `lib/cloud.ts` `stateMyAge` deletes under-minimum accounts | Counsel on minors posture (Q-14, minors row) |

## 3. Company must prove

| Requirement | State | Evidence | Gap |
| --- | --- | --- | --- |
| Terms/privacy review | Queued | Q-02; `docs/legal/*-DRAFT.md` | Counsel unassigned |
| Payment support | Absent | — | Refund process, dispute handling, tax adviser (PL-02) |
| Customer support | Absent | `SUPPORT-POLICY-DRAFT.md` | Rota, hours, backup |
| Status page | Partial | `app/public/status.html` browser probe | Hosted + history |
| Refund process | Draft | `REFUND-AND-CANCELLATION-POLICY-DRAFT.md` | Counsel; product flow verified |
| Lifecycle messaging | Absent | support/lead mail only | Consent posture (Q-10) |
| Company domain / mailboxes | Absent | personal Gmail/GitHub Pages host (PL-08) | Before outbound |

## 4. Conditions to start an invitation-only unpaid cohort

From `GO-NO-GO-DECISION.md` priorities 1, 3, 4, then 6–7 before supported activation, restated with Phase 0 findings:

| # | Condition | Phase 0 state |
| --- | --- | --- |
| 1 | Authorized candidate frozen; exact-SHA hosted CI | `main` @ `c170dcd` is green locally (1,413 files / 22,707 tests; tsc, lint, `check:university` exit 0). **Hosted run and freeze not evidenced here** |
| 2 | Qualified accessibility review + approved public position | Open |
| 3 | Counsel-reviewed terms/privacy/cookie/age posture | Open |
| 4 | Staffed support with a named backup | Open |
| 5 | Restore measured on the target; rollback exercised | **Open (never run)** |
| 6 | Incident/alert exercise | Open (no telemetry/paging) |
| 7 | Representative-user UAT; agreed outcomes and stop criteria | Open |
| 8 | **AI path governed for the cohort** (Phase 0 addition) | Open: close or disable BYO-key/proxy for the cohort; wire the kill switch to every door |

## 5. Paid student plan — additional conditions

Price authority; counsel-approved refund/cancel/renewal/auto-renewal terms (Q-07); tax adviser; live-mode exercise of annual, refund, failed renewal and dispute; entitlement enforcement; payment support; and a **reviewed code change** (not an environment variable) to `individualPaidAcquisitionApproved`, which `salecopy.test.ts:18` asserts. Today's price figure is unresolved (Plus $7.99/$59 vs D-1154 $15 vs program $8.99/$69).

## 6. Verdict

**Prepare; do not activate.** Closest to ready of the four motions, but five of eight conditions are human or externally evidenced, and one engineering item (AI path) is open.
