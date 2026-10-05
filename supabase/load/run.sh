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

# Settle what the seed left owing before anything is timed, as pgbench does
# before its own runs. Without it the first scenario pays for the load: a
# checkpoint flushing the rows just written, hint bits set on each row's first
# read, autovacuum's first pass over the new tables. On a CI runner that came
# out as a median of 8 ms under a p95 of 457 (#996, 30 September).
psql -c "vacuum (freeze, analyze)" >/dev/null
psql -c "checkpoint" >/dev/null

bench() { "$bindir/pgbench" -h "$work" -p "$port" -U postgres -n "$@" postgres; }

failed=0

# Soak: with LOAD_SOAK_WINDOWS=N the scenarios run N times over, each a window
# of LOAD_SECONDS, with the invariants and the connection count checked after
# every window, and drift.sh compares each scenario's start with its end. Off
# (0) by default, and then this runs exactly once as it always did.
soak=${LOAD_SOAK_WINDOWS:-0}
windows="$logs/windows.tsv"
: > "$windows"
window=1

# What else was happening while a scenario ran, so a stalled window can be
# attributed and not merely budgeted (docs/LOAD-HARNESS-OPEN-ISSUE-PLANS-P95.md):
# checkpoints and autovacuum passes in this database, and the share of the
# runner's CPU time that the hypervisor took for someone else ("steal", Linux
# only; 0 where /proc/stat is absent). Read before and after each scenario.
if [ "$(psql -At -c "select to_regclass('pg_catalog.pg_stat_checkpointer') is not null")" = t ]; then
  ckpt_sql='select num_timed + num_requested from pg_stat_checkpointer'
else
  ckpt_sql='select checkpoints_timed + checkpoints_req from pg_stat_bgwriter'
fi
activity() {
  local ck av st tot
  psql -At -c "select pg_stat_force_next_flush()" >/dev/null 2>&1
  ck=$(psql -At -c "$ckpt_sql" 2>/dev/null)
  av=$(psql -At -c "select coalesce(sum(autovacuum_count + autoanalyze_count), 0) from pg_stat_user_tables" 2>/dev/null)
  read -r st tot <<<"$(awk '/^cpu /{t = 0; for (i = 2; i <= 9; i++) t += $i; print $9 + 0, t; exit}' /proc/stat 2>/dev/null)"
  echo "${ck:-0} ${av:-0} ${st:-0} ${tot:-0}"
}

scenario() {
  local name=$1 file="$here_load/$1.pgbench.sql"
  local budget out lat p50 p95 p99 tps errs
  budget=$(sed -nE 's/^-- budget: p95_ms=([0-9]+).*/\1/p' "$file")
  rm -f "$logs"/"$name".*
  read -r ck0 av0 st0 tot0 <<<"$(activity)"
  out=$( (cd "$logs" && bench -f "$file" -c "$clients" -j "$clients" -T "$seconds" \
            -D students="$students" -l --log-prefix="$name" --verbose-errors) 2>&1 )
  read -r ck1 av1 st1 tot1 <<<"$(activity)"
  bg=0; bgnote=""
  dck=$((ck1 - ck0)); dav=$((av1 - av0))
  steal=$(awk -v s="$((st1 - st0))" -v t="$((tot1 - tot0))" 'BEGIN {printf "%.1f", (t > 0 ? 100 * s / t : 0)}')
  [ "$dck" -gt 0 ] && { bg=1; bgnote="$dck checkpoint(s)"; }
  [ "$dav" -gt 0 ] && { bg=1; bgnote="${bgnote:+$bgnote, }$dav autovacuum or analyze pass(es)"; }
  awk -v a="$steal" 'BEGIN {exit !(a >= 5)}' && { bg=1; bgnote="${bgnote:+$bgnote, }CPU steal ${steal}%"; }
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
  p50=$(pct 50); p95=$(pct 95); p99=$(pct 99); last_n=$n
  printf '%s %s %s %s %s\n' "$name" "$window" "$p95" "$budget" "$bg" >> "$windows"
  line="$name: $n transactions, ${tps%.*} tps, p50 ${p50}ms p95 ${p95}ms p99 ${p99}ms (budget p95 ${budget}ms)"
  if [ "${errs:-0}" != 0 ]; then
    echo "  ✗ $line, $errs failed:"
    # Each distinct error once, with how often: "deadlock detected" ×13.
    echo "$out" | sed -nE 's/.*ERROR: +//p' | sort | uniq -c | sort -rn | head -4 | sed 's/^ */      ×/'
    failed=1
  elif awk -v a="$p95" -v b="$budget" 'BEGIN {exit !(a > b)}'; then
    if [ "$soak" -gt 0 ]; then
      # One window over its budget is a stall on a shared runner until the rest
      # of the run says otherwise: drift.sh judges the budget on the typical
      # (median) window, so a single bad one is shown and does not fail the run.
      echo "  ⚠ $line — over budget in this window, judged on the typical window at the end"
    else
      echo "  ✗ $line — over budget"; failed=1
    fi
  else
    echo "  ✓ $line"
  fi
  [ -n "$bgnote" ] && echo "      ↳ while it ran: $bgnote"
}

written() { psql -At -F ' ' -c "select (select n_tup_upd from pg_stat_user_tables where relid = 'public.state'::regclass), (select n_tup_upd from pg_stat_user_tables where relid = 'public.courses'::regclass)"; }

run_pass() {
  scenario flags
  scenario plans
  scenario plans-same-student
  # The demand read is of snapshots, so take one of what the plans wrote.
  psql -v ON_ERROR_STOP=1 -c "select public.refresh_course_demand_snapshots('load-u', '2027SP')" >/dev/null
  scenario demand

  # The sync path every student hits: an open, then pushes. A push's
  # compare-and-swaps succeed even when they match nothing, so the rows each
  # table wrote are counted from Postgres: about one state row and one course
  # a push, or the push silently stopped writing.
  scenario sync-open
  read -r s0 c0 <<<"$(written)"
  last_n=0
  scenario sync-push
  psql -c "select pg_stat_force_next_flush()" >/dev/null 2>&1; sleep 1
  read -r s1 c1 <<<"$(written)"
  if [ "$last_n" -gt 0 ] && { [ $((s1 - s0)) -lt $((last_n * 8 / 10)) ] || [ $((c1 - c0)) -lt $((last_n * 8 / 10)) ]; }; then
    echo "  ✗ sync-push: $last_n pushes wrote $((s1 - s0)) state rows and $((c1 - c0)) courses; a compare-and-swap matched nothing"
    failed=1
  else
    echo "  ✓ sync-push wrote $((s1 - s0)) state rows and $((c1 - c0)) courses for $last_n pushes"
  fi
  psql -c "truncate public.load_won; update public.state set data = data - 'n' where user_id in (select id from public.load_users where i <= 3)" >/dev/null
  scenario sync-same-student
}

run_invariants() {
  local inv
  echo "· invariants"
  inv=$(psql -f "$here_load/invariants.sql" 2>&1 || true)
  if echo "$inv" | grep -qE "ERROR"; then
    echo "$inv" | grep -E "ERROR" | sed 's/^.*ERROR: */  ✗ /'
    failed=1
  else
    echo "$inv" | sed -nE 's/^.*NOTICE: +invariant ok: /  ✓ /p'
  fi
}

# Sessions other than this one, in this database. pgbench closes its own when a
# window ends, so a count that keeps rising is a connection somebody leaked.
clients() { psql -Atc "select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and backend_type = 'client backend'"; }

# One soak window: every scenario once, then the invariants and the open
# connections. Also what runs again, with the next window numbers, when a drift
# has to be confirmed.
soak_window() {
  echo "· soak window $window of $total_windows"
  run_pass
  run_invariants
  now=$(clients)
  if [ "${now:-0}" -gt $((baseline + 2)) ]; then
    echo "  ✗ connections: $now open after window $window against $baseline before the first"
    failed=1
  fi
}

if [ "$soak" -gt 0 ]; then
  echo "· soak: $soak windows of ${seconds}s"
  baseline=$(clients)
  total_windows=$soak
  for window in $(seq 1 "$soak"); do soak_window; done
  echo "· soak: did anything get slower the longer it ran"
  if ! "$here_load/drift.sh" < "$windows"; then
    # A drift seen once, on a shared runner, may be the runner. The check compares
    # the best of the first windows with the best of the last, and with four windows
    # each end is two, so a lucky pair against a stalled pair reads as a leak (main's
    # run 4205, then #1280 twice, a different scenario each time). A leak is still
    # there when the soak runs on. So run as many windows again and judge the whole
    # run by the same rule, and fail only if the drift persists (D-1280). The limits
    # are not changed, and a scenario that really gets slower keeps getting slower
    # and fails here too, as does a typical window over budget (re-judged over the
    # longer run). An error, a broken invariant and a leaked connection do not wait
    # for this: they fail in the window they happen in.
    echo "· soak: drift seen over $soak windows; running $soak more to see whether it persists"
    total_windows=$((soak * 2))
    for window in $(seq $((soak + 1)) "$total_windows"); do soak_window; done
    echo "· soak: the same check over all $total_windows windows"
    "$here_load/drift.sh" < "$windows" || failed=1
    soak=$total_windows
  fi
else
  run_pass
  run_invariants
fi

# The control for the two-devices invariant: the same race with the
# compare-and-swap removed is last-writer-wins, and must lose updates here, or
# the invariant could not have seen one.
psql -c "truncate public.load_won; update public.state set data = data - 'n' where user_id in (select id from public.load_users where i <= 3)" >/dev/null
sed "s/ AND updated_at = to_timestamp(0) + :seen \* interval '1 microsecond'//" "$here_load/sync-same-student.pgbench.sql" > "$logs/nocas.sql"
(cd "$logs" && bench -f "$logs/nocas.sql" -c "$clients" -j "$clients" -T 5 -D students="$students") >/dev/null 2>&1
read -r cw cd <<<"$(psql -At -F ' ' -c "select count(*), count(distinct (user_id, counter)) from public.load_won")"
if [ "${cw:-0}" -gt "${cd:-0}" ]; then
  echo "  ✓ control: without the compare-and-swap, $((cw - cd)) of $cw writes were lost"
else
  echo "  ✗ control: without the compare-and-swap nothing was lost, so the two-devices invariant cannot see a lost update"
  failed=1
fi

rm -rf "$logs"
summary="· every scenario held its budget and every invariant held"
[ "$soak" -gt 0 ] && summary="$summary, and nothing drifted across $soak windows"
[ "$failed" = 0 ] && echo "$summary"
return "$failed"
