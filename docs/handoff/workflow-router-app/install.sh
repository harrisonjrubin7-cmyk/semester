#!/bin/sh
set -e
find . -name "*.txt" ! -name "LICENSE.txt" | while read -r f; do mv "$f" "${f%.txt}"; done
[ -d app/benchmark/-suiteId- ] && mv app/benchmark/-suiteId- "app/benchmark/[suiteId]"
echo "Restored. Next: npm install && npm run typecheck && npm test && npm run build"
