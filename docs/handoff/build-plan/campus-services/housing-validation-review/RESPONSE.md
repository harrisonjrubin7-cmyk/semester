# Response to the Housing Validation Review (10 findings)

Package filed unchanged. Your 21 Python tests and 1,330-configuration weight sweep ran on your side; 0 of 13 database cases ran (no isolated database). Nothing below changes that: the fixes are written, not executed.

| # | Pri | Finding | Status | Where |
|---|---|---|---|---|
| 1 | P0 | Linked ids can disagree (contract / student / period) | **Fixed for contracts**: composite FK `(institution, contract, student)`; confirm checks the contract period covers the claim. Application and group correspondence stay command-verified (`cs_select_group_beds` checks membership + version). | `campus_review_fixes.sql` |
| 2 | P0 | Confirmed claim can omit contract; expired reservation can be confirmed | **Fixed**: assigned/active needs a contract (CHECK); `cs_confirm_assignment` locks the row, refuses expired or non-reserved, needs an accepted contract for the same student; idempotent retry. Expiry worker uses `for update skip locked` so it can't race confirmation. | same |
| 3 | P1 | A closure can't be cancelled (student-null rule tied to status) | **Fixed**: immutable `claim_kind` (student / closure); rule follows kind; trigger freezes kind, institution, bed and student. | same |
| 4 | P0 | Production authorization not installed | **Decided + drafted**: scoped read policies, writes only via definer functions owned by `semester_writer` (NOLOGIN), execute for `service_role` only; migration fails if the browser role can bypass RLS or write. | `../AUTHZ-DECISION.md`, same SQL |
| 5 | P0 | Audit/outbox/group atomicity are service promises | **Partly**: confirm and select write the outbox in the same transaction; group selection is one transaction. Audit-first rollback still needs the repo's existing audit service and a concurrency test. | open |
| 6 | P1 | Hiding a weaker answer raises the score (75 → 81.25 at 66.67%) | **Fixed in the simulator**: minimum comparable share (default 75%) → *Low confidence* label and "don't rank against fuller comparisons". Your exact case now shows low confidence. | `ui_kits/campus-services/roommate.js` |
| 7 | P1 | One field counts for all of lifestyle | **Fixed**: item-level coverage shown (5 items); confidence needs both weight and item coverage above the minimum. | same |
| 8 | P1 | Worst one-way noise mismatch averages to 50 | **Kept the average, added a warning**: a one-way gap of 3+ levels shows a *Noise conflict* note. Whether to score by worst direction is a housing-policy decision. | same |
| 9 | P0 | SIS/ERP endpoints and authority rules unknown | **Open** — needs the institution's vendor documentation and a signed integration contract. | — |
| 10 | P0 | External outcome / checkpoint not transactional | **Open** — durable inbox and atomic checkpoint belong in the sync worker (outbox side exists). | — |

Checks: `campus_review_fixes.check.sql`, covering:
- closure retire and fixed kind;
- another student's contract or acceptance refused;
- assigned-without-contract refused;
- confirm (idempotent) and expired-confirm refused;
- four role facts.

## Your database project list
The review found four Supabase projects, including **Semester-Platform**. Earlier packs listed three. Which one is production is still not established; nothing should be applied until one is named and a branch is created from it.
