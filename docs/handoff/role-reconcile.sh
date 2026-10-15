#!/usr/bin/env bash
# Phase 0 — role-system reconciliation. Read-only except for the new branch. Stops on the first failing gate.
# Run from an empty directory: bash role-reconcile.sh
set -euo pipefail
has() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }
run_if() { if has "$1"; then echo "▶ npm run $1"; npm run "$1"; else echo "· skip $1 (not defined)"; fi; }

[ -d semester ] || git clone https://github.com/harrisonjrubin7-cmyk/semester.git
cd semester
git checkout -B audit/role-system-reconciliation

npm ci
echo "Root scripts:"; npm run || true

cd app
npm ci
echo "App scripts:"; npm run || true

run_if lint
run_if test
run_if build
for s in typecheck test:integration test:rls test:a11y test:e2e security secrets; do run_if "$s"; done

cd ..
mkdir -p docs/role-reconciliation
# Role and capability vocabulary straight from migrations (no database needed)
grep -hoE "^\s*\('[a-z_]+',\s*(true|false)\)" supabase/migrations/*.sql | sed -E "s/^\s*\('([a-z_]+)'.*/\1/" | sort -u > docs/role-reconciliation/roles.txt
grep -hoE "^\s*\('[a-z_]+:[a-z_:]+'," supabase/migrations/*.sql | sed -E "s/^\s*\('([^']+)'.*/\1/" | sort -u > docs/role-reconciliation/capabilities.txt
echo "roles: $(wc -l < docs/role-reconciliation/roles.txt) · capabilities: $(wc -l < docs/role-reconciliation/capabilities.txt)"
echo
echo "STOP. Open Claude Code at semester/ and paste the prompt in design/handoff/execute/18-role-system.md (section \"Paste this\")."
echo "Copy design/handoff/specifications/*.pdf to docs/specifications/ first."
