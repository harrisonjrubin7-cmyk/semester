# Support, reliability and abuse prevention

Launch-readiness Phase 5. This is what exists, what is measured, and what is
not, written so that a procurement reviewer and the person on call read the
same page. It adds one thing to the product — support tickets, off by default —
and otherwise records what is already here against what a launch needs.

[`MONITORING.md`](../MONITORING.md) is still the operating document for noticing
things. This does not replace it, and it keeps its refusals: no automated
alerting from the database, no dashboard nobody opens. The status page refusal
was reversed on 28 September (`app/public/status.html`, #902); see §2.

## 1. Support tickets

**What it is.** A student asks Semester (the company) for help with the app. It
is not the Action Center's "Ask for help", which reaches a *campus office*
through `help_requests`, and not the Support screen, which is a map of campus
offices. Three different questions, three different doors, and the ticket panel
links to the Support screen so nobody asks the app about financial aid.

**Where it lives.**

| Piece | File |
| --- | --- |
| Tables, functions, limits | `supabase/migrations/20260928210000_support_tickets.sql` |
| Every rule walked with two students and an agent | `supabase/support-tickets.check.sql` |
| Client, and the six context keys | `app/src/lib/supporttickets.ts` |
| Client held to the migration's lists and hours | `app/src/lib/supporttickets.test.ts` |
| The panel on Help | `app/src/components/SupportTicketsPanel.tsx` |
| Nothing unticked is sent, and the preview shows all of it | `app/src/components/supportticketspanel.test.tsx` |

**The rules, and what enforces each.**

| Rule | Enforced by |
| --- | --- |
| Support never learns who asked: no account id, name or address in the queue or a thread | The two staff functions' return types; the check reads them with `pg_get_function_result` and fails on any identity-shaped column |
| App context is six named keys the student ticked, each a short string | `private.support_context_ok`, a check constraint, so no code path can store a seventh |
| Every detail starts unticked and is shown with its value before sending | The panel; its test sends with nothing ticked and asserts `want_context: {}` |
| Accessibility and privacy come first: high priority, 24-hour first-response target; everything else 72 | Computed in SQL from the category, not chosen by a person |
| Only the student closes a ticket; support may leave it open, waiting, or resolved | `support_reply` refuses `closed` |
| Five tickets per account per day | `open_support_ticket`; the check opens five, then fails the sixth |
| Deleting the account deletes classified tickets; a pre-classifier legacy record is detached, delivery-disabled and preserved for evidence-backed retention review | `forget_my_support_tickets`, named in `OWNED_TABLES`; `20261008195500_support_ticket_retention.sql` |

**Who answers.** An account holding `support_agent` at platform scope, which
already existed (`20260926150000_expansion_roles_and_features.sql`) with the
`support:ticket` capability and no tables behind it. When the agent needs a
student's data to help, that is the existing student-granted
`support_access_grant` — not this table.

**Switched on by** `VITE_SUPPORT_TICKETS` (`off` by default). An institutional
preview never turns it on: a ticket is a real message to real staff.

**Built since the first support slice.**

- **A staff screen.** The Operations Console now draws the identity-free queue,
  thread, approved context, SLA state, reply and resolution controls.
- **A notification to the student.** `support-reply-notify` sends a generic
  email hint through Resend after the in-app reply is committed. The endpoint
  rechecks the staff capability, never returns the student's address to the
  browser, omits the reply body from email, and uses the support message id as
  the provider idempotency key. An email failure does not erase the in-app
  reply and is shown to the operator.

**Still needed before this is turned on for a real cohort.**

- **A retention period for closed tickets.** `RETENTION.md` says so in bold.
- **A named owner and hours.** The first-response targets are computed; nobody
  is yet on the hook for them. See the SLO register below — `SLO-5` is
  `UNPROBED` for exactly this reason.
- **Production deployment and staffed UAT.** The function, configured sender,
  live notification receipt, operator reply and student readback must all be
  evidenced before `VITE_SUPPORT_TICKETS` is enabled.

## 2. Service levels

The register below maps each objective to the probe that could measure it, and
says honestly whether anything is measuring it yet. `phase5docs.test.ts` reads
this table: every probe it names must exist in the repository, and a row can
say `MEASURED` only if it names an evidence file under `docs/evidence/` that
exists. None does today. That is the true state: **Semester has probes and no
measured availability history**, which is why
[`PROCUREMENT_CHECKLIST.md`](market-readiness/PROCUREMENT_CHECKLIST.md) answers
"Uptime SLA" with **No**, and why nothing here should be quoted as a commitment.

Statuses: `MEASURED` (a history exists and is filed), `PROBED` (something
checks it on a schedule, no history kept), `UNPROBED` (nothing checks it).

| Id | Objective | Proposed target | Probe | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| SLO-1 | The public app loads and reaches its database | 99.5% of hourly probes pass, per calendar month | `.github/workflows/production-smoke.yml` running `app/scripts/public-production-smoke.mjs` | PROBED | — |
| SLO-2 | The institutional gateway answers, where one is configured | 99.5% of hourly probes pass, per calendar month | `.github/workflows/production-smoke.yml` running `app/scripts/production-smoke.mjs` | PROBED | — |
| SLO-3 | A merged migration reaches production the same day | No `MIGRATIONS_FAILED` branch record older than 24 hours | `supabase/ledger.snapshot`, held by `app/src/lib/migrationorder.test.ts`; the deploy itself only by the weekly look in `MONITORING.md` | PROBED | — |
| SLO-4 | Sync keeps writing | A pilot account's newest `state` row is under 7 days old during term | `supabase/health.sql` block 2, weekly, by a person | PROBED | — |
| SLO-5 | Support answers first within target | 24 hours for accessibility and privacy, 72 for the rest, for 90% of tickets | `supabase/migrations/20260928210000_support_tickets.sql` (`support_ticket_queue` returns `overdue`) | UNPROBED | — |
| SLO-6 | AI spend stays under cap | Provider alert fires at half the cap; no month exceeds it | `supabase/functions/claude/index.ts` (`MONTHLY_CALL_LIMIT`) and `supabase/health.sql` block 1 | PROBED | — |

`SLO-5` is `UNPROBED` even though the column it needs exists: nothing reads the
`overdue` flag on a schedule, and nobody owns the queue. Changing that is a
named owner and a weekly look, not more code.

**Built since this was written.**

- **A status page.** `MONITORING.md` §"What was deliberately not built" had
  declined one, because the thing watching it would be the thing that needs
  watching. The founder reversed that on 28 September: `app/public/status.html`
  (#902) checks from the reader's browser, `public/sw.js` passes its requests
  straight to the network, and incidents are written by hand into
  `status-incidents.json`. `app/src/lib/statuspage.test.ts` holds it. Still
  owed: a subscriber notification process (master register SRE-010).

**Not built, and deliberately so.**

- **A degradation banner.** The app shows sync status on the Account screen
  (`SyncStatus` in `app/src/state/store.tsx`) and works offline by design, so a
  database outage shows up to a student as "not synced", not as a broken app.
  A site-wide banner needs something to raise it — the same problem as the
  status page.
- **A read-only mode.** There is no switch that stops writes while keeping
  reads. The closest controls are per-feature flags and `set_invite_only`.
  Stating the gap is the honest answer until an incident shows it is needed.

## 3. Fraud and abuse inventory

What an abusive account could do, what stops it today, and what does not.
Nothing here scores a person: every control is a limit on an action, applied
the same to everybody, and none of them is hidden.

| Surface | Abuse | Control today | Gap |
| --- | --- | --- | --- |
| Sign-up | Open registration by scripts | `set_invite_only(true)` (`20260921002428_invites.sql`) during the pilot | Supabase Auth's own limits only once it opens; no CAPTCHA |
| AI (`claude` function) | Spend the shared key | Per-account `MONTHLY_CALL_LIMIT`, provider spend cap (`MONITORING.md`) | None known beyond the caps' ordering, which `MONITORING.md` says to write down |
| Institutional gateway | Hammer an institution's systems | `app/server/institution/rate-limit.ts`, per institution and user, 60 a minute | — |
| Direct Supabase RPCs from a signed-in account | Call a function in a tight loop | Row-level security bounds *what* can be touched, not *how often* | **Writes are limited; calls are not.** `20260928230000_direct_rate_limits.sql` puts a per-account sliding window on inserts into fourteen tables that reach other people or staff queues (messages, reports, feedback, help and mentor requests, community posts, groups, opportunities, form answers), including inserts made inside definer RPCs. A signed-in script can still *call* any granted RPC, and read, as fast as the platform allows. That remains the largest open item on this page |
| Support tickets | Bury the queue | Five per account per day, in SQL | — |
| Help requests to campus offices | Flood an office | A destination receives requests only when the school set `accepts_requests`; sensitive offices never do (`20260927230000_help_requests.sql`) | Ten per student per hour, on the `help_requests` insert that `send_help_request` makes (`20260928230000_direct_rate_limits.sql`). A tighter daily cap like support tickets' is that feature's owners' call |
| Private beta feedback (#814, open) | Flood feedback | Membership is invite-only | — |
| Calendar feed tokens | Guess a token | 192-bit tokens (`20260901000800_calendar.sql` explains why a rate limit would not help) | — |

**What the gap needs.** A per-account limit on RPCs is not something a migration
can add cheaply — a counter table written on every call makes every call a
write. The realistic options are Supabase's own rate limiting when it is
available on the plan, or putting the heaviest RPCs behind an Edge Function
with a limiter like the gateway's. Neither is done here; both are recorded so a
reviewer is not told the surface is covered.

## 4. What this phase does not claim

No uptime SLA, no measured availability, no support hours, no on-call rota, no
SOC 2 control mapping. Each is a line in the register above or in
`PROCUREMENT_CHECKLIST.md` with its real status.
