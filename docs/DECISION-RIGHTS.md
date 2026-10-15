# Who decides what, and where the database makes two people necessary

Requirement (i) of the readiness synthesis of 30 Sep 2026. **This page describes what the repository already enforces.** It is not a charter: a governance charter is a document the owner adopts, names people in, and has counsel read. The council seats and their holders are in `app/src/lib/launchreadiness.ts` and `docs/LAUNCH-READINESS-COUNCIL.md`; today most seats are held by the founder, several acting, and none has signed.

## Two-person rules that hold in the database (not in a runbook)

| Act | Rule | Where it is enforced | Test |
| --- | --- | --- | --- |
| Approving a sensitive request | approver is not the requester; fresh MFA | `decide_approval`, operations console | `console-approvals` checks |
| Break-glass access to a school | requested, approved by someone else, time-limited, reviewed afterwards; an overdue review blocks the next | `break_glass_grant` | `console-approvals` checks |
| Changing a module's mode (Core/Connect) | a row two other administrators approve | D-152, `module_mode` | `module_mode.check.sql` |
| Moving a migration to cutover | approver holds `migration:approve` and did not create it; at least two approval areas | Migration Center (D-144) | `migration-center.check.sql` |
| Switching a school to members-only rooms | operator only, and only after stating the exact locked-out number | `set_school_enforcement` | `school-membership.check.sql` |
| A school leaving | proposer and approver differ **and** come from opposite sides; export verified by a second operator; restore by an operator other than the one who disabled access; purge authorized by a third person | `school_offboarding` (D-1021) | `school-offboarding.check.sql` |
| Releasing a legal hold | releaser is not the placer | `legal_holds` (#1012) | `legal-holds.check.sql` |

## Where it is not enforced (owner decisions, none made)

- Who may approve a **policy or rules exception** (there is no versioned policy engine yet — see the gap matrix, row F).
- A **security exception** (a waived finding, an accepted risk): recorded nowhere as a two-person act.
- A **data exception** (a school asking for a field outside its scope).
- Who answers a **data-subject request**, and by when.
- Who signs the **pilot go/no-go**: `GO-NO-GO-CHECKLIST.md` has seats; none has signed.

## Rule for adding to this page

A line is added only with the migration or module that enforces it and the check that shows it refusing. A promise without either belongs in the "not enforced" list.
