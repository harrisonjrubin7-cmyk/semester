# Semester production integration brief

## Status and scope
Proposed repository patch against 4b4f8ca742242132f5b2dd254d23422ae70eaa7a. Production-oriented guidance, not a verified production-ready release. No remote changes. This patch adds documents and a local integration orchestrator only; no runtime feature, schema, dependency, package script or deployment configuration is changed. Existing documentation may contain dated observations: verify them against the target release.

## Platform contract
One account, Action Center, search, workspace, graph, source vocabulary and policy-controlled AI. Personal, institutional and company contexts remain separately authorized. Build native, integrate responsibly, transfer authority only by domain with evidence and institutional approval. Official, connected, personal and AI-assisted origin labels do not substitute for authority or freshness.

## Baseline inspected
SETUP.md; ROLLBACK.md; .github/workflows directory; ci.yml (returned excerpt); app/scripts/golden-path.mjs and account-sync.mjs (returned excerpts); docs directory. Prior turn inspected root/app manifests and infrastructure inventories. Main has advanced since the earlier production build inspection; do not assume matching versions. Truncated file returns are not full-file audits.

## Developer setup
Node requirement >=22 from root manifest; use the lockfile and current repository instructions.
```sh
npm ci
npm run dev --workspace app
npm run test --workspace app
npm run build --workspace app
npm run registry:validate
npm run platform-control:test
npm run release:check
npm run release:report
```
These are read/previously verified script names, not executed results. Prefer root workspace install to historical app-only installation instructions. Existing root scripts generate registry/release reports; review their side effects.

## Environment boundaries
Personal local mode is documented in SETUP.md as usable without account/server. Account sync requires approved Supabase configuration. Public VITE_* values are browser-visible; never place provider/service secrets in them. Inspect app/.env.example and current server policy before configuring. Server credentials belong in approved secret stores; do not commit or print them.
The setup guide contains historical deployment routes and provider decisions. A configured key does not establish provider activation. Identity-provider/domain claims do not establish real course enrollment or consequential authority.

## Architecture and workflow links
See ARCHITECTURE.md, ONBOARDING.md, MIGRATION.md, TEST-COVERAGE.md and DEPLOYMENT-ROLLBACK.md here. These coordinate existing records rather than create competing source-of-truth registries. Keep current activation in the existing platform-control registry.

## Local integration execution
Python 3.10+ orchestrator; npm, built preview, Playwright and browsers are prerequisites. This patch does not install them. Use existing CI preparation and golden-path/account-sync headers for exact harness setup. Do not test writes against production.
```sh
python docs/production-integration/run_integration.py --root . --mode personal-baseline --url http://localhost:4173/ --report /tmp/semester-baseline.json
python docs/production-integration/run_integration.py --root . --mode personal-account --url http://localhost:4173/ --sync-url http://localhost:4174/ --report /tmp/semester-account.json
python -m unittest discover -s docs/production-integration -p 'test_*.py' -v
```
Account scope requires SMOKE_SUPABASE_SERVICE_KEY from an ephemeral local stack; never pass production credentials. It also requires a separate build configured for that local stack, and locally served delete-account function dependencies. Consult existing account-sync CI for complete provisioning. Runner does not provision or deploy anything.

## Report semantics
Exit 0 means selected scope passed. Exit 1 means an assertion failed. Exit 2 means setup/instrument unavailable. Every report says production_ready=false because institutional, faculty, company and provider gates are outside these selected student suites. Child logs are captured but not included to avoid accidentally persisting credentials; run individual verified scripts directly for diagnostics in a safe environment.

## Apply proposed diff
From a clean worktree based on the pinned commit:
```sh
git apply --check semester-production-integration.patch
git apply semester-production-integration.patch
```
Patch filename is the delivered proposed artifact. Rebase/review against newer main first. Exact diff adds this new docs subtree only, with no DDL. New paths are proposed; they were not present under docs at the inspected baseline.
