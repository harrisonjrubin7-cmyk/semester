# Semester single-deployment release package (13 Oct)

From "Semester-single-deployment-release-package.pdf". Its code was cut off at the page edge, so every file here is reconstructed in full. **Nothing was run here** (no Python, Bash, Docker, Node or database). The PDF's own run: 12 checker tests OK, Bash syntax OK, OpenAPI parses; npm, hosted CI, Docker, SQL, RLS and Vercel not run.

**Branch verified:** `release/evidence-runbook-20261013` exists in harrisonjrubin7-cmyk/semester at `fb51d66` (main at creation). It has no `scripts/release/` yet — nothing has been committed to it, as the PDF says.

| File | Destination in repo |
|---|---|
| scripts/release/evidence_bundle.py | same |
| scripts/release/test_evidence_bundle.py | same (13 tests) |
| scripts/release/deploy-vercel.sh | same |
| .github/workflows/release-package-ci.yml | same — **adds to** existing CI |
| .github/workflows/release-vercel-gated.yml | same — exits at the gate blocker |
| deploy/Dockerfile.frontend, nginx.conf, compose.frontend.yml | deploy/ — frontend only |
| .dockerignore.proposed | merge into the existing .dockerignore |
| architecture/release-transport.openapi.json, .PROPOSED.sql | architecture/ — not applied |

## Changes from the PDF
1. **Vercel token no longer on the command line.** The PDF passed `--token "$VERCEL_TOKEN"` to every CLI call, which puts the secret in process lists and can echo it into CI logs. The CLI reads `VERCEL_TOKEN` from the environment.
2. **Symlinked evidence is refused.** `resolve()` follows links, so a link inside the bundle could point at any file with a matching hash. New test: `test_symlink`.
3. **Workflow input isn't spliced into the shell.** `"${{ inputs.action }}"` in `run:` became an env var; the gated workflow also refuses a candidate that isn't a 40-character SHA.
4. **Actions and images are placeholders, not tags.** The PDF used `@v4`/`@v5` and unpinned image tags; they're now `REPLACE_WITH_VERIFIED_FULL_COMMIT_SHA` / `@sha256:REPLACE…`. Resolve actions with `handoff/grading-ci-harness/tools/pin_actions.sh` (extend its list with setup-node and setup-python).
5. **Evidence tables are append-only** (UPDATE/DELETE raise) and duplicate bundles for the same target are rejected.
6. **The health check** in the Dockerfile exits non-zero on failure; the PDF line was truncated.

## Run order (yours — needs your machine and accounts)
```bash
git checkout release/evidence-runbook-20261013
cp -R <handoff>/release-package/{scripts,deploy,architecture,.github} .
python3 -m unittest discover -s scripts/release -p 'test_evidence_bundle.py' -v   # expect 13 OK
bash -n scripts/release/deploy-vercel.sh
scripts/release/deploy-vercel.sh plan
```
Then pin actions, open a PR, and let existing CI plus the supplemental job run. The gated deploy workflow stays blocked until the authenticated evaluator (step 5 of the PDF's sequence) exists — don't remove that step to get a deploy through.

## Unchanged from the PDF, and still true
- Integrity ≠ authorization: `release_authorized` is always false.
- Vercel rollback doesn't roll back Supabase functions, schema, secrets or external effects.
- The pilot commercial-status conflict isn't resolved by this package.
