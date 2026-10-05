#!/usr/bin/env bash
# Preflight: confirms tools and project shape before any stream runs. Exits non-zero with the exact fix.
set -uo pipefail; fail=0
need() { command -v "$1" >/dev/null 2>&1 || { echo "MISSING $1 — $2"; fail=1; }; }
need node "install Node 20+"; need npm "comes with Node"; need npx "comes with Node"; need git "install git"; need docker "Supabase local needs Docker running"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 20 ? 1 : 0)' || { echo "Node 20+ required"; fail=1; }
npx --yes supabase --version >/dev/null 2>&1 || { echo "MISSING supabase CLI — npx supabase works once network is available"; fail=1; }
[ -d supabase ] || { echo "No supabase/ — run: npx supabase init"; fail=1; }
[ -f "${APP:-app}/package.json" ] || { echo "No ${APP:-app}/package.json — set APP=<dir> to the web app"; fail=1; }
grep -q '"next"' "${APP:-app}/package.json" 2>/dev/null || echo "NOTE  ${APP:-app} is not a Next.js app. API routes in app/api/* need a Next.js app (see BUILD.md §2 'App target')."
git diff --quiet || echo "NOTE  working tree has uncommitted changes; streams expect a clean branch"
[ $fail = 0 ] && echo "PREFLIGHT OK" || { echo "PREFLIGHT FAILED"; exit 1; }
