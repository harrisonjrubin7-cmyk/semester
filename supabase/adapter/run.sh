# Sourced by check.sh (SEMESTER_CHECK_THEN), with `$work` (the socket directory),
# `$port`, `$here` and `psql` in scope, in place of the policy suites.
#
# Not executable on its own, and not meant to be run directly: use `supabase/adapter.sh`.
# shellcheck shell=bash
# shellcheck disable=SC2154 # check.sh supplies here, work and port.

echo "· the productivity adapter, against this database"
(
  cd "$here/../app" || exit
  SEMESTER_PG_HOST="$work" SEMESTER_PG_PORT="$port" \
    npx vitest run server/productivity/postgres.integration
)
