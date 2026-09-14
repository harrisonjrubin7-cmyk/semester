#!/usr/bin/env bash
#
# Delete the claude/* branches whose work is already in main.
#
# Why a list and not `claude/*`: of the 145 claude branches on the remote when
# this was written, only 34 were fully merged. The other 111 carry commits main
# does not have, and a blanket delete would have thrown that work away. So the
# names are enumerated, and widening this to a glob is the one edit not to make.
#
# Why `merge-tree` and not `git branch --merged`: these land as squash merges,
# so the branch tip is never an ancestor of main and `--merged` reports nothing
# at all. The test used instead is "merge this branch into main and see whether
# anything changes": if the merged tree is main's own tree, the branch adds
# nothing. That was validated against a branch known to have merged minutes
# earlier before being trusted on the rest.
#
# The list goes stale quickly — four branches dropped off it and one joined it
# in the five minutes between building it and committing it, because this repo
# merges often. So the loop re-runs the same check on every branch at run time
# and deletes only the ones that still pass. The list is a starting point that
# narrows the work; the check is what makes it safe.
#
# Branches with an open pull request are excluded: deleting the head branch of
# an open PR closes it.
#
# That exclusion is asked of GitHub rather than inferred from the merge test,
# because the merge test cannot see it. A branch whose work reached main by
# another route — a second pull request carrying the same change, which is a
# thing that happens here — matches main's tree exactly while its own pull
# request is still open. It is precisely the branch this check is for, and
# precisely the one the tree comparison calls safe.
#
# If the open pull requests cannot be established, this refuses to run rather
# than carrying on without the exclusion it promises.
#
# Verified 2026-09-14 against main @ 1855396.
#
set -euo pipefail

BRANCHES=(
  claude/admiring-pascal-ymq1s0
  claude/admiring-ptolemy-2modu7
  claude/app-audit-cleanup-po2tdp
  claude/awesome-rubin-63w34j
  claude/beautiful-noether-3q3r5e
  claude/bold-fermat-089zmf
  claude/confident-lamport-po11nu
  claude/dazzling-pasteur-rsjad3
  claude/dreamy-bardeen-y4xflj
  claude/due-at-noon-was-untimed
  claude/erase-reaches-every-store
  claude/fervent-sagan-8nvqn7
  claude/friendly-knuth-493lyg
  claude/gracious-faraday-uou10k
  claude/gracious-heisenberg-xj8836
  claude/gracious-meitner-r5h2ir
  claude/great-bohr-1qbyey
  claude/happy-maxwell-po3wn9
  claude/ics-recurrence-exceptions
  claude/inspiring-gates-5wwd3d
  claude/magical-johnson-xcy3pr
  claude/new-session-xh7by4
  claude/one-zip-limit
  claude/peaceful-cannon-7iq4u4
  claude/pensive-pasteur-p7xamn
  claude/points-are-weights
  claude/power-folds-left
  claude/practical-fermat-a72ta0
  claude/prefers-has-a-test
  claude/quirky-shannon-tt7lla
  claude/sharp-wright-meuqns
  claude/sweet-dijkstra-wfhth2
  claude/tonight-hours
  claude/vibrant-noether-qroxaa
)

git fetch origin --prune
main=$(git rev-parse "origin/main^{tree}")

# The head branch of every open pull request.
#
# `gh` rather than a bare API call so this uses whatever credentials the person
# running it already has. No `gh`, or a `gh` that cannot answer, is a refusal:
# the alternative is deleting branches while claiming an exclusion that did not
# happen, and the cost of being wrong here is somebody's open pull request
# closing silently.
if ! command -v gh >/dev/null; then
  echo "refusing to run: gh is not installed, so open pull requests cannot be checked" >&2
  exit 1
fi
if ! open_prs=$(gh pr list --state open --limit 500 --json headRefName --jq '.[].headRefName' 2>&1); then
  echo "refusing to run: could not list open pull requests" >&2
  printf '%s\n' "$open_prs" >&2
  exit 1
fi

deleted=0
skipped=0
failed=()

for br in "${BRANCHES[@]}"; do
  if ! git rev-parse --verify --quiet "origin/$br" >/dev/null; then
    echo "gone already:                  $br"
    continue
  fi
  # Before the merge test, not after: a branch with an open pull request is out
  # whatever its tree says, and the tree saying "already merged" is the case
  # this guards.
  if printf '%s\n' "$open_prs" | grep -qxF "$br"; then
    echo "SKIP, has an open pull request: $br" >&2
    skipped=$((skipped + 1))
    continue
  fi
  t=$(git merge-tree --write-tree origin/main "origin/$br" 2>/dev/null || true)
  if [ -z "$t" ] || [ "$t" != "$main" ]; then
    echo "SKIP, no longer fully merged:  $br" >&2
    skipped=$((skipped + 1))
    continue
  fi
  # `|| failed+=(...)` rather than a bare call: `set -e` would end the whole
  # run on the first branch that would not delete, leaving the other
  # thirty-three in place and the exit status blaming only the one. That is
  # what happened on the first real attempt — every push was refused 403 and
  # the script stopped at branch one, which reads like one bad branch rather
  # than no permission at all. A refusal is per-branch information; the run
  # collects it and carries on, and the summary below is what says whether
  # this was one branch or all of them.
  if git push origin --delete "$br"; then
    deleted=$((deleted + 1))
  else
    failed+=("$br")
  fi
done

echo
echo "deleted $deleted, skipped $skipped, failed ${#failed[@]}"
if [ ${#failed[@]} -gt 0 ]; then
  printf 'failed to delete: %s\n' "${failed[@]}" >&2
  # Non-zero, so this still fails a pipeline — but only after trying every
  # branch rather than instead of trying them.
  exit 1
fi
