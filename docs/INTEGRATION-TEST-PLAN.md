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

## Not yet covered (later phases)

Worker against a live database; webhook signature validation; reconciliation job; retention jobs; SIS/degree-audit mocks; tablet screenshots and a full device matrix (phone and desktop were driven in Chromium).
