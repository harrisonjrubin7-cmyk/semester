<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run `npm run registers`. -->

# Reliability scorecard (generated)

Satisfied of applicable. This is the baseline; the only direction a cell may move is from **no** to yes, and only by doing the thing.

| Class | Components | owner | backup | runbook | alert | measured | drilled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C0 | 4 | 4/4 | 0/4 | 4/4 | 0/4 | 0/3 | 1/4 |
| C1 | 18 | 18/18 | 0/18 | 18/18 | 2/18 | 0/2 | 0/18 |
| C2 | 29 | 29/29 | 0/29 | 29/29 | 2/29 | 0/4 | — |
| C3 | 15 | 15/15 | 0/15 | 15/15 | — | — | — |

Open cells: 143 (owner 0 · backup 66 · runbook 0 · alert 47 · measured 9 · drilled 21).

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
| `pipeline:drift` | C1 | yes | **no** | yes | **no** | — | **no** |
