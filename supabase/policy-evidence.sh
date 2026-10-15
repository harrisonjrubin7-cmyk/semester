#!/usr/bin/env bash
# Run the PostgreSQL policy harness and always emit a bounded, machine-readable
# exact-commit result. This touches only the throwaway cluster check.sh creates.
set -uo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/.." && pwd)
output=${SEMESTER_POLICY_EVIDENCE_OUTPUT:-"$root/artifacts/database/pg17-policy-evidence.json"}
log=$(mktemp)
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cleanup() { rm -f "$log"; }
trap cleanup EXIT

set +e
SEMESTER_CHECK_REAPPLY=1 "$here/check.sh" "$@" 2>&1 | tee "$log"
check_status=${PIPESTATUS[0]}
set -e

finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [ "$check_status" -eq 0 ]; then evidence_status=passed; else evidence_status=failed; fi

commit=${GITHUB_SHA:-$(git -C "$root" rev-parse HEAD 2>/dev/null || printf unknown)}
ref=${GITHUB_REF:-$(git -C "$root" symbolic-ref --short -q HEAD 2>/dev/null || printf detached)}
node_bin=${NODE_BIN:-node}

"$node_bin" "$root/scripts/write-pg-policy-evidence.mjs" \
  --output "$output" \
  --status "$evidence_status" \
  --exit-code "$check_status" \
  --started-at "$started_at" \
  --finished-at "$finished_at" \
  --commit "$commit" \
  --ref "$ref" \
  --run-id "${GITHUB_RUN_ID:-}" \
  --log "$log"

exit "$check_status"
