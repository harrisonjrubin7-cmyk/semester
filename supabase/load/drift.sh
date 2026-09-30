#!/usr/bin/env bash
# supabase/load/drift.sh — does a scenario get slower the longer it runs?
#
# Reads "<scenario> <window> <p95_ms>" lines on stdin, one per scenario per
# window, and compares the start of each scenario's run with its end. A soak
# test exists to find what a short load test cannot: a leak, a growing table
# that is scanned, an index that stops helping, a cache that only grows. Each
# shows up as the same scenario taking longer in window twelve than in window
# one, while every window alone sits inside its budget.
#
# The comparison is of the *best* window in the first quarter of the run (at
# least two windows) with the best in the last quarter. A leak lifts the floor:
# the scenario is never again as fast as it was. A noisy neighbour or a
# collection pause lifts one window's ceiling and leaves the floor where it was,
# so a single bad window at either end cannot decide it, and a slow first window
# while caches warm does not either. A scenario drifts when the later best is
# more than SOAK_RATIO times the earlier AND more than SOAK_MIN_DELTA_MS higher, so a
# 0.3 ms path that became 0.9 ms is not a finding and a 20 ms one that became
# 60 ms is. With fewer than four windows it says so and passes: two or three
# points are not a trend.
#
#     SOAK_RATIO=2 SOAK_MIN_DELTA_MS=5 drift.sh < windows.tsv
#
# Exit 1 when any scenario drifts. Nothing here touches the database; it is
# arithmetic on the numbers, so it is tested on its own (soak.test.ts).
set -euo pipefail

ratio=${SOAK_RATIO:-2}
delta=${SOAK_MIN_DELTA_MS:-5}

awk -v ratio="$ratio" -v delta="$delta" '
function best(a, from, to,    i, m) {
  m = a[from]
  for (i = from + 1; i <= to; i++) if (a[i] < m) m = a[i]
  return m
}
NF >= 3 && $2 ~ /^[0-9]+$/ && $3 ~ /^[0-9.]+$/ {
  if (!($1 in seen)) { seen[$1] = 1; order[++names] = $1 }
  at[$1, $2] = $3 + 0
  if ($2 + 0 > top[$1]) top[$1] = $2 + 0
}
END {
  bad = 0
  if (names == 0) { print "  ✗ soak: no samples were recorded, so nothing was compared"; exit 1 }
  for (k = 1; k <= names; k++) {
    s = order[k]; n = 0
    for (w = 1; w <= top[s]; w++) if ((s, w) in at) samples[++n] = at[s, w]
    if (n < 4) { printf "  · %s: %d window%s, too few to see a trend\n", s, n, (n == 1 ? "" : "s"); continue }
    edge = int(n / 4); if (edge < 2) edge = 2
    first = best(samples, 1, edge)
    last = best(samples, n - edge + 1, n)
    if (last > first * ratio && last - first > delta) {
      printf "  ✗ %s: p95 drifted from %.1f ms to %.1f ms over %d windows (limit x%s and +%s ms)\n", s, first, last, n, ratio, delta
      bad = 1
    } else {
      printf "  ✓ %s: p95 %.1f ms to %.1f ms over %d windows, no drift\n", s, first, last, n
    }
    delete samples
  }
  exit bad
}'
