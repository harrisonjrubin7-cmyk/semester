#!/usr/bin/env bash
# A change to infrastructure carries its change record in the same pull request.
#
#   scripts/infra/check-change-record.sh <base-ref> <pull-request-number>
#
# "Infrastructure" is anything that can alter what production is or who can
# alter it: the Terraform, the policy and its exceptions, the ruleset, the
# deploy workflows. The record is `infra/changes/CC-<pull request number>.md`,
# numbered by the pull request for the reason decisions are
# (docs/decisions/README.md): two open pull requests cannot collide on a name
# that is unique before it is written.
set -euo pipefail

base="${1:?base ref}"
pr="${2:?pull request number}"

cd "$(dirname "$0")/../.."

changed="$(git diff --name-only "origin/${base}...HEAD")"

governed='^(infra/terraform/|infra/policy/|\.github/rulesets/|\.github/workflows/(infra|infra-apply|drift|supply-chain|pages|functions)\.yml$)'
touched="$(printf '%s\n' "$changed" | grep -E "$governed" || true)"

if [ -z "$touched" ]; then
  echo "no governed infrastructure files changed; no change record required"
  exit 0
fi

echo "governed files changed:"
printf '%s\n' "$touched" | sed 's/^/  /'

record="infra/changes/CC-${pr}.md"
if ! printf '%s\n' "$changed" | grep -qx "$record"; then
  cat >&2 <<MSG

✗ ${record} is not part of this pull request.

Infrastructure changes are recorded when they are made, not afterwards:
copy infra/changes/TEMPLATE.md to ${record} and fill it in. The template says
what each section is for; the one people skip is Rollback.
MSG
  exit 1
fi

echo "✓ ${record} is in this pull request (its content is checked by the test suite)"
