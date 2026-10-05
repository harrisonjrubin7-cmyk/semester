#!/usr/bin/env bash
# Every gate, in order. Stops at the first failure and prints which gate failed.
set -euo pipefail; APP="${APP:-app}"
step() { echo; echo "== $1"; }
step "1 database reset (migrations 010–080 + seed)"; npx supabase db reset
step "2 typecheck"; (cd "$APP" && npx tsc --noEmit)
step "3 lint"; (cd "$APP" && npm run lint)
step "4 unit tests (semester-core, validate, AI red-team)"; (cd "$APP" && npx vitest run src/lib/core tests/validate.test.ts tests/ai-redteam.test.ts)
step "5 RLS + security + command tests"; (cd "$APP" && npx dotenv -e .env.test -- npx vitest run tests/rls.test.ts tests/security.test.ts tests/commands.test.ts)
step "6 design-system check"; (cd "$APP" && npm run design-system:check)
step "7 build"; (cd "$APP" && npm run build)
step "8 secret scan"; npx --yes gitleaks detect --no-banner || { echo "gitleaks missing or found secrets"; exit 1; }
echo; echo "ALL GATES PASSED — record this output in docs/execute/<stream>-report.md"
