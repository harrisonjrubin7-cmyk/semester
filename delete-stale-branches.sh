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

for br in "${BRANCHES[@]}"; do
  if ! git rev-parse --verify --quiet "origin/$br" >/dev/null; then
    echo "gone already:  $br"
    continue
  fi
  t=$(git merge-tree --write-tree origin/main "origin/$br" 2>/dev/null || true)
  if [ -n "$t" ] && [ "$t" = "$main" ]; then
    git push origin --delete "$br"
  else
    echo "SKIP, no longer fully merged:  $br" >&2
  fi
done
