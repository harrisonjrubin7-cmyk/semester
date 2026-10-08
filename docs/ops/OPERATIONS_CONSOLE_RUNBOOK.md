# Operations console: runbook

Procedures for operating the console and its projection pipeline. Sections 3 to
5 describe what to do **once Phase 1 exists**; today only sections 1, 2 and 6
apply. Say so on the page if you copy any of it elsewhere.

## 1. Working in the repository

Every command runs from `app/`, except install, which runs from the repo root.

```bash
npm ci                      # root: links the workspaces
cd app
npx tsc -b
npm run lint
npm run check:university
npm test
npm run test:shuffle
npm run build
npm run registers           # after editing app/src/lib/ops/console.ts
npm run docs:impact
```

SQL checks run through `supabase/check.sh` (throwaway Postgres, every migration
applied twice, then each `*.check.sql`, each rolled back).

Before starting anything, check main for the same work (`CLAUDE.md`):
`git fetch origin main && git log --oneline -30 origin/main`, then grep for the
defect, not the title.

## 2. Safe production inspection (read only)

Allowed during the audit and when diagnosing: catalog queries
(`pg_class`, `pg_policies`, `pg_proc`, `information_schema`), advisor output, row
**counts**. Not allowed: selecting rows from billing, support, trust, privacy,
audit, student tables; any `INSERT/UPDATE/DELETE/DDL`; `GRANT/REVOKE`; changing a
function. All changes are migrations, reviewed, tested on a non-production
project first, then applied.

## 3. Projection health (after Phase 1)

Read `ops_projection_dashboard`. For each projection:

| Signal | Meaning | Action |
|---|---|---|
| `fresh` | within SLO | none |
| `stale` | lag over the stale threshold | check the worker ran (cron history); check events behind; the UI already disables high-risk actions |
| `failed` | over the failed threshold or last run errored | read the sanitized error class, fix cause, let retries drain; if dead-lettered, section 4 |
| `unknown` | no watermark | the projection has never run; do not treat as healthy |

Never fix lag by editing a projection row. Fix the cause and let the worker
catch up, or run a rebuild (section 5).

## 4. Dead letters

1. Open the inbox item. It names the event type, aggregate, attempt count and a
   sanitized error class. It never shows the payload.
2. Decide: **fix and replay**, or **accept and discard**.
3. Replay is `ops_replay_dead_letter(event_id, evidence)`. It needs the
   capability, writes a console audit event, and is idempotent (the receipt key
   stops a double effect).
4. Discarding is an approval-class action with a reason recorded.
5. Never delete from `domain_outbox_events` by hand.

## 5. Rebuild

1. Create a rebuild run for the projection in shadow (blue/green).
2. Wait for replay to finish and `parity_ok`.
3. Flip the registry pointer. Keep the previous version until the next good
   rebuild.
4. If parity fails, do not flip. File the diff in the inbox.

## 6. Break-glass (exists today)

1. Requester files `request_approval` for duty `break-glass` with evidence and a
   ticket. It needs `breakglass:request`.
2. Two approvers decide with fresh MFA (15 minutes). The requester cannot
   approve.
3. `console_act` executes. Access lasts at most 4 hours and expires on its own;
   `has_capability` stops honouring it at `expires_at`.
4. The subject may close it early. A security or founder seat who is not the
   subject must review it afterwards. An overdue review blocks that approver and
   appears in the command-center queue.
5. **Known gap:** the audit chain has no rows in production, so this path has
   never run for real. Rehearse it on staging and confirm a chain row appears and
   the daily seal verifies before depending on it. `my_capabilities()` will not
   list break-glass capabilities, so the screen may not offer an action the
   database would allow.

## 7. Incident handling for the console itself

If the console shows data it should not (a scope leak): treat as a security
incident. Disable the view (feature flag), revoke execute on the offending RPC
through an emergency migration with security review, preserve the audit trail,
and notify using the existing incident-notice process
(`governance_incident_notices`, `docs/CRISIS-RESPONSE-RUNBOOK.md`). Do not fix by
adding a client-side filter.

## 8. What not to do

- Do not give the browser a service-role key, for any reason.
- Do not add a table browser for any sensitive domain.
- Do not add a UI check and call it authorization.
- Do not revoke a grant or change a SECURITY DEFINER function without reading
  who calls it (`lib/definerregister.ts`, `docs/DEFINER-RLS-REGISTER.md`,
  `grants.check.sql`).
- Do not skip, disable, or weaken a failing test to get green.
