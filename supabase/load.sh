#!/usr/bin/env bash
#
# Load and concurrency scenarios against a throwaway Postgres with every
# migration applied — the same database `check.sh` builds, handed over through
# SEMESTER_CHECK_THEN, so there is one setup and it cannot drift.
#
# What it answers: whether the paths a registration week leans on — flag and
# cohort reads on every screen, plan saves, demand reads — stay inside a
# latency budget with many sessions at once, and whether their data is still
# right afterwards. The second question is the one a test with one account can
# never ask: a race needs two sessions.
#
#     supabase/load.sh
#     LOAD_CLIENTS=32 LOAD_SECONDS=60 LOAD_STUDENTS=20000 supabase/load.sh
#
# Latency is this machine's. It is not a statement about production, whose
# network, pooler and hardware are different; the budgets are set to catch a
# regression of an order of magnitude, not to promise a number. A load test
# against the live project needs owner approval and a staging project, and is
# not what this is.
#
# Needs `pgbench`, which ships with the Postgres server binaries check.sh
# already requires. SEMESTER_CHECK_PG_ANY works the same way it does there.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SEMESTER_CHECK_THEN="$here/load/run.sh" exec "$here/check.sh"
