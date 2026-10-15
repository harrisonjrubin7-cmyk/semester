#!/usr/bin/env bash
# Resolve GitHub Action tags to full commit SHAs (dereferencing annotated tags) and write the active workflow.
# Needs: gh (authenticated), jq. Review the printed pins before committing.
set -euo pipefail
cd "$(dirname "$0")/.."
resolve() { # owner/repo tag
  local obj type sha
  obj=$(gh api "repos/$1/git/ref/tags/$2")
  type=$(jq -r .object.type <<<"$obj"); sha=$(jq -r .object.sha <<<"$obj")
  if [ "$type" = "tag" ]; then sha=$(gh api "repos/$1/git/tags/$sha" --jq .object.sha); fi
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "bad sha for $1@$2" >&2; exit 1; }
  echo "$sha"
}
CHECKOUT=$(resolve actions/checkout "${CHECKOUT_TAG:-v4.2.2}")
UPLOAD=$(resolve actions/upload-artifact "${UPLOAD_TAG:-v4.6.2}")
echo "actions/checkout@${CHECKOUT_TAG:-v4.2.2} -> $CHECKOUT"
echo "actions/upload-artifact@${UPLOAD_TAG:-v4.6.2} -> $UPLOAD"
mkdir -p .github/workflows
sed -e "s/actions\/checkout@REPLACE_WITH_VERIFIED_FULL_COMMIT_SHA/actions\/checkout@$CHECKOUT # ${CHECKOUT_TAG:-v4.2.2}/g" \
    -e "s/actions\/upload-artifact@REPLACE_WITH_VERIFIED_FULL_COMMIT_SHA/actions\/upload-artifact@$UPLOAD # ${UPLOAD_TAG:-v4.6.2}/g" \
    -e '1s/^# Inactive template.*/# Pinned by tools\/pin_actions.sh — review before merge./' \
    curriculum-ci.yml.template > .github/workflows/curriculum-ci.yml
grep -q REPLACE_WITH .github/workflows/curriculum-ci.yml && { echo "unresolved pins remain" >&2; exit 1; }
echo "Wrote .github/workflows/curriculum-ci.yml. Also set repo variable GRADER_IMAGE to a reviewed @sha256 digest."
