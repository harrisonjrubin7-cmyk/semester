# Campus services platform — build plan

From "countinue outlining building expanding enhancing d.pdf" (14 Oct). Prototype: `ui_kits/campus-services/index.html`. Proposed SQL: `campus_services_invariants.sql`. Nothing run or deployed.

## Shared engines (one set, used by every service)
Identity + eligibility · inventory + allocation · contracts + acceptance · orders + service cases · financial orchestration · entitlements · scheduling · controlled actions · communication · operational evidence.

A housing contract **references** the same student, term, charge and entitlement records. Housing never stores a balance; dining never keeps its own meal-plan copy.

## Invariants enforced in the database (`campus_services_invariants.sql`)
| Rule | How |
|---|---|
| One active occupancy per bed per period | `exclude using gist (bed_id, period &&)` |
| No student double-assigned | `exclude using gist (institution_id, student_id, period &&)` |
| Last-bed race has one winner; stale versions refused | `cs_select_bed` locks the bed row and checks `inventory_version` |
| Reservations expire | `reserved_until` required for `reserved` |
| Overrides need named authority + reason | check constraint |
| Meal ≠ dollar | per-entitlement `unit` (`meal`, `pass`, `usd_cents`) |
| Device retry decrements once | `unique (institution_id, idempotency_key)` + `cs_redeem` returns the original |
| Concurrent spending can't overdraw | `cs_redeem` locks the entitlement row |
| Redemptions are never edited | reversals are new negative rows linked by `reverses` |
| Hold release records who and why | `cs_holds.release_complete` |

## Acceptance tests (first demonstration per package)
1. Two selections race for the last bed → one assigned, one told why.
2. Reservation expires during checkout → bed returns, no charge.
3. Stale inventory version → rejected, nothing changed.
4. Accommodation applied as a requirement; housing staff can't open the documentation.
5. Accepted contract creates exactly one housing charge.
6. Dining order retried by the device → one redemption.
7. Concurrent orders against the last meal unit → one succeeds.
8. Stale allergen publication shows "stale", never "safe".
9. Payment webhook twice / out of order → one posting.
10. Payment settles → only the bursar's financial hold releases; other holds keep their owners.
11. Pending aid shown, never subtracted from payable.
12. Authorized payer revoked → sessions and links end; never sees grades.
13. Work order through verified completion; vendor sees only the task, place, time and access procedure.
14. Rolling the app back doesn't undo occupancy, a consumed meal or a committed payment.

## Cross-domain workflows (each step under current authority)
- **Onboarding:** enrollment → eligibility → housing application → assignment → contract → charge → meal entitlement → move-in → campus access → Today checklist.
- **Housing cancellation:** request → consequence preview → approval → occupancy release → contract amendment → charge/refund calculation → meal-plan review → access transition → receipt + reconciliation.
- **Withdrawal:** housing review → dining entitlement review → tuition refund assessment → aid/R2T4 workflow → account reconciliation → access offboarding → notices.

## Refunds are separate, reviewer-approved workflows
Institution tuition refund · Title IV credit balance (14-day limits) · withdrawal + R2T4 · payment reversal · housing/dining refunds · disputes · sponsor adjustments. Aid officers and qualified reviewers keep acceptance authority.

## Authority modes (per service)
Off → Shadow → Assist → Controlled writes → Native-authoritative → Legacy retirement. Cutover evidence: inventory, identity mapping, contract/balance integrity, active requests, files, permission/revocation tests, dual-run reconciliation, staffing, recovery, UAT, cutover authority, export, public claims.

## Boundaries
- Physical readers, kitchens, POS and door controllers stay under their hardware/physical-security authority; offline redemption needs signed device identity, replay protection and reconciliation.
- Library, payroll, immigration, clinical records and emergency operations need their own domain specs — not a generic "Services" screen.
- AI may explain approved information and draft requests; allocations, refunds, holds, exceptions and access changes stay human-authorized.

## Before applying the SQL
Reconcile with the repo's existing housing, dining and finance tables (the PDF cites `NATIVE_FINANCIAL_PLATFORM.md` canonical records). `cs_*` must extend those, not sit beside them.

## Part 2 — Campus Operations Core (from "Build a native student housing portal specificatio.pdf")

Prototype tabs added to `ui_kits/campus-services/` via `ops-core.js`: **Allocation engine**, **Meal-plan lots & rollover**, **Payments & credit balances**. SQL: `campus_operations_core.sql`.

| Area | Rule | Where |
|---|---|---|
| Allocation runs | Pin policy, inventory, eligible-list hash, accommodation set, group version, method, seed/solver; published runs immutable, changes supersede; reviewer ≠ operator | `cs_allocation_runs` + trigger |
| Lottery | Frozen eligible list + published seed → reproducible order (prototype "Reproduce" checks it) | prototype |
| Roommate groups | Versioned; each member accepts for themselves (staff can't) | `self_acceptance` check |
| Group selection | All beds or none; beds locked in sorted order; group version checked; retry returns the original set | `cs_select_group_beds`, `cs_group_selections` |
| Reservation expiry | Never released while the deposit outcome is processing/unknown/confirmed | `cs_release_expired_reservations` |
| Rollover | Per-institution policy (examples: Vanderbilt-style reset with Meal Money carry; Michigan-style conditional); linked transfer + expiry entries; reserved units for a pending order stay on the source lot; idempotent per lot × policy version | `cs_rollover_runs` |
| Payments | Created → action required → processing → confirmed / failed / cancelled / outcome unknown; settlement and ledger posting separate; duplicate provider events no-op | `cs_payment_attempts`, `cs_provider_events` |
| Credit balances | 7 kinds kept separate; Title IV due date (14 days after creation if classes began, else 14 days after the first day of class, or 14 days after notice of a cancelled hold authorization); closed only with a delivery reference — a bank rejection keeps it open | `cs_credit_balance_obligations`, `cs_title_iv_due` |

The Title IV deadline logic was checked here on 5 cases (before/after/on the first day of class, cancelled authorization, year boundary) — all as expected. The aid office confirms applicability per case; withdrawals use R2T4, not this rule.

### Integrated acceptance run (first)
Approved housing selection → correct assignment + charge → accepted dining plan → correct entitlement lots → authoritative payment posts once → eligible holds evaluated by their owners → any credit-balance obligation calculated, delivered and reconciled — without conflating the domains. Name the institution's Housing, Dining/Card Office, Bursar, Aid, IT, Accessibility and Privacy acceptance authorities first.

## Checks
`campus_services.check.sql` — 34 checks in the repo harness style (incl. AT003 group version and AT013 rollover rerun from the uploaded specification) (own institution, beds and students; rolls back): stale version, bed and student overlap, non-overlapping periods allowed, override/reservation constraints, redemption retry + overdraw + append-only, self-acceptance, allocation-run publication rules + immutability, reservation kept while the deposit outcome is unknown, duplicate provider events, three Title IV due dates, credit balance can't close without delivery. Needs both SQL files plus the `live_integration` migration (for `live_outbox`). **Not run here.**

Writing it caught a real gap: the student double-booking rule only covered `assigned`/`active`. A partial exclusion ignores rows outside its predicate, so a new **reservation** would have slipped past an existing assignment. It now includes `reserved`.

## Roommate & housing kit
`roommate-housing-kit/` (uploaded) + REVIEW.md. Adopted: bed closures as `blocked` claims in the same exclusion; acceptance bound to the current group version (membership changes invalidate old acceptances). Four open decisions listed there — the biggest is whether server roles bypass RLS (current design) or not (kit).

## Validation review fixes (14 Oct)
`housing-validation-review/` (uploaded) + RESPONSE.md. `campus_review_fixes.sql` + `.check.sql`: claim kind, contract correspondence FK, confirm/expiry under one lock, scoped read policies, `semester_writer` owner. Authorization model: `../AUTHZ-DECISION.md`. Apply order: invariants → operations core → review fixes.
