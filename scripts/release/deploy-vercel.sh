#!/usr/bin/env bash
# Gated Vercel release helper. `plan` is the only action that runs without
# the gate. Every other action needs the authenticated release gate hook,
# which is NOT implemented in this repository: the workflow that calls this
# script exits before deployment until that hook exists.
set -Eeuo pipefail
umask 077

action=${1:-plan}
case "$action" in plan|preview|stage|promote|rollback) ;; *) exit 2;; esac

cd "$(git rev-parse --show-toplevel)"
[[ -z $(git status --porcelain) ]] || { echo 'Clean worktree required' >&2; exit 1; }
sha=$(git rev-parse HEAD)
if [[ "$action" == plan ]]; then printf 'Plan only: %s\n' "$sha"; exit 0; fi

: "${VERCEL_ORG_ID:?}" "${VERCEL_PROJECT_ID:?}" "${VERCEL_TOKEN:?}"
: "${RELEASE_SHA:?}" "${EVIDENCE_MANIFEST:?}" "${RELEASE_GATE_HOOK:?}" "${VERCEL_CLI:?}"
[[ "$VERCEL_CLI" == /* && -x "$VERCEL_CLI" ]] || exit 1
[[ "$RELEASE_GATE_HOOK" == /* && -x "$RELEASE_GATE_HOOK" ]] || exit 1
[[ "$EVIDENCE_MANIFEST" == /* && "$sha" == "$RELEASE_SHA" ]] || exit 1

# Integrity only. A passing result does not authorize a release.
python3 scripts/release/evidence_bundle.py "$EVIDENCE_MANIFEST"

environment=production
[[ "$action" != preview ]] || environment=preview
request=$(mktemp); trap 'rm -f "$request"' EXIT
python3 - "$request" "$EVIDENCE_MANIFEST" "$sha" "$environment" "$action" "$VERCEL_ORG_ID" "$VERCEL_PROJECT_ID" <<'PY'
import json,sys
b=json.load(open(sys.argv[2]))
assert b['target']['commit_sha']==sys.argv[3], 'Candidate mismatch'
assert b['target']['environment']==sys.argv[4], 'Environment mismatch'
json.dump(dict(action=sys.argv[5],target=b['target'],org_id=sys.argv[6],project_id=sys.argv[7]),open(sys.argv[1],'w'))
PY

# Authenticated canonical evaluator adapter: operation, target/config, exact
# deployment, identity, freshness, withdrawal and approver authority required.
# Neither an integrity result nor a local boolean is acceptable authorization.
"$RELEASE_GATE_HOOK" "$request"

case "$action" in
  preview) "$VERCEL_CLI" deploy --yes --token "$VERCEL_TOKEN" --meta "releaseSha=$sha" ;;
  stage)   "$VERCEL_CLI" deploy --prod --skip-domain --yes --token "$VERCEL_TOKEN" --meta "releaseSha=$sha" ;;
  promote)
    : "${DEPLOYMENT_ID_OR_URL:?}" "${ROLLOUT_MODE:?}"
    case "$ROLLOUT_MODE" in
      instant) "$VERCEL_CLI" promote "$DEPLOYMENT_ID_OR_URL" --token "$VERCEL_TOKEN" ;;
      rolling) "$VERCEL_CLI" rolling-release start --dpl="$DEPLOYMENT_ID_OR_URL" --token "$VERCEL_TOKEN" ;;
      *) exit 2 ;;
    esac ;;
  rollback)
    : "${DEPLOYMENT_ID_OR_URL:?Prior known-good production deployment}"
    "$VERCEL_CLI" rollback "$DEPLOYMENT_ID_OR_URL" --token "$VERCEL_TOKEN" ;;
esac
