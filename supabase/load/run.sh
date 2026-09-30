# supabase/load/run.sh — sourced by check.sh through SEMESTER_CHECK_THEN.
#
# Not run directly: `supabase/load.sh` is the command. By the time this runs,
# check.sh has a throwaway Postgres with every migration applied, and hands
# over `psql`, `$bindir`, `$work` and `$port`.

# check.sh runs under `set -e`; this script reads exit codes and reports each
# failure itself, so a scenario that fails must not end the run unexplained.
set +e +o pipefail

here_load=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
students=${LOAD_STUDENTS:-2000}
clients=${LOAD_CLIENTS:-16}
seconds=${LOAD_SECONDS:-20}
logs=$(mktemp -d)
chmod 777 "$logs"

echo "· load: $students synthetic students, $clients concurrent clients, ${seconds}s per scenario"
echo "  (latency here is this machine's, not production's: the budgets catch a"
echo "   regression of an order of magnitude; the invariants are the real test)"

if ! psql -v ON_ERROR_STOP=1 -v students="$students" -f "$here_load/seed.sql" >/dev/null 2>"$logs/seed.err"; then
  echo "  ✗ seed"; head -5 "$logs/seed.err" | sed 's/^/      /'
  return 1
fi

bench() { "$bindir/pgbench" -h "$work" -p "$port" -U postgres -n "$@" postgres; }

failed=0
scenario() {
  local name=$1 file="$here_load/$1.pgbench.sql"
  local budget out lat p50 p95 p99 tps errs
  budget=$(sed -nE 's/^-- budget: p95_ms=([0-9]+).*/\1/p' "$file")
  rm -f "$logs"/"$name".*
  out=$( (cd "$logs" && bench -f "$file" -c "$clients" -j "$clients" -T "$seconds" \
            -D students="$students" -l --log-prefix="$name" --verbose-errors) 2>&1 )
  tps=$(echo "$out" | sed -nE 's/^tps = ([0-9.]+).*/\1/p' | head -1)
  errs=$(echo "$out" | sed -nE 's/^number of failed transactions: ([0-9]+).*/\1/p' | head -1)
  # A client that stops, or a run with no summary, is a harness failure; a
  # transaction that fails and is counted is a finding, reported below.
  if echo "$out" | grep -qE "aborted" || [ -z "$tps" ]; then
    echo "  ✗ $name: the run did not complete"
    echo "$out" | grep -E "aborted|error" | head -3 | sed 's/^/      /'
    failed=1; return
  fi
  # Column 3 of a pgbench transaction log is the latency in microseconds.
  lat=$(cat "$logs"/"$name".* | awk '{print $3}' | sort -n)
  n=$(echo "$lat" | wc -l)
  pct() { echo "$lat" | awk -v n="$n" -v p="$1" 'NR == int((n - 1) * p / 100) + 1 {printf "%.1f", $1 / 1000; exit}'; }
  p50=$(pct 50); p95=$(pct 95); p99=$(pct 99)
  line="$name: $n transactions, ${tps%.*} tps, p50 ${p50}ms p95 ${p95}ms p99 ${p99}ms (budget p95 ${budget}ms)"
  if [ "${errs:-0}" != 0 ]; then
    echo "  ✗ $line, $errs failed:"
    # Each distinct error once, with how often: "deadlock detected" ×13.
    echo "$out" | sed -nE 's/.*ERROR: +//p' | sort | uniq -c | sort -rn | head -4 | sed 's/^ */      ×/'
    failed=1
  elif awk -v a="$p95" -v b="$budget" 'BEGIN {exit !(a > b)}'; then
    echo "  ✗ $line — over budget"; failed=1
  else
    echo "  ✓ $line"
  fi
}

scenario flags
scenario plans
scenario plans-same-student
# The demand read is of snapshots, so take one of what the plans wrote.
psql -v ON_ERROR_STOP=1 -c "select public.refresh_course_demand_snapshots('load-u', '2027SP')" >/dev/null
scenario demand

echo "· invariants"
inv=$(psql -f "$here_load/invariants.sql" 2>&1 || true)
if echo "$inv" | grep -qE "ERROR"; then
  echo "$inv" | grep -E "ERROR" | sed 's/^.*ERROR: */  ✗ /'
  failed=1
else
  echo "$inv" | sed -nE 's/^.*NOTICE: +invariant ok: /  ✓ /p'
fi

rm -rf "$logs"
[ "$failed" = 0 ] && echo "· every scenario held its budget and every invariant held"
return "$failed"
