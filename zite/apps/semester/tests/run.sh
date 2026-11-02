#!/bin/sh
# Runs every tests/*.test.ts: bundles each with esbuild (pure modules only, no zitejs imports) and runs it with node.
# Usage (from the workspace root): sh apps/semester/tests/run.sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d)"
STATUS=0
for f in "$DIR"/*.test.ts; do
  name="$(basename "$f" .ts)"
  printf 'import "%s";\nimport { report } from "%s/harness";\nreport("%s");\n' "$f" "$DIR" "$name" > "$OUT/$name.entry.ts"
  npx esbuild "$OUT/$name.entry.ts" --bundle --platform=node --format=esm --log-level=error --outfile="$OUT/$name.mjs"
  node "$OUT/$name.mjs" || STATUS=1
done
exit $STATUS
