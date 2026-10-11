# Integration test plan

What runs, where, and what each proves. Figures are from the run recorded in the pull request.

## Commands

```bash
supabase/check.sh integration-control-plane   # the new suite
supabase/check.sh                             # every suite (35)
supabase/rehearse.sh                          # pending migrations onto production's shape
cd app
npx tsc -b && npm run check:university
npm run lint
npm test && npm run test:shuffle
npm run build
```

## Existing-app preservation

| Requirement | Evidence |
| --- | --- |
| Existing route/nav/component tests pass | full `npm test`, `test:shuffle` |
| Existing RLS/capability suites pass | all 35 `check.sh` suites; `capabilities` counts updated by exactly the added roles and rows |
| Existing data unchanged | `rehearse.sh`: invite gate and course rows unmoved |
| Every expansion off in an ordinary build | `experience-preservation.test.ts` includes `integrationDashboard: 'off'` |

## Schema and RLS — `supabase/integration-control-plane.check.sql` (71 checks)

RLS on for all 13 tables; no `USING (true)`. Tenant A vs B for connections, scopes, pause, replay, canonical
references, audit. Student sees no integration table and only their own references. Integration admin cannot
read the credential column, cannot approve, cannot read a student's reference. University admin cannot pause,
cannot approve their own connection. Status/approval not writable directly. Constraints: token as reference,
T4 ceiling, unapproved healthy, unapproved write direction, never-list scopes, T3 without owner, T4 reference,
clear-text external id, run counts. Idempotent webhook. Kill switches global vs school, reason required, replay
refused while engaged. Classification: loosen refused (constraint and trigger), tighten allowed. Audit: written,
stripped of credential and cursor, attributed to requester/approver, invisible to another school.

**Proving the guard.** Each of these edits to the migration was made and turned the suite red, then reverted:
credential column granted; never-list constraint neutralised; owner self-approval allowed; audit stripping
removed; kill switch ignored on replay; subject filter dropped from the tenant-wide reference policy. The last
one first passed — the only student row was T3, which the classification filter also hid — and a T1
student-owned row was added so the ownership test stands alone.

## Feature flags — `app/src/lib/flags.test.ts`

Disabled by default for every key; enabled for the right school and capability; tenant scope; role scope
(capability and `permitted_roles`); preview vs production states; global and school kill switches, and a
per-connection switch; connection and scope gates; classification; course rule; user eligibility; expiry as the
rollback state; registry metadata (owner, review, expiry, high-risk); kill-switch names match the SQL; every key
documented in `FEATURE-FLAG-REGISTRY.md`.

## Gateway — `app/src/lib/integration/pipeline.test.ts`, `classification.test.ts`

Adapter contract (mock accepted; raw secret, never-list scope/field, unflagged write, over-ceiling refused).
Mapping and transform. Idempotent webhook. Kill switch, paused, unapproved. Each conflict kind. Scope failure
(cursor not advanced). Timestamp regression and unchanged. Deletion. Subject resolution and consent. No external
id in errors; sanitizer; per-school salt. Back-off, dead-letter, Retry-After, rate limit per school. Freshness
states and the official-record rule. Vocabulary matches the SQL. Classification floor matches the seed.

## Dashboard — `IntegrationDashboard.test.tsx`

Every domain drawn, unconnected ones honest. Diagram ↔ table equivalence (a table missing a row turned it red).
Status as words; screen-reader description per node. Keyboard tab movement. No credential, owner id or row id in
any view (a detail panel rendering the whole row turned it red, after the test was fixed to check each view
while it is on screen). Pause needs a reason and a second press. A database refusal is shown as a refusal.
Load failure shown as an alert.

## LTI binding — `supabase/lti-integration.check.sql` (32 checks), `app/src/lib/ltigate.test.ts`

Only the service role may call either function. Unbound registration keeps passback; a global stop reaches it; a
school's stop does not. Bound: each gate in order (module, flag, preview ≠ production, approval, configuring,
read-only direction, scope missing, scope expired) and then all open; school, other school's, and connection kill switches; paused;
flag off as rollback. A launch records one tenant-wide T0 context reference (re-launch updates it), moves the
connection to healthy, and records nothing when unbound, paused or stopped. The binding cannot name a
connection without its school, or another school's connection. Five deliberate breaks of the migration
(unbound before the global stop, scope check removed, preview accepted, paused still recording, connection stop
ignored) each turned it red. The TypeScript reader covers every word the SQL can return, the deploy-window
case, closing on other errors, and that `/score` asks before it signs or fetches.

## SIS and degree audit — `mock-sis.test.ts`, `school-records.test.ts`, `schoolrecords.test.tsx`, `canonical-display.check.sql` (15 checks)

Mock declarations valid, read-only, mocks; personal facts T3 and tenant-wide T0. Tenant-wide facts carry no subject; an
enrollment is tied to its student only with consent; a hold keeps office and link and never its reason or amount; a
grade inside an enrollment is refused; enum and required-field conflicts. The never-display list matches the SQL
trigger word for word. Freshness decays by kind and never improves; windows that closed and non-https links are
dropped; "no hold on record" only from fresh feeds. On screen: the Today section appears with the flag on, and not
with it off, under the kill switch, or with nothing shared; the Privacy panel appears with the flag off; Delete
reaches the database filtered to the student and the kind; Revoke marks the consent revoked rather than deleting it.
In SQL: reason, amount, grade, nested, array and oversized `display` refused (an ordinary key is the control);
only the student deletes their own row, never the school's tenant-wide one, and still cannot write one.

Deliberate breaks, each turning its suite red: delete without the student filter; Privacy panel gated on the flag;
delete policy `using (true)`; `reason` dropped from the trigger. The first run of the SQL suite also found a real
bug — lax JSON path mode unwrapped arrays, so `{"students":[…]}` was accepted — fixed with `strict`. Writing the
component test found another: the cards flag required a connection no student can read, so the section could
never have appeared.

## Campus, advising, career and bursar — `mock-campus.test.ts`, `school-records.test.ts`, `schoolrecords.test.tsx`

Nine mock declarations valid, read-only, within their domain ceilings; personal records only for advising and bursar,
with consent; every connector flag registered, high-risk and off. Sensitive declarations refused (a health scope, a
`notes` field, a financial-aid scope). An appointment keeps time, office, mode and prep link; one carrying
`instructor_notes` is refused; a referral drops its reason; a bursar item drops amount and balance; alerts refuse an
unknown level. On Today: emergencies before advisories, expired alerts dropped, the caveat always present and the alert
rendered first; a 15-minute-old alert is not official; a bursar item is told from an alert by whose it is; the next
appointment within 30 days, one career deadline within 14 days, one event within 7. Three deliberate breaks (caveat
removed, a student's own item shown as an alert, the bursar item given the alert's freshness target) each turned it red.

## Hardening — `worker.test.ts`, `integration-hardening.check.sql` (19), `integration-rls-matrix.check.sql`

**Worker** (12 tests, an in-memory table stand-in that enforces the idempotency constraint): refuses a mock unless told,
an unapproved/paused/disconnected connection, every kill switch but another school's, a wrong domain and an invalid
declaration; writes references with display values and moves the connection to healthy with its cursor; ingests a
redelivered batch once; stops importing a deprovisioned student and records why without naming them; never
resolves through another school's identity or consent; honours revoked consent and expired scopes; records a provider
failure with a sanitized message, retries, and dead-letters on the fifth attempt; reconciles in both directions.
Four deliberate breaks (tenant filters dropped, any school's kill switch accepted, scope expiry ignored, duplicates
ingested) each turned it red.

**Retention** (service role): who may call; health flags a stale live connection and not a fresh one and counts open
errors; the sweep removes exactly the old rows in each table and none of the recent, open or live ones; a held
connection keeps everything; the sweep is logged and readable by the school's integration admin and not by a student;
a hold needs a reason. Two breaks turned it red; a third (the log readable by anyone) did not until the student case
was added — and it is now also in the control-plane suite's `using (true)` scan.

**Matrix**: 13 tables × {signed out, student, another school's integration admin, the school's integration admin}
for read, update and delete; fails if an integration table exists that the list omits.

**Dashboard, in a browser** (Chromium, the app's dev build with the flag on): at 320 (the 400%-zoom reflow width the
accessibility smoke uses), 768 and 1280 CSS pixels, in all five views and the table: no element past the viewport
outside the tables' own scroll boxes, no unnamed control, no broken ARIA reference, one main; arrow keys cycle the
view tabs and Tab reaches a map node that Enter opens. Controls: a planted unnamed button and a dangling
`aria-describedby` were reported; a planted 900-pixel element was reported at 320 and 768. The first version of the
overflow probe measured the dashboard's own box, which the grid keeps inside the viewport whatever its children do,
and reported the planted element as clean — it was replaced with a per-element check before these figures were taken.

## Found by the Codex review of #779, after merge

Each was reproduced as a failing test on main before its fix, then passed with it.

| Finding | Reproduced by | Fix |
| --- | --- | --- |
| The service role could not execute `private.public_id`, so every worker run failed opening | `integration-hardening.check.sql` inserts a run and a source record as the service role: `permission denied for function public_id` | `20260927210000_integration_review_fixes.sql` grants it |
| The worker never read the connector flag | `worker.test.ts`: absent, `off` and `preview` flags all ran | the worker requires `production` for the adapter's flag at the school |
| A batch that failed to save stayed "processed", so its retry was skipped as a duplicate | `worker.test.ts`: the redelivery ingested nothing | a run that failed for a retryable reason releases its event claim (narrowed after #808, below) |
| Two connections to one product overwrote each other's records on a shared id | `integration-control-plane.check.sql`: the second connection's row hit the unique key; `worker.test.ts`: one row for two connections | identity includes the connection (unique index; `nulls not distinct` dropped after #808, below); the worker and `lti_record_context` upsert on it |
| "No registration hold on record" from a fresh window and no hold data at all | `school-records.test.ts` | the sentence needs fresh hold data that blocks nothing |

The existing school-records test had encoded the fifth as correct and was rewritten. The worker test's in-memory table
stand-in had an insert that fell through to its read path once a delete branch was added; the type check caught it,
and the three new tests were re-run against main's worker with the corrected stand-in to confirm they fail there.

## Found by the Codex review of #808, after merge

| Finding | Reproduced by | Fix |
| --- | --- | --- |
| Removing two connections that shared a record failed: `on delete set null` left two rows identical under a `nulls not distinct` index | `integration-control-plane.check.sql`: `duplicate key value violates unique constraint "canonical_entity_references_identity"` | `20260927220000_integration_orphan_identity.sql` recreates the index nulls-distinct. Nothing upserts a reference without a connection |
| Releasing the claim on *every* failed run re-ingested and re-logged a batch refused for good (consent, scope, schema, classification) on every redelivery | `worker.test.ts`: the redelivery ran again and logged a second error | the claim is released only when an error is retryable; otherwise the event is kept as `rejected` and a redelivery is a duplicate |

## Scheduler — `tick.test.ts`, `registry.test.ts`, `integrationtick.test.ts`, `edge-integration.test.ts`, `integration-tick-auth.check.sql`, `retention.test.ts`

**What the tick runs:**

- a due connection is pulled from its cursor;
- a connection that is not due, not pulled, unapproved, paused, disconnected or unregistered is not run;
- the registered Canvas adapter still runs nothing without valid connection-scoped auth, credential reference and hosted-Instructure origin;
- an invalid Canvas origin opens no run and makes no provider call.

**Kill switches and refusals:**

- the global switch, engaged or unreadable, stops the tick;
- a school switch is left for the worker to refuse, and the refusal writes nothing.

**Failures and dead letters:**

- a failing connection's attempts are counted, so its fifth failure dead-letters;
- after that it is held for an operator rather than dead-lettered every tick.

**Replays:**

- a requested replay runs once per connection and resolves its letters;
- a replay that fails again is handed back to the operator;
- a letter whose school is not its connection's school is never replayed.

**Limits:**

- the run cap and the time budget are both kept, oldest attempt first;
- one run that throws does not stop the rest.

**The `integration-tick` Edge Function:**

- it answers 503 without service credentials, or when the database cannot check the token, and never runs then;
- it answers 401 to a wrong, missing or malformed token, and 405 to anything but POST;
- a failed tick says only that it failed.
- The token check accepts the Vault secret and nothing else: one character off, a prefix, empty or null are refused,
  with no secret stored everything is, and only the service role may call it. Making it return true, or granting it to
  `authenticated`, each turned `integration-tick-auth.check.sql` red.
- The function runs a generated copy of the tick (`app/scripts/edge-integration.ts`). `edge-integration.test.ts` fails
  when the copy differs from the source; changing `DEFAULT_RETRY` without regenerating turned it red.
- `deno check` passes on `supabase/functions/integration-tick/index.ts`.

**The schedule is pinned:**

- the job fires every `TICK_MINUTES` and is parked;
- its address and token come from Vault;
- the sweep is daily and not parked.

**The registry:** it refuses a mock and a double claim. A control shows that rule catches both.

**Found by the Codex review of #811, before merge.** Each was written as a failing test before its fix, and reverting
the fix turns it red again:

- a failing `configuring` connection restarted at attempt 1 every tick and never dead-lettered;
- an unreadable hold lookup let held connections be pulled;
- replays were capped by row, so one connection's thirty requests shut out another's one;
- the connection's own `freshness_target` was ignored in favour of the adapter's.

Each tick rule was checked by reverting it: the hold, the attempt count, the replay's resolve and withdraw, the school
check, one pull per connection, the run cap, the skip count and the fail-closed switch each turned a test red. So did
un-parking the job and changing its cadence. `scheduler.sql` was also applied twice to a scratch Postgres with
stubbed cron, vault and net schemas. That produced both jobs once, with the sync job inactive. The job's body then
posted to the Vault address with a bearer token.

## Two classification layers — `classification.test.ts`

The platform floor matches the migration's seed row for row, and the AI Toolkit's gate (`lib/toolkit/classification.ts`)
is walked for every tier, action and course-AI answer: whenever it allows, the floor must allow the matching
destination. Restoring the old floor (T2 kept out of Community) turned three tests red.

## Not yet covered

A live provider; webhook signature validation (no webhook endpoint exists); the worker against PostgREST rather than a stand-in; the scheduled tick against a deployed endpoint (the job is parked); tablet hardware and screen-reader software (the pass above is automated). 
