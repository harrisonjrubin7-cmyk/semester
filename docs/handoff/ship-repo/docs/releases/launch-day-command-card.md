# Launch-day command card — registration readiness

**Before activation** (all must pass; any failure stops here)
```bash
pnpm registry:validate && pnpm db:migrate && pnpm test:contracts && pnpm test:policy
pnpm test:rls && pnpm test:tenant-isolation && pnpm test:workflow && pnpm test:a11y && pnpm test:ai-boundaries
pnpm evidence:collect && pnpm test:release-gate
```
**Scoped release record**
```bash
pnpm release:preview --capability registration_readiness --tenant vanderbilt --cohort approved-pilot-cohort
pnpm release:approve --release REL-READINESS-001     # only after every named approval is recorded
```
**Turn on for the named cohort only** (refuses if the gate is blocked)
```bash
pnpm flags:enable --flag registration_readiness_v1 --tenant vanderbilt --cohort approved-pilot-cohort
pnpm verify:first-live-journey --tenant vanderbilt --capability registration_readiness
```
**Emergency safe-off** (never blocked)
```bash
pnpm flags:disable --flag registration_readiness_v1 --tenant vanderbilt --reason "incident-or-control-failure"
pnpm incidents:create --template INC-SEC-001 --tenant vanderbilt
```
Preserve evidence, stop consequential processing, then begin recovery.

Not yet written (stubs referenced above): `scripts/release/{collect-evidence,preview,approve}.ts`, `scripts/ops/create-incident.ts`, `e2e/first-live-journey.spec.ts`. Write them in the repo against your actual tables.
