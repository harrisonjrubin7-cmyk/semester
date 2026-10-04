#!/usr/bin/env bash
# Run the infrastructure policy: its own tests first, then every workflow file.
#
#   scripts/infra/policy.sh            # from the repository root
#   OPA=/path/to/opa scripts/infra/policy.sh
#
# The tests come first on purpose. A policy whose tests are red is not
# evidence about the workflows — it may simply be blind — so the workflows are
# not evaluated against it.
set -euo pipefail

cd "$(dirname "$0")/../.."
OPA="${OPA:-opa}"
command -v "$OPA" >/dev/null || { echo "opa not found; set OPA=/path/to/opa (see .github/workflows/infra.yml for the pinned version)" >&2; exit 2; }

echo "── policy tests"
"$OPA" test infra/policy

status=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "── workflows"
for wf in .github/workflows/*.yml; do
  name="$(basename "$wf")"
  printf '{"workflow_file":"%s"}' "$name" > "$tmp/run.json"
  out="$("$OPA" eval --format raw --input "$wf" \
    --data infra/policy/workflows.rego \
    --data infra/policy/exceptions.json \
    --data "$tmp/run.json" \
    'concat("\n", [m | some m in data.semester.workflows.deny])' 2>&1)" || { echo "$name: opa failed: $out" >&2; status=1; continue; }
  if [ -n "$out" ]; then
    echo "✗ $name"
    printf '%s\n' "$out" | sed 's/^/    /'
    status=1
  else
    echo "✓ $name"
  fi
done
exit "$status"
