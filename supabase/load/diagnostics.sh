#!/usr/bin/env bash
# Read-only, per-window evidence for the load soak.
#
# This file is sourced by run.sh, which supplies psql and the throwaway
# database. It reads aggregate statistics only: no application row or value is
# selected. Every collector is best-effort and capture always returns success,
# because missing observability must be visible without changing the workload's
# existing pass/fail contract.

format_load_relation_diagnostics() {
  local window=$1 name live dead table_bytes index_bytes vacuum autovacuum analyze autoanalyze value valid
  while IFS='|' read -r name live dead table_bytes index_bytes vacuum autovacuum analyze autoanalyze; do
    case "$name" in term_plan_courses|demand_consents) ;; *) continue ;; esac
    valid=1
    for value in "$window" "$live" "$dead" "$table_bytes" "$index_bytes" "$vacuum" "$autovacuum" "$analyze" "$autoanalyze"; do
      case "$value" in ''|*[!0-9]*) valid=0 ;; esac
    done
    [ "$valid" = 1 ] || continue
    printf '  · diag relation window=%s name=%s live=%s dead=%s table_bytes=%s index_bytes=%s vacuum=%s autovacuum=%s analyze=%s autoanalyze=%s\n' \
      "$window" "$name" "$live" "$dead" "$table_bytes" "$index_bytes" "$vacuum" "$autovacuum" "$analyze" "$autoanalyze"
  done
}

load_diagnostics_relation_rows() {
  psql -At -F '|' -c "
    with wanted(name) as (
      values ('term_plan_courses'), ('demand_consents')
    )
    select w.name,
           coalesce(s.n_live_tup, 0),
           coalesce(s.n_dead_tup, 0),
           coalesce(pg_relation_size(c.oid), 0),
           coalesce(pg_indexes_size(c.oid), 0),
           coalesce(s.vacuum_count, 0),
           coalesce(s.autovacuum_count, 0),
           coalesce(s.analyze_count, 0),
           coalesce(s.autoanalyze_count, 0)
      from wanted w
      left join pg_class c on c.oid = to_regclass('public.' || w.name)
      left join pg_stat_user_tables s on s.relid = c.oid
     order by w.name"
}

load_diagnostics_pg_io() {
  if [ "$(psql -At -c "select to_regclass('pg_catalog.pg_stat_io') is not null" 2>/dev/null)" != t ]; then
    echo 'unsupported|unsupported|unsupported|unsupported|unsupported|unsupported|unsupported'
    return 0
  fi
  psql -At -F '|' -c "
    select coalesce(sum(reads), 0),
           coalesce(sum(writes), 0),
           coalesce(sum(writebacks), 0),
           coalesce(sum(extends), 0),
           coalesce(sum(fsyncs), 0),
           coalesce(round(sum(read_time))::bigint, 0),
           coalesce(round(sum(write_time))::bigint, 0)
      from pg_catalog.pg_stat_io" 2>/dev/null ||
    echo 'unsupported|unsupported|unsupported|unsupported|unsupported|unsupported|unsupported'
}

load_diagnostics_checkpoints() {
  if [ "$(psql -At -c "select to_regclass('pg_catalog.pg_stat_checkpointer') is not null" 2>/dev/null)" = t ]; then
    psql -At -F '|' -c "
      select num_timed + num_requested,
             round(write_time)::bigint,
             round(sync_time)::bigint,
             buffers_written
        from pg_catalog.pg_stat_checkpointer" 2>/dev/null ||
      echo 'unsupported|unsupported|unsupported|unsupported'
  elif [ "$(psql -At -c "select to_regclass('pg_catalog.pg_stat_bgwriter') is not null" 2>/dev/null)" = t ]; then
    psql -At -F '|' -c "
      select checkpoints_timed + checkpoints_req,
             round(checkpoint_write_time)::bigint,
             round(checkpoint_sync_time)::bigint,
             buffers_checkpoint
        from pg_catalog.pg_stat_bgwriter" 2>/dev/null ||
      echo 'unsupported|unsupported|unsupported|unsupported'
  else
    echo 'unsupported|unsupported|unsupported|unsupported'
  fi
}

load_diagnostics_host_io() {
  if [ ! -r /proc/stat ]; then
    echo 'unsupported|unsupported'
    return 0
  fi
  awk '/^cpu / { total = 0; for (i = 2; i <= 9; i++) total += $i; print $6 + 0 "|" total; found = 1; exit }
       END { if (!found) print "unsupported|unsupported" }' /proc/stat 2>/dev/null
}

load_diagnostics_start() {
  # The snapshots are cumulative. This marker makes the capture boundary
  # explicit without performing any maintenance or resetting any statistic.
  echo '· load diagnostics: cumulative read-only counters follow every soak window'
  return 0
}

load_diagnostics_capture() {
  local window=$1 rows io checkpoints host
  local reads writes writebacks extends fsyncs read_ms write_ms
  local checkpoint_count checkpoint_write_ms checkpoint_sync_ms checkpoint_buffers
  local host_iowait_ticks host_cpu_ticks

  if rows=$(load_diagnostics_relation_rows 2>/dev/null) && [ -n "$rows" ]; then
    printf '%s\n' "$rows" | format_load_relation_diagnostics "$window"
  else
    echo "  · diag relation window=$window unavailable=unsupported"
  fi

  io=$(load_diagnostics_pg_io)
  IFS='|' read -r reads writes writebacks extends fsyncs read_ms write_ms <<<"$io"
  checkpoints=$(load_diagnostics_checkpoints)
  IFS='|' read -r checkpoint_count checkpoint_write_ms checkpoint_sync_ms checkpoint_buffers <<<"$checkpoints"
  host=$(load_diagnostics_host_io)
  IFS='|' read -r host_iowait_ticks host_cpu_ticks <<<"$host"

  printf '  · diag io window=%s pg_reads_total=%s pg_writes_total=%s pg_writebacks_total=%s pg_extends_total=%s pg_fsyncs_total=%s pg_read_ms_total=%s pg_write_ms_total=%s checkpoints_total=%s checkpoint_write_ms_total=%s checkpoint_sync_ms_total=%s checkpoint_buffers_total=%s host_iowait_ticks_total=%s host_cpu_ticks_total=%s\n' \
    "$window" "${reads:-unsupported}" "${writes:-unsupported}" "${writebacks:-unsupported}" \
    "${extends:-unsupported}" "${fsyncs:-unsupported}" "${read_ms:-unsupported}" "${write_ms:-unsupported}" \
    "${checkpoint_count:-unsupported}" "${checkpoint_write_ms:-unsupported}" \
    "${checkpoint_sync_ms:-unsupported}" "${checkpoint_buffers:-unsupported}" \
    "${host_iowait_ticks:-unsupported}" "${host_cpu_ticks:-unsupported}"
  return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-}" in
    --format-relations) format_load_relation_diagnostics "${2:-}" ;;
    *) echo 'usage: diagnostics.sh --format-relations WINDOW' >&2; exit 2 ;;
  esac
fi
