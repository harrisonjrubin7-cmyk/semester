# Exit plan

> **Type:** runbook · **Audience:** institution-admins, implementers · **Owner:** `privacy` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This runbook says how an institution leaves Semester, what each side does, what students keep and which parts of leaving are not built; stop reading if you want a button to press, because offboarding has no screen by design.

**Status:** `IMPLEMENTED_NOT_RELEASED`. School offboarding is an audited, reversible case built in the database. No school has been offboarded and no case has been rehearsed by a second person. The purge, the export file handed to the school and the notification to students are not built, and the delete of a school row is refused for every role.

<!-- status: School offboarding (audited case, reversible until purge) = IMPLEMENTED_NOT_RELEASED -->
<!-- capabilities: tenant:configure -->
<!-- roles: university_admin -->
<!-- functions: propose_offboarding, offboarding_preflight, approve_offboarding, record_offboarding_notice, disable_school_access, record_offboarding_export, verify_offboarding_export, archive_school, authorize_school_purge, cancel_offboarding, school_purge_eligibility, restore_school -->
<!-- paths: docs/SCHOOL-OFFBOARDING.md, docs/market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md, docs/DATA-PORTABILITY-AND-OFFBOARDING.md, supabase/school-offboarding.check.sql, supabase/migrations/20260930200000_school_offboarding.sql -->

## What students keep

Disabling a school's access does not touch a student's own session or account, delete or edit any record, or change any other school. Students keep their accounts and can export their own data at any time, in any billing state. Their device-only data stays on their device. Tell them before you leave; see the notice step below.

## The case, step by step

Everything is a function called with a signed-in account. There is no screen: an offboarding is a rare, contractual event with two named people, and a screen would be a way to do it by accident. The authoritative table is [`SCHOOL-OFFBOARDING.md`](../../SCHOOL-OFFBOARDING.md).

| # | Call | Institution does | Semester does | What you can verify |
| --- | --- | --- | --- | --- |
| 1 | `propose_offboarding` | A `university_admin` (holding `tenant:configure`) may propose, with a reason | Or a platform operator proposes | One open case per school |
| 2 | `offboarding_preflight` | Reviews the inventory | Takes the dependency inventory: every public table with a tenant or school column and its row count, members, live grants, connections and legal holds | The inventory exists. The audit record is kept and not returned |
| 3 | `approve_offboarding` | If Semester proposed, your administrator approves | If you proposed, an operator approves | The approver is the other side and a different person |
| 4 | `record_offboarding_notice` | Tells students to take their own export, then records the date | Records it | The date is not in the future. The call records that students were told; it sends nothing |
| 5 | `disable_school_access` | Nothing in the database; agree the cutoff in writing | Operator revokes every school-scoped grant, disconnects connections and clears credential pointers, ends sessions, suspends the rollout record | Your administrators lose school-scoped power. A new grant, member or connection is refused while the case is open |
| 6 | `record_offboarding_export`, then `verify_offboarding_export` | Receives the export and checks it | Two different operators record and verify it | Counts cover every table the inventory found and every table that now holds rows for the school; otherwise the case stays put and the rejection is audited |
| 7 | `archive_school` | Agrees the retention window | An operator archives; at least 30 days, default 90 | The export is verified |
| 8 | `authorize_school_purge` | Counsel confirms no matter covers the school | An operator who neither proposed nor approved authorizes after the window and with no live legal hold | It records the authorization and deletes nothing |

`cancel_offboarding` closes a case at steps 1 to 3. `school_purge_eligibility` answers "why not yet" at any time. `restore_school` gives back exactly the grants and connections that were revoked, from steps 5 to 7, by an operator other than the one who disabled access, and refuses after a purge has been authorized. Sessions that were ended stay ended.

## Your own work

1. **Rotate the secrets.** Disconnecting clears Semester's pointer to a credential. The secret itself must be rotated at the provider by a person.
2. **Disable your identity link.** Set the SSO provider to `disabled` and revoke the SCIM credential on your side of the identity provider. Neither deletes a membership.
3. **Remove the LTI registration** from your learning system and remove its origin from your framing allow-list.
4. **Take your own copies** of anything you keep in your own systems and apply your retention rules. Semester's erasure does not reach them.
5. **Check that access failed.** Ask a test user to sign in and confirm institutional access is gone.
6. **Collect a completion record.** The pilot playbook asks for one, naming exceptions. The rollout ladder will not archive a school without a `completion_certificate`.

## Legal holds and retention

A live legal hold on the school, or a platform hold, blocks purge eligibility. Confirm with counsel that no matter covers your school before any purge is authorized; a hold nobody placed protects nothing. Archiving keeps everything, so the retention sweeps continue on their normal clocks. The retention window (90 days default, 30 minimum) is a placeholder: counsel sets the real length, and whether a former school's student work is kept, returned or destroyed.

## Pilot ending without a school case

The pilot offboarding playbook has a shorter path for a stop decision, expiry or customer request: confirm authority and effective date, freeze new enrolment, disable integrations and features, revoke grants and tokens, provide an export and verification window, delete or de-identify eligible data, verify tenant access fails and scheduled jobs stop, and send a completion record. Its target is within 30 days ([`PILOT-OFFBOARDING-PLAYBOOK.md`](../../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md)). Several of those actions have no tool behind them yet; see the next section.

## What is not built

- The purge. Deleting a school's records category by category does not exist, so the trigger on `schools` refuses every delete, including after `authorize_school_purge`.
- The export file. Step 6 records and verifies an export made elsewhere; nothing here generates one.
- Notifying anyone. Step 4 records that it happened.
- A screen.
- Revoking department-, office- and course-scoped grants. Only school-scoped grants are revoked; a course instructor's grant reaches only that course's records.
- A rehearsal on a preview branch by two people. The author ran a compact rehearsal on a hosted preview database with synthetic data; the rehearsal checklist in the runbook is still the gate before a real school.
