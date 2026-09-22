#!/usr/bin/env bash
#
# Ask the live project what it has actually run, and say where that differs
# from this repository.
#
# Every other guard here compares `migrations/` against `ledger.snapshot`, and
# `ledger.snapshot` is a **dated reading**. It is written by a person, it goes
# stale silently, and between the moment it stops describing production and the
# moment somebody notices, every one of those guards is answering a question
# about a database that no longer exists.
#
# That is not hypothetical and it is not rare. On 21 September the ledger took
# seventeen rows in one afternoon. Four separate sessions re-read it by hand —
# and each time the prompt to do so was an accident: a deploy that had been
# failing for three days, a CI run that went red, somebody poking at production
# for an unrelated reason. `public.activity` reached the live project as a
# table nothing in this repository created, and was found because a fingerprint
# happened to be three columns short.
#
# So this is the reading, automated, and it is deliberately not a test:
#
#     supabase/ledgerdrift.sh                 # needs SUPABASE_ACCESS_TOKEN
#     supabase/ledgerdrift.sh --from FILE     # a reading already taken
#
# ## Why this is not in `app/src/lib/`
#
# The suites in there must never reach the network. A test that talks to a live
# project is slow, is red when the project is asleep, is red on a fork with no
# credentials, and — worst — makes `npm test` mean something different on every
# machine. `ledger.snapshot` exists precisely so those suites can ask their
# question offline, and this script exists so that the snapshot is checked by a
# machine rather than remembered by a person.
#
# ## What it can check, and the one thing it cannot
#
#   1. **Every live version has a file in `migrations/`.** A row without one
#      stops `db push` before it orders anything — *"Remote migration versions
#      not found in local migrations directory"* — which is what kept the
#      schema deploy red from 18 to 21 September while thirteen rows sat in
#      that state.
#
#   2. **Every file at or below the live watermark is in the ledger.** One that
#      is not can never be applied, because `db push` runs pending migrations
#      in version order and that one is in the past.
#
#   3. **`ledger.snapshot` still describes the live ledger.** Staleness here is
#      ordinary — every successful deploy causes it — so it is reported and does
#      not fail. What it costs is the accuracy of every offline guard, which is
#      worth a line of output rather than a red build.
#
# What it **cannot** check is whether a file's text is what production ran, and
# that is a measurement rather than an omission. The ledger does not store the
# file; it stores the CLI's re-serialisation of the statements it parsed out of
# it. Three migrations applied by `db push` on 21 September:
#
#     file                              file bytes   ledger bytes
#     20260921174500_index_lti…              1,584          1,582
#     20260921211500_pin_profile_school      7,176          7,168
#     20260921215800_feedback                6,037          6,016
#
# No md5 matches, and the difference is not a trailing newline — stripping
# whitespace off the first leaves 1,583 against 1,582. It is whatever the
# parser did with blank lines and terminators, which is not something to
# reimplement and bet a gate on.
#
# `history/MANIFEST` does compare md5s and is right to: those files were
# *reconstructed from* the ledger's own text, so equality is the property they
# were built to have. It proves the record has not been edited since. It does
# not prove a migration in `migrations/` is what ran, and reading it that way
# is the mistake this paragraph is here to prevent.
#
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

MIGRATIONS=$here/migrations
SNAPSHOT=$here/ledger.snapshot

from=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --from) from=${2:-}; shift 2 ;;
    -h|--help) sed -n '2,70p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

# ── The reading ───────────────────────────────────────────────────────────
#
# `--from` takes a file of `version name` lines, which is both how this is
# tested without a project and how somebody with a reading already in hand can
# use it. Otherwise the Management API is asked directly. The project is read
# from `config.toml` rather than written here, the same way `check.sh` reads
# the Postgres major from it, so a fork pointed at its own project is asked
# about its own project.
live=$(mktemp); trap 'rm -f "$live"' EXIT

if [ -n "$from" ]; then
  [ -f "$from" ] || { echo "No such reading: $from" >&2; exit 2; }
  sed -e 's/#.*//' "$from" | awk 'NF {print $1, $2}' | sort > "$live"
  origin="$from"
else
  ref=${SUPABASE_PROJECT_REF:-$(sed -nE 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"([a-z]+)".*/\1/p' \
    "$here/config.toml" | head -1)}
  if [ -z "$ref" ]; then
    echo "No project_id in supabase/config.toml and no SUPABASE_PROJECT_REF." >&2
    exit 2
  fi
  if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
    echo "No SUPABASE_ACCESS_TOKEN, so the live ledger cannot be read." >&2
    echo "Make one at supabase.com/dashboard/account/tokens, or pass a reading" >&2
    echo "you already have with --from FILE." >&2
    exit 2
  fi
  body='{"query":"select version, name from supabase_migrations.schema_migrations order by version"}'
  if ! out=$(curl -fsS -X POST \
      "https://api.supabase.com/v1/projects/$ref/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body" 2>&1); then
    echo "Could not read the ledger from project $ref:" >&2
    echo "$out" | head -3 >&2
    exit 2
  fi
  printf '%s' "$out" | python3 -c '
import json, sys
rows = json.load(sys.stdin)
for r in rows:
    print(r["version"], r["name"])
' | sort > "$live"
  origin="project $ref"
fi

# The control, before anything is concluded from the reading. An empty one
# makes every comparison below vacuously clean — which is the shape of failure
# this repository keeps finding in its own instruments, and the reason
# `ledger.snapshot` carries the same check.
rows=$(wc -l < "$live" | tr -d ' ')
if [ "$rows" -lt 8 ]; then
  echo "The ledger read back $rows rows from $origin, which is fewer than the" >&2
  echo "eight baseline migrations this project has had since 1 September. That" >&2
  echo "is a broken reading rather than an empty database." >&2
  exit 2
fi

echo "· $rows rows, read from $origin"

versions=$(awk '{print $1}' "$live")
watermark=$(printf '%s\n' "$versions" | tail -1)
files=$(cd "$MIGRATIONS" && ls -1 *.sql 2>/dev/null | cut -c1-14 | sort)

fault=0

# ── 1 · A live row with no file ───────────────────────────────────────────
missing=$(comm -23 <(printf '%s\n' "$versions") <(printf '%s\n' "$files") || true)
if [ -n "$missing" ]; then
  echo "✗ these versions are in the ledger and have no file in migrations/:" >&2
  while read -r v; do
    [ -n "$v" ] || continue
    echo "    $v $(awk -v v="$v" '$1 == v {$1=""; print substr($0,2)}' "$live")" >&2
  done <<< "$missing"
  echo "  \`db push\` refuses before it orders anything while this is true:" >&2
  echo "  \"Remote migration versions not found in local migrations directory\"." >&2
  fault=1
else
  echo "· every applied version has a file where db push looks"
fi

# ── 2 · A file below the watermark that never ran ─────────────────────────
stranded=$(comm -13 <(printf '%s\n' "$versions") <(printf '%s\n' "$files") \
  | awk -v w="$watermark" '$1 != "" && $1 < w' || true)
if [ -n "$stranded" ]; then
  echo "✗ these files are at or below the watermark $watermark and never ran:" >&2
  while read -r v; do
    [ -n "$v" ] || continue
    echo "    $(cd "$MIGRATIONS" && ls -1 "$v"*.sql)" >&2
  done <<< "$stranded"
  echo "  A pending version below the watermark cannot be applied: db push runs" >&2
  echo "  them in version order, and that one is in the past." >&2
  fault=1
else
  echo "· nothing on disk is numbered behind the watermark $watermark"
fi

# ── 3 · The snapshot, which is allowed to be behind ───────────────────────
#
# Reported rather than failed, and the distinction is the whole reason this
# section is separate. A deploy landing makes the snapshot stale *by working*.
# A gate that goes red every time production succeeds is one people route
# around, which is how `rehearse.sh` came to fail every branch in the
# repository for four merges running.
snap=$(sed -e 's/#.*//' "$SNAPSHOT" | awk 'NF {print $1}' | sort)
behind=$(comm -23 <(printf '%s\n' "$versions") <(printf '%s\n' "$snap") || true)
ahead=$(comm -13 <(printf '%s\n' "$versions") <(printf '%s\n' "$snap") || true)
if [ -n "$behind" ] || [ -n "$ahead" ]; then
  echo "! supabase/ledger.snapshot no longer matches the live ledger."
  [ -n "$behind" ] && echo "!   the project has, and the snapshot does not: $(printf '%s' "$behind" | tr '\n' ' ')"
  [ -n "$ahead" ]  && echo "!   the snapshot has, and the project does not: $(printf '%s' "$ahead" | tr '\n' ' ')"
  echo "!   Every offline guard — migrationorder, ledgerfiles, rollback, rehearse"
  echo "!   — is held to that file, so until it is re-read they are answering"
  echo "!   about a database that has moved. This is not a failure: a deploy"
  echo "!   landing is what causes it."
else
  echo "· supabase/ledger.snapshot matches, so the offline guards are current"
fi

if [ "$fault" != 0 ]; then
  echo "✗ the repository and the live ledger disagree in a way that breaks a deploy" >&2
  exit 1
fi
echo "· no drift that would stop a deploy"
