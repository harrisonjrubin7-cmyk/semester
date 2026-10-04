<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run `npm run registers`. -->

# Reliability scorecard (generated)

Satisfied of applicable. This is the baseline; the only direction a cell may move is from **no** to yes, and only by doing the thing.

| Class | Components | owner | backup | runbook | alert | measured | drilled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C0 | 4 | 4/4 | 0/4 | 4/4 | 0/4 | 0/3 | 1/4 |
| C1 | 17 | 17/17 | 0/17 | 17/17 | 2/17 | 0/2 | 0/17 |
| C2 | 28 | 28/28 | 0/28 | 28/28 | 2/28 | 0/4 | — |
| C3 | 12 | 12/12 | 0/12 | 12/12 | — | — | — |

Open cells: 135 (owner 0 · backup 61 · runbook 0 · alert 45 · measured 9 · drilled 20).

Single points of failure: platform, data, security, billing, ai, integrations, support.

## C0 and C1 detail

| Component | Class | owner | backup | runbook | alert | measured | drilled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `supabase-auth` | C0 | yes | **no** | yes | **no** | **no** | **no** |
| `supabase-db` | C0 | yes | **no** | yes | **no** | **no** | yes |
| `supabase-edge-runtime` | C0 | yes | **no** | yes | **no** | — | **no** |
| `github-pages` | C1 | yes | **no** | yes | **no** | **no** | **no** |
| `stripe` | C1 | yes | **no** | yes | **no** | — | **no** |
| `web-push` | C1 | yes | **no** | yes | **no** | — | **no** |
| `web-app` | C1 | yes | **no** | yes | **no** | **no** | **no** |
| `status-page` | C1 | yes | **no** | yes | **no** | — | **no** |
| `fn:billing-webhook` | C1 | yes | **no** | yes | **no** | — | **no** |
| `fn:push` | C1 | yes | **no** | yes | **no** | — | **no** |
| `fn:delete-account` | C0 | yes | **no** | yes | **no** | **no** | **no** |
| `queue:push_queue` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:push` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:institution-gateway-retention` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:community-retention` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:integration-retention` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:audit-retention` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:console-audit-integrity` | C1 | yes | **no** | yes | **no** | — | **no** |
| `job:ledger-chain-integrity` | C1 | yes | **no** | yes | **no** | — | **no** |
| `pipeline:schema-deploy` | C1 | yes | **no** | yes | yes | — | **no** |
| `pipeline:production-smoke` | C1 | yes | **no** | yes | yes | — | **no** |
