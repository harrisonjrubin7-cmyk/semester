#!/usr/bin/env bash
#
# The productivity repository adapter, run against a throwaway Postgres with every
# migration applied — the database `check.sh` builds, handed over through
# SEMESTER_CHECK_THEN, so there is one setup and it cannot drift (the way `load.sh`
# does it).
#
# What it answers: whether `app/server/productivity/postgres.ts` does with the real
# functions in `20261004123000_productivity_commands.sql` and
# `20261004180000_productivity_reads.sql` what the service's safety arguments assume
# — the repository contract, the same script of commands giving the same results in
# memory and in Postgres, and two processes that share nothing racing each other
# through the compare-and-swap and the retry.
#
#     supabase/adapter.sh
#
# It reaches the database through `psql`, one connection per call, as `service_role`:
# the same shape as a PostgREST call, without PostgREST. So it does not prove what
# PostgREST does with an error (that the SQLSTATE arrives in `error.code`) or with a
# type; the adapter is written not to depend on either, and the first run against a
# real project should confirm the first. SEMESTER_CHECK_PG_ANY works as it does in
# check.sh, and says so loudly: a pass on another major is not a statement about the
# one the project runs.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SEMESTER_CHECK_THEN="$here/adapter/run.sh" exec "$here/check.sh"
