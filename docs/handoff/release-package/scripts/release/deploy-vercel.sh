#!/usr/bin/env bash
# Gated Vercel release. Integrity is checked here; AUTHORIZATION comes only from RELEASE_GATE_HOOK
# (the authenticated canonical evaluator — not implemented yet, so this script cannot pass that step).
set -Eeuo pipefail
umask 077
action=${1:-plan}
case "$action" in plan|preview|stage|promote|rollback) ;; *) echo "usage: $0 plan|preview|stage|promote|rollback" >&2; exit 2;; esac
cd "$(git rev-parse --show-toplevel)"
[[ -z $(git status --porcelain) ]] || { echo 'Clean worktree required' >&2; exit 1; }
sha=$(git rev-parse HEAD)
if [[ "$action" == plan ]]; then printf 'Plan only: %s\n' "$sha"; exit 0; fi

: "${VERCEL_ORG_ID:?}" "${VERCEL_PROJECT_ID:?}" "${VERCEL_TOKEN:?}"
: "${RELEASE_SHA:?}" "${EVIDENCE_MANIFEST:?}" "${RELEASE_GATE_HOOK:?}" "${VERCEL_CLI:?}"
[[ "$VERCEL_CLI" == /* && -x "$VERCEL_CLI" ]] || { echo 'VERCEL_CLI must be an absolute path to a pinned CLI' >&2; exit 1; }
[[ "$RELEASE_GATE_HOOK" == /* && -x "$RELEASE_GATE_HOOK" ]] || { echo 'RELEASE_GATE_HOOK must be an absolute executable' >&2; exit 1; }
[[ "$EVIDENCE_MANIFEST" == /* ]] || { echo 'EVIDENCE_MANIFEST must be absolute' >&2; exit 1; }
[[ "$sha" == "$RELEASE_SHA" ]] || { echo "HEAD $sha is not RELEASE_SHA $RELEASE_SHA" >&2; exit 1; }

python3 scripts/release/evidence_bundle.py "$EVIDENCE_MANIFEST"

environment=production
[[ "$action" != preview ]] || environment=preview
request=$(mktemp); trap 'rm -f "$request"' EXIT
python3 - "$request" "$EVIDENCE_MANIFEST" "$sha" "$environment" "$action" "$VERCEL_ORG_ID" "$VERCEL_PROJECT_ID" "${DEPLOYMENT_ID_OR_URL:-}" <<'PY'
import json, sys
out, manifest, sha, env, action, org, project, deployment = sys.argv[1:9]
b = json.load(open(manifest))
assert b["target"]["commit_sha"] == sha, "Candidate mismatch"
assert b["target"]["environment"] == env, "Environment mismatch"
json.dump(dict(action=action, target=b["target"], org_id=org, project_id=project, deployment=deployment or None), open(out, "w"))
PY

# Authenticated canonical evaluator: operation, target/config, exact deployment, identity, freshness,
# withdrawal and approver authority. Neither an integrity result nor a local boolean is authorization.
"$RELEASE_GATE_HOOK" "$request"

# The CLI reads VERCEL_TOKEN from the environment — never pass it as --token (visible in process lists and CI logs).
export VERCEL_TOKEN
case "$action" in
  preview) "$VERCEL_CLI" deploy --yes --meta "releaseSha=$sha" ;;
  stage)   "$VERCEL_CLI" deploy --prod --skip-domain --yes --meta "releaseSha=$sha" ;;
  promote)
    : "${DEPLOYMENT_ID_OR_URL:?}" "${ROLLOUT_MODE:?}"
    case "$ROLLOUT_MODE" in
      instant) "$VERCEL_CLI" promote "$DEPLOYMENT_ID_OR_URL" ;;
      rolling) "$VERCEL_CLI" rolling-release start --dpl="$DEPLOYMENT_ID_OR_URL" ;;
      *) echo "ROLLOUT_MODE must be instant or rolling" >&2; exit 2;;
    esac ;;
  rollback)
    : "${DEPLOYMENT_ID_OR_URL:?Prior known-good production deployment}"
    "$VERCEL_CLI" rollback "$DEPLOYMENT_ID_OR_URL" ;;
esac
