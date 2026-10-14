Files ending .mjs.txt: rename to .mjs before running (kept as .txt so the design-system bundler skips Node-only code).

Run node --test mock-adapter.test.mjs with Python3. No npm install. This is a separate JavaScript behavioral reference with SQLite mock backend, not the prior TypeScript adapter. No remote access. See runbook for actual test/green limitations.