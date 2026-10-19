#!/usr/bin/env bash
# Run from handoff/control-plane/v4. --fail-on-empty stops an accidentally empty test run from passing.
set -euo pipefail
command -v opa >/dev/null 2>&1 || { echo "OPA is required." >&2; exit 1; }
opa version
opa check --strict policy_engine.rego policy_enforcement.rego policy_test.rego policies/
opa test policy_engine.rego policy_enforcement.rego policy_test.rego --verbose --fail-on-empty
opa test policies/ --verbose --fail-on-empty
