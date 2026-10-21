# Make the Operations Console discoverable

Paste into Claude Code or Cursor with `harrisonjrubin7-cmyk/semester` open. Background: `docs/operations/Operations Console Visibility.html` in the design system.

```
Make Semester's existing Operations Console discoverable and prove one workflow.
Do NOT create a separate app, hosting project, permission model or admin role.

FACTS (verify, don't assume):
- Console: app/src/screens/Console.tsx at #/console; gate = cloudConfigured && account && holdsConsole(grants).
- Workspaces: app/src/lib/console/workspaces.ts (17; capability-gated via visibleConsoleWorkspaces).
- Deliberately unlinked: NESTED in app/src/lib/nav.ts.
- Audit: OPS-CONSOLE-DISCOVERY-AUDIT.md; map: docs/OPERATIONS-CONSOLE-MAP.md.

PHASE A: Return a visibility matrix per workspace: route, component, nav entry,
capability + scope, flag, backend RPC/migration, local status, deployed status.
Classify: documented only / logic only / not mounted / mounted-undiscoverable /
permission-blocked / flag-off / backend incomplete / local only / deployed+verified.

PHASE B: Add an "Operations" entry (account menu or workspace switcher) rendered
only when holdsConsole(loadMyCapabilities()) is true. No entry for anyone else.
Keep the console's own gate unchanged.

PHASE C: Dev/staging only. Document provisioning of one operator test user
(console:operate @ platform + support:ticket) and one student test user through
the existing role_grants path. No auto-grant by email or ownership.

PHASE D: Prove Support end to end with supportTickets enabled in dev:
list → detail → assign/status → persisted → refresh → audit visible.
Tests: operator sees entry; student sees no entry, gets the notice at #/console,
and direct RPC calls are refused; cross-tenant read refused.
Run from app/: npx tsc -b, npm run lint, npm test, npm run build; supabase/check.sh.
Report anything skipped. Do not invent passes.

DELIVER: why it was hidden, files changed, exact local start command and URL,
test identities, test results, local vs deployed status, remaining gaps.
Do not deploy, change production grants, or send notifications without approval.
```

## Design reference
`ui_kits/console-entry/index.html` in the design system: account menu → Workspaces → "Semester" / "Operations" (only with console:operate), the gate notices verbatim from Console.tsx, and the workspace filter from workspaces.ts. Build it with the app's existing menu components, not this mock.
