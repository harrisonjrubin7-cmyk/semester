# How to add a dependency

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for adding an npm package to `app/` or a GitHub Action to a workflow; stop reading if you can write the few lines yourself, which the policy prefers.

**Status:** LIVE. The policy is [`docs/SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md), held by `app/src/lib/supplychain.test.ts`. A test fails on a licence or an Action nobody has named.

1. Decide that you need it. The pull request template asks what it is for and why an existing dependency or a few lines of your own code will not do; what it touches (student data, the network, the build only, or nothing at runtime); and its licence.
2. Check main for the dependency.
3. Install it from `app/`.

   ```bash
   npm install <package>
   ```

   Use `--save-dev` for anything the build or tests need but the shipped app does not. Commit both `app/package.json` and the root `package-lock.json`: npm run from `app/` edits the workspace manifest and the one lockfile at the root. CI installs with `npm ci` at the root, which uses the lockfile exactly.
4. Check the licence. `app/src/lib/supplychain.ts` has an `APPROVED` list. A package under a licence not on it fails the test until it has an entry in `NAMED` with the reason. A forbidden licence fails even with an entry.
5. The package must resolve from `registry.npmjs.org` and carry a sha512 integrity hash in the lockfile. A different source fails the test.
6. For a new GitHub Action, add it to `ACTIONS` in `supplychain.ts` with its publisher and what its token can do, pin it to a full commit SHA with its release in a comment, and make sure the workflow declares `permissions:`. Workflow files are under `.github/`, which has its own code owner entry.
7. Regenerate the licence inventory in `docs/SUPPLY-CHAIN.md`, which is rendered.

   ```bash
   REGISTERS=write npx vitest run src/lib/supplychain.test.ts
   ```

8. If the package ships to the browser, run `npm run build` and `npm run budgets`. Bundle budgets are in `app/perf-budgets.json`.
9. Run:

   ```bash
   npx vitest run src/lib/supplychain.test.ts
   ```

## What fails if you get it wrong

This was followed in a scratch copy on 2026-10-04 with `is-odd`, added with `npm install --package-lock-only` from `app/`; it changed `app/package.json` and the root `package-lock.json`, and nothing else.

| Step | Result |
| --- | --- |
| Package added, page not regenerated | `supplychain.test.ts` failed 1 of 24: `docs/SUPPLY-CHAIN.md is stale; run npm run registers from app/`. The MIT row had moved from 190 to 192 and the total from 291 to 293. |
| `REGISTERS=write` then the test | 24 of 24 passed. |

`is-odd` is an MIT-licensed package from the npm registry, so the licence and source checks passed. A package under an unlisted licence was not tried.
