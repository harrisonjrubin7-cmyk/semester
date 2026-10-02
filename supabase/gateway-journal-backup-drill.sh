#!/usr/bin/env bash
#
# Seed one non-sensitive gateway audit marker before a physical backup, then
# verify that exact marker after the backup is restored to a separate project.
# This deliberately writes no student content, review body, model input, or
# credential. The marker remains as operational evidence of the drill.
#
# Seed on production, before the chosen backup point:
#   DRILL_DB_URL='postgresql://…production…' \
#   DRILL_PROJECT_REF='production-project-ref' \
#   DRILL_SOURCE_PROJECT_REF='production-project-ref' \
#   DRILL_TENANT_ID='explicit-school-id' \
#   DRILL_MARKER='semester-restore-2026-10-02T150000Z' \
#     supabase/gateway-journal-backup-drill.sh seed
#
# Verify on the separately restored project:
#   DRILL_DB_URL='postgresql://…restored-project…' \
#   DRILL_PROJECT_REF='restored-project-ref' \
#   DRILL_SOURCE_PROJECT_REF='production-project-ref' \
#   DRILL_MARKER='semester-restore-2026-10-02T150000Z' \
#     supabase/gateway-journal-backup-drill.sh verify
#
set -euo pipefail

mode=${1:-}
case "$mode" in
  seed|verify) ;;
  *) echo "Usage: $0 seed|verify" >&2; exit 2 ;;
esac

: "${DRILL_DB_URL:?set DRILL_DB_URL to the direct connection string for this phase}"
: "${DRILL_PROJECT_REF:?set DRILL_PROJECT_REF to the project this connection must reach}"
: "${DRILL_SOURCE_PROJECT_REF:?set DRILL_SOURCE_PROJECT_REF to the production project ref}"
: "${DRILL_MARKER:?set DRILL_MARKER to the same unique marker for seed and verify}"

if [[ ! "$DRILL_MARKER" =~ ^semester-restore-[A-Za-z0-9._:-]+$ ]]; then
  echo "DRILL_MARKER must begin semester-restore- and contain only safe correlation-id characters." >&2
  exit 2
fi
if [ "${#DRILL_MARKER}" -lt 24 ] || [ "${#DRILL_MARKER}" -gt 128 ]; then
  echo "DRILL_MARKER must be 24-128 characters." >&2
  exit 2
fi
if [[ ! "$DRILL_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]] || [[ ! "$DRILL_SOURCE_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]]; then
  echo "Project refs must be the 20-character lowercase refs shown by Supabase." >&2
  exit 2
fi
case "$DRILL_DB_URL" in
  *"$DRILL_PROJECT_REF"*) ;;
  *) echo "DRILL_DB_URL does not contain the declared DRILL_PROJECT_REF. Refusing." >&2; exit 2 ;;
esac
if [ "$mode" = seed ] && [ "$DRILL_PROJECT_REF" != "$DRILL_SOURCE_PROJECT_REF" ]; then
  echo "Seed must target the declared production source project. Refusing." >&2
  exit 2
fi
if [ "$mode" = verify ] && [ "$DRILL_PROJECT_REF" = "$DRILL_SOURCE_PROJECT_REF" ]; then
  echo "Verify must target a separately restored project, never production. Refusing." >&2
  exit 2
fi

db() {
  psql -X -qAt -v ON_ERROR_STOP=1 -d "$DRILL_DB_URL" "$@"
}

marker_count() {
  db -v marker="$DRILL_MARKER" -c "
    select count(*)
      from private.gateway_audit
     where actor_id = 'semester-restore-drill'
       and area = 'operations'
       and event = 'backup.restore.marker'
       and review_id is null
       and correlation_id = :'marker'"
}

if [ "$mode" = seed ]; then
  : "${DRILL_TENANT_ID:?set DRILL_TENANT_ID to the explicit tenant that owns the operational marker}"
  tenant_count=$(db -v tenant="$DRILL_TENANT_ID" -c "select count(*) from public.schools where id = :'tenant'")
  if [ "$tenant_count" != 1 ]; then
    echo "DRILL_TENANT_ID must name exactly one existing school; found $tenant_count." >&2
    exit 2
  fi
  if [ "$(marker_count)" != 0 ]; then
    echo "DRILL_MARKER already exists; use a new unique marker." >&2
    exit 2
  fi
  wrote=$(db -v tenant="$DRILL_TENANT_ID" -v marker="$DRILL_MARKER" -c "
    select public.gateway_write_audit_v2(
      :'tenant', 'semester-restore-drill', 'operations',
      'backup.restore.marker', null, :'marker'
    )")
  if [ "$wrote" != t ] || [ "$(marker_count)" != 1 ]; then
    echo "The gateway audit marker was not recorded exactly once." >&2
    exit 1
  fi
  echo "Gateway backup marker seeded: $DRILL_MARKER"
else
  count=$(marker_count)
  if [ "$count" != 1 ]; then
    echo "Gateway backup marker verification failed; expected 1 row, found $count." >&2
    exit 1
  fi
  echo "Gateway backup marker restored: $DRILL_MARKER"
fi
