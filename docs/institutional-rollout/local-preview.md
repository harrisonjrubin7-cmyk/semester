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

If no Chrome or Edge executable is installed, omit `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and run `npx playwright install chromium` in the scratch directory. The smoke starts and stops its own loopback Vite preview server, probes the approved desktop and phone routes, and exits nonzero on missing navigation, route drift, absent synthetic disclosure, or browser errors.

## Deployment boundary

This workflow is local preview and verification only. Production deployment, institutional data connections, migrations, and tenant activation require separate approval and the rollout gates documented in this package.
