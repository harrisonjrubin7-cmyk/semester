# Semester institutional preview — local operator guide

## Start

From a clean checkout with Node.js 22 and npm available:

```bash
cd app
npm ci
npm run preview:institutional
```

Open `http://127.0.0.1:4179/`. The launcher enables the institutional preview for this process only. It does not change an environment file, account, school assignment, verified grant, database, or production deployment.

Use a different local port with `npm run preview:institutional -- --port 5180`. The default binds only to loopback. To expose the development server deliberately, pass a host explicitly, for example `--host 0.0.0.0`; this makes the preview reachable from the local network and should be used only on a trusted network with the operating-system firewall enabled.

## Restart and stop

Press `Ctrl-C` in the launching terminal to stop the server. Restart by running `npm run preview:institutional` again. If the chosen port is already occupied, the launcher exits instead of silently choosing another address.

## Verify the built preview

The browser smoke uses a scratch Playwright installation because browser automation is deliberately not an application dependency:

```bash
mkdir -p /tmp/semester-smoke
cd /tmp/semester-smoke
npm init -y
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
cd /path/to/semester/app
VITE_INSTITUTIONAL_PREVIEW=true npm run build
SMOKE_PLAYWRIGHT=/tmp/semester-smoke/node_modules/playwright npm run smoke:institutional
```

If no Chrome or Edge executable is installed, omit `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and run `npx playwright install chromium` in the scratch directory. The smoke starts and stops its own loopback Vite preview server. It probes Home, Calendar, Study, When you are behind, University, Email, and Search on desktop and phone; checks keyboard entry, one application root, one main landmark, and one institutional primary navigation; prepares a local recovery draft; switches from Northstar to Cedar Coast; and verifies the draft does not cross that boundary before opening the Cedar Coast student-success workspace.

Verify the production-default build separately:

```bash
VITE_INSTITUTIONAL_PREVIEW=false npm run build
EXPECT_INSTITUTIONAL_PREVIEW=false \
  SMOKE_PLAYWRIGHT=/tmp/semester-smoke/node_modules/playwright \
  npm run smoke:institutional
```

The flag-off smoke checks the same routes and viewports while asserting that no preview bar, Flight Plan module, or `semester.flight-plan.*` storage key appears.

## What the preview adds

The preview extends the existing Semester routes; it does not introduce another shell:

- Home: one ranked Flight Plan decision and bounded weekly load.
- Calendar: source confirmation, focused sessions, capacity, and overflow.
- Study: sample practice evidence with prerequisites, hints, explanations, and sources.
- When you are behind: reschedule, reduce, and prepare-help choices that do not alter source deadlines.
- Email: local, reviewable drafts marked unsent.
- University: role-aware synthetic workspaces for students, faculty, advisors, student-success staff, administrators, moderators, employers, and authorized payers.

Institution and persona selectors change only synthetic presentation context. They do not grant production authorization.

## Deployment boundary

This workflow is local preview and verification only. Production deployment, institutional data connections, migrations, and tenant activation require separate approval and the rollout gates documented in this package.
