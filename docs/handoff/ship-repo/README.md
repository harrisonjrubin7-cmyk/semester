# Semester ship-ready repository package (13 Oct 2026)

From "continue outlinign expanding deepening stregthenin.pdf". Turns the handoff packages into one executable release system. **Nothing here has been installed, compiled, run or deployed.** Every evidence record starts as `pending`; the PDF's examples showed `accepted`/`pass` for tests that have never run, which would let an untested release through the gate.

Drop into the repo root (merge with existing `app/`, `supabase/`). Files ending `.ts.txt`/`.mjs.txt` were renamed so the design project doesn't compile them:
```bash
find . -name '*.ts.txt' -exec sh -c 'mv "$1" "${1%.txt}"' _ {} \; ; find . -name '*.mjs.txt' -exec sh -c 'mv "$1" "${1%.txt}"' _ {} \;
```

## Build order
1. **Executable repo** — `package.json` scripts, `.github/workflows/verify.yml`, `db/migrations/241_outbox.sql`, `scripts/fixtures/`, `scripts/registry/validate.ts`, `scripts/release/check-gate.ts`.
2. **Trust boundaries** — `scripts/verify/` (tenant-isolation, source-authority, provenance, ai-boundaries, contracts, rls), `packages/policy/`.
3. **Durable workflows** — `packages/workflow-engine/`, outbox claim with SKIP LOCKED.
4. **Institution kit** — `docs/implementation/institution-kit/` (16 templates), `docs/trust/status.yaml`.
5. **Release evidence** — `evidence/` manifests, all pending.
6. **Named-cohort launch** — `docs/releases/launch-day-command-card.md`.

## Required local check
```bash
pnpm install --frozen-lockfile && pnpm db:reset && pnpm db:seed:safe
pnpm lint && pnpm typecheck && pnpm test && pnpm test:contracts && pnpm test:policy
pnpm test:rls && pnpm test:tenant-isolation && pnpm test:workflow && pnpm test:a11y
pnpm test:release-gate && pnpm build
```
A release isn't ready because a prototype renders. It's ready when this chain passes and `evidence/release-gates/*.yaml` has every item accepted with a real run link.

## Corrections made to the PDF
- Evidence and accessibility results start `pending` (PDF showed accepted/pass with no runs).
- `readiness.rego`: the PDF's two `deny_reason :=` rules conflict when both match (Rego "complete rule" error). Rewritten with an ordered `else` chain and a default.
- Trust status uses "HECVAT (institution-required version)"; HECVAT 4 merged Full/Lite.
- `scripts/verify/*` run under vitest (`vitest run scripts/verify`), not `tsx`, because they're test files.
