#!/usr/bin/env bash
# Run from handoff/control-plane/baseline. Policy logic only: does NOT test PostgreSQL, leases, PA/PEP calls or token revocation.
set -euo pipefail
command -v opa >/dev/null 2>&1 || { echo "OPA is required." >&2; exit 1; }
opa version
opa check --strict policies/
opa test policies/ --verbose --fail-on-empty
