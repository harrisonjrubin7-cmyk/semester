# Stream 01 · Database, tenancy, RLS and core logic — report (first slice)

**Date** 2026-10-05 · **Base** origin/main `19f373e` · **Branch** `claude/build-handoff-setup-ffbwec` (the session's assigned branch, restarted from main after #1287 merged) · **Inputs** [`01-platform-core-diff.md`](01-platform-core-diff.md), [`D-1287`](../decisions/D-1287.md)

## Verdict

**Stream 01 is not complete.** This is its first slice: two new database guards, both proven to fail when they should, and corrections to the diff the stream started from. Most of the 33-item work list is not started (listed at the end). Nothing in the repo's behaviour changed: two new `.check.sql` suites, and documents.

## Exists / extended / new

| Item | Decision | Why |
| --- | --- | --- |
| "Company roles never read student tables" proof | **new** | The diff found no suite asserting it. `rls-coverage`, `capabilities` and `rolegrants` ask other questions. |
| AI audit tables hold no prompt or answer | **new** | True by schema today, pinned by nothing. |
| `ci-security-job.yml` grep guards (service-role key in client code) | **covered — nothing added** | `app/src/lib/ops/boundaries.test.ts` "no service-role credentials in browsers" already scans everything a browser loads, has a control that proves it would catch one, and checks no `VITE_` variable undoes it. The diff's "missing" was wrong. |
| Same, student fields in `track()` | **covered — nothing added** | There is no `track()`. The server takes three marks (`opened`, `course`, `studied`), enforced by a database check constraint on `activity.mark` (`ANALYTICS.md`, `activity.check.sql`), which is stronger than a grep. |
| `approvals.ts` two-person state machine | **covered in SQL — nothing added** | `decide_approval` calls `private.assert_fresh_mfa()` (default window `15 minutes`, the handoff's figure), refuses self-approval, and needs two distinct approvers; `console-approvals.check.sql` tests all three. |
| `Cross-Origin-Opener-Policy` header | **deliberately not added** | See below. |

## What was added

- `supabase/company-roles-student-data.check.sql` — a sweep, not named cases. For each of the 73 tables in `public` that name their owner in a `user_id` or `student_id` uuid column: **64** are probed with a student-owned row (read back by the owner as a control — or, for `grade_passbacks`, which a student is deliberately not let read, checked to exist — then read by each of the fourteen company roles — `app_roles.global` — holding a live platform grant); **9** have no `SELECT` grant for a signed-in client at all; **0** are inconclusive. Slice 1 probed 56 and named eight it could not fill; slice 2 gave those a per-table `fixtures` entry (the value only that table's rules accept, a parent group, an adult enrolled student) and the sweep found no further company-role read. The answer must equal a written list of exceptions, in both directions, and the probed count has a floor of 64 so it can only go up.
- `supabase/ai-audit-content-free.check.sql` — pins the column sets of `private.gateway_intelligence_audit` and `private.gateway_audit`, so adding a column that could hold a prompt or an answer is a decision made in the file, not a line in a migration. `gateway_intelligence_action` and `gateway_review` carry a `sealed_body` (a sealed, expiring proposal awaiting confirmation); they are not audit rows and are named in the file as not covered.

Both are picked up by `supabase/check.sh`, which CI already runs; no workflow changed.

## What the sweep found

Four company-role reads of a student's row exist. Three are intended and now written down with their reason; **one is wider than documented and needs the privacy owner**:

| Table / role | Verdict | Why |
| --- | --- | --- |
| `billing_accounts` / `finance_operator` | intended | `billing:operate` at platform scope is the company's own billing duty (`private.can_read_billing`). The row is the subscription account, not an education record. |
| `data_requests` / `data_steward` | intended | The policy is "a data steward works a request" (`data_request:handle`). |
| `community_volunteers` / `trust_safety_senior` | intended | Senior reviewers run the volunteer program (`docs/VOLUNTEER-MODERATOR-PROGRAM.md`). |
| `community_volunteers` / `trust_safety_reviewer` | **to narrow** | The policy admits `community:review`, which a plain reviewer holds, but the program is the senior reviewer's. The row holds status, training dates and a free-text `revoked_reason`, and the policy ignores `tenant_id`, so a platform-scope reviewer reads every school's volunteers. Narrowing to `community:review_senior`, or writing down why plain reviewers need the roster, is the privacy owner's call. It is recorded as `TO NARROW` in the suite; when the policy is narrowed, the suite fails until that entry is removed. |

## Commands run and results

PostgreSQL 17 was installed from the PostgreSQL apt repository, as CI does (`ci.yml`, "Install the PostgreSQL the live project runs"), so `supabase/check.sh` could run in the session container for the first time. It must run as a non-root user.

```
$ su postgres -c "cd <repo> && supabase/check.sh"       # every suite, 184 migrations
  ✓ company-roles-student-data.check.sql — 4 checks
  ✓ ai-audit-content-free.check.sql — 3 checks
· every policy check passed                              # 115 suites, 20 s
```

**Red then green, per guard** (each by a temporary migration or a temporary copy of the suite, deleted afterwards; none committed):

| Proof | Result |
| --- | --- |
| A policy gives `support_agent` a read of `activity` | `FAILED: a company role reads a student's row, and it is not on the list: activity/support_agent` — one role named, the other thirteen not |
| The volunteers policy is narrowed to own-row | `FAILED: on the list but no longer true — remove it: community_volunteers/trust_safety_senior community_volunteers/trust_safety_reviewer` |
| The fixture grants are revoked (every count would be zero) | `FAILED: a live platform grant of account_executive does not answer true for account:manage` |
| The probe floor raised above what it reaches | `FAILED: only 64 tables probed, the floor is 999 …` naming the tables not probed |
| A `prompt` column added to `gateway_intelligence_audit` | `FAILED: … changed shape (+prompt)` |
| `correlation_id` dropped from `gateway_audit` | `FAILED: … changed shape (-correlation_id)` |

Also from `app/`: see the pull request for `tsc -b`, `lint`, `npm test` and `docs:impact`.

## Why the COOP header was not added

The diff called it the one header worth adding. On inspection it is a risk that cannot be checked here. `Cross-Origin-Opener-Policy` cuts the link between a page and the window that opened it; a school that launches Semester in a *new window* from its LMS (`lti` function) may rely on that link, and there is no LMS to test a launch against in this environment. The app's own popups all use `noopener` and sign-in is a redirect, so they would be unaffected, and on GitHub Pages, where the app is served today, the header files do nothing. The gain is small and unmeasurable now. Revisit with a real LTI new-window launch test.

## Corrections to the diff

The diff said the grep guards were missing (they exist), left `approvals.ts` as "unconfirmed" (covered in SQL), and left per-request AI audit as "unconfirmed" (the institution gateway persists a content-free row per request in `gateway_intelligence_audit`; the shared-key Edge function path keeps monthly totals and reservations only). The diff itself now carries a section 8 recording these.

## Open gaps, highest priority first

1. **The `community_volunteers` / `trust_safety_reviewer` read** — privacy owner's decision (above). P1.
2. ~~The 8 inconclusive tables~~ — done in slice 2 (D-1298 below): all 64 probed, none inconclusive. The sweep still keys on `user_id`/`student_id`; other owner columns (`owner_id`, `created_by`, `account_id`, `subject`) are not swept. P2.
3. **Owner columns beyond `user_id` / `student_id`** (`created_by`, `subject`, `owner_id`, `account_id`, ...) are not swept. P2.
4. **The sweep reads through the table only.** What a `security definer` function a company role may call returns is each feature suite's job. P2.
5. **Shared-key Edge path** keeps no per-request row. Decide whether it should. P2.
6. **Not started from the work list:** the semester-core ports (provenance ladder and conflict resolution, freshness/projection-lag state, consequence pattern, access matrix), the free-text redaction scan (deliberately not built: the repo gates by declared field class and says it does not read free text; see the slice 2 decision), the blanket anon revoke (defence in depth), `student-files` and `course-materials` buckets, the outbox worker and projections. Each is its own change.

## What the next slice needs

- A decision on item 1 above, so the `TO NARROW` entry can be closed by a migration and a suite edit.
- Whoever picks up item 6: the free-text redaction scan is *not* the largest gap — it contradicts the repo's declared-field-class design (D-1298). Start with the blanket anon revoke or the owner-column widening.
- To run the policy suites in a session container: install `postgresql-17` from the PGDG repository, then `su postgres -c "cd <repo> && supabase/check.sh [suite ...]"`.
