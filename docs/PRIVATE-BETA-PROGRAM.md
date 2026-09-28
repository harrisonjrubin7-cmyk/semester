# Private Beta Program

How Semester runs an invite-only beta: who can be in it, what they agree to,
what the database enforces, and how a program is started, run and closed.
Launch-readiness Phase 1.

| Where | What |
| --- | --- |
| `supabase/migrations/20260928220000_private_beta.sql` | Tables, capabilities and the sixteen functions that are the only way in |
| `supabase/beta.check.sql` | 42 checks, walked by a manager, a triager, an invitee, an unconfirmed address and a stranger |
| `app/src/lib/beta.ts`, `app/src/components/BetaPanel.tsx` | The member's half, on Help. `VITE_PRIVATE_BETA` decides whether invitations are offered; a member's view and way out do not depend on it |
| `app/src/lib/beta.test.ts`, `app/src/components/betapanel.test.tsx` | The client held to the migration's vocabulary, and the panel's behaviour |

## The rules, and where each is enforced

| Command rule | Enforced by |
| --- | --- |
| Invite-only | An invitation adds the address to `public.invites`, the existing sign-up gate on `auth.users`. Turn the gate on with `select public.set_invite_only(true);`. The beta adds no second gate |
| No irreversible official transactions | `beta_set_status(..., 'active')` is refused unless `kill.writeback` is engaged for the program's school, or globally for a program with no school. If the switch is later released, `my_beta()` reports the program as not live, and every member sees "paused". `beta_feature_flags` refuses any `writeback.*` or `kill.*` key |
| Cohorts and their sizes | `beta_cohorts.kind` is one of the six in the command, and each is capped at the top of its range: students 50, transfer 25, faculty/TAs 15, advisors/staff 10, accessibility testers 10, tenant admins 5. An open invitation holds a seat, so a cohort cannot be over-invited |
| Explicit feature flags | `beta_declare_flag` records what the program turns on, and members see the list. Flag *state* stays in `tenant_feature_policy` and the `lib/flags.ts` evaluator |
| Clear feedback and support channel | In-app feedback to `beta_feedback`, plus `support_contact`, a human route that every program must have |
| Known-issues page | `beta_known_issues`. Only published issues are shown, and only to members of that program |
| Export / exit path | "Leave the beta" links to Export first, and ends membership in the same statement. It asks whether to keep the account. Deleting the account uses the existing flow on Privacy |
| Weekly review | Operational: `beta_feedback_queue` sorts accessibility reports first. See *Running a program* |
| Rapid rollback | Leave `VITE_PRIVATE_BETA` unset and no invitation is offered, so nobody new joins. A member still sees their beta, its export and **Leave the beta**, because they were told before joining that they could leave at any time; the flag does not take that back. `beta_set_status(..., 'paused')` pauses the program for every member without touching their data |
| No sponsor or advertising campaigns; no unsupported claims | Nothing in this change sends anything. The join screen makes four statements, and each is true of the code |

## What a member agrees to

The panel shows these before the Join button. They are the only claims the
beta makes:

1. Some features may change or be switched off while the beta runs.
2. Nothing official is sent anywhere. No registration, grade or form goes to
   the university. The database enforces this: the program cannot be active
   while writeback is possible.
3. Beta feedback is read by Semester's support staff without the member's
   name or address. `beta_feedback_queue` returns no column that could
   identify the sender, and `beta.check.sql` asserts it.
4. They can leave at any time and take their data with them first.

Being invited is not being enrolled. An invitation is only visible to an
account whose **confirmed** address matches it, and joining is a button the
member presses.

## Who can do what

| Capability | Held by | Allows |
| --- | --- | --- |
| `beta:manage` | `platform_admin` | Create programs and cohorts, invite and revoke, declare flags, change status |
| `beta:triage` | `platform_admin`, `support_agent` | Read the feedback queue (no identities), set feedback status, post and publish known issues |

Every beta table has RLS on, no policy and no grant. The functions are the
only way in.

## Running a program

Run as an account that holds `beta:manage`, from the SQL editor or a script
using that account's session:

```sql
select public.beta_create_program('fall-pilot', 'Fall pilot', 'vanderbilt', 'beta-help@example.edu');
select public.beta_add_cohort('fall-pilot', 'students', 40);
select public.beta_add_cohort('fall-pilot', 'accessibility_testers', 8);
select public.beta_invite('<cohort id>', 'student@example.edu');
select public.beta_declare_flag('fall-pilot', 'module.source_freshness_cards', 'From your school on Today');

-- kill.writeback must be engaged for the school first (killswitch:engage)
select public.beta_set_status('fall-pilot', 'active');
```

Weekly:

1. `select * from public.beta_feedback_queue('fall-pilot');` Accessibility
   reports come first.
2. Publish what members should know:
   `select public.beta_post_issue(null, 'fall-pilot', 'Title', 'Detail', 'Workaround', 'open', true);`
3. Review exits in `beta_exit_requests` (service role). Count them and read the
   reasons. There is no way to contact the person from here, and that is by
   design.

Close with `beta_set_status('fall-pilot', 'closed')`. A closed program cannot
be reopened or send invitations.

## Not in this change

- **A staff screen.** The staff half is SQL functions only. A console belongs
  with the support tooling in Phase 5.
- **`beta_test_scripts` and `beta_outcome_snapshots`.** The test script is
  [`GOLDEN-PATH-TEST-SCRIPT.md`](GOLDEN-PATH-TEST-SCRIPT.md). Outcome
  snapshots need the minimum-cohort threshold the Phase 0 audit calls for
  before any aggregate is reported, and they wait for that decision.
- **A clock on unused invitations.** `RETENTION.md` says so.
