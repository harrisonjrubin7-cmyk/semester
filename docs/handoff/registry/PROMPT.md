# Build Semester from the capability registry

Paste into Claude Code or Cursor with the `semester` repo open and this design system available.

```
Source of truth: handoff/registry/capabilities.json (118 capabilities, 8 workspaces).
Each entry: id, workspace, routes, actors, permissions, records, commands, events, screen types, design reference.

PHASE 0 — Inventory (no code changes). Read handoff/REPO-CROSSWALK.md: the repo already has many of these tables and screens.
For every capability, report: route mounted? component? tables exist? commands exist? tests?
Status per capability, the seven-level ladder: specified | schema-present | code-present | connected | tested | deployed | operational. Commit as docs/registry-status.json.
Reconcile records against the repo's supabase/migrations (extend, never duplicate).

PHASE 1 — Foundations (already specified)
Apply handoff/semester-platform migrations 130–210 after reconciling. Run RLS tests.
Proposed tables not yet in any migration (0): none. Every record a capability names now has a table in 010–210.

PHASE 2 — Build capabilities in this order, one PR per capability:
  1. edu.registration, edu.advising, inst.handoffs     (pilot critical path)
  2. company.support, edu.support_access, ops.support_session
  3. shared.org.memberships, shared.authz.grants, inst.integrations
  4. remaining edu.*, then inst.*, then company.*, ops.*, acct.*, dev.*

PER CAPABILITY, DONE MEANS:
- Route mounted behind the listed permissions; server enforces the same check (ctl.can).
- Uses the design reference (ui_kits/<design>/) and DS components only.
- Real queries/commands; loading, empty, validation, permission-denied, failure states.
- Writes only through api.* functions: validate, authorize, write, audit.log, ctl.outbox, one transaction.
- Tests: allowed actor succeeds; other tenant denied; unauthorized role denied; idempotent retry.
- Emits the listed events. Updates docs/registry-status.json.
Never mark a capability implemented without a passing test. Never fabricate figures.
Stop and ask before: production deploys, grants in production, contract or legal text, notifications to real people.
```
