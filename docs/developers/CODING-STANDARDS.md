# Coding standards

> **Type:** reference · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page lists the standards that are enforced or actually practised in this repository and says what holds each one; stop reading if you want the standards the project hopes to adopt, which are in the last section and are not in force.

Every row says how the standard is held. A standard with no command, test or reviewer behind it is labelled `convention`. The test that holds this page checks that each script named in a row is in `app/package.json` and that each file named in a row exists.

## Enforced by a command that fails

Run all of these from `app/`. CI runs them in the `build` job of [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

| Standard | Held by | What fails |
| --- | --- | --- |
| The app typechecks. `tsconfig.app.json` sets `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch` and `verbatimModuleSyntax`. It does not set `strict`; the installed TypeScript 7.0.2 reports implicit `any` (TS7006) and `null` assigned to `string` (TS2322) anyway, measured on 2026-10-04. | `npx tsc -b` | Any type error, unused local or parameter, enum or namespace, or fallthrough. |
| The gateway, `app/api/` and `packages/institution/` typecheck under `module: NodeNext` with `strict: true`. | `npm run check:university` | TS1287 when gateway code imports a module that sits under `supabase/functions/`. |
| The video package typechecks. | `npm run check:video` | Any type error in `video/`. Run by CI only after `npm ci` in `video/`. |
| React hooks follow the rules of hooks, and no `switch` repeats a case. | `npm run lint` (oxlint, configured in `app/.oxlintrc.json`) | Both are set to `error`. Other oxlint findings are warnings, and `--max-warnings=25` fails the run above 25. |
| Type size, leading and spacing stay on the scale, and no design token is defined as itself. A per-file ledger records drift that exists, and a file may not exceed its ledger entry. | `npm run lint:styles`, part of `npm run lint`; rules in `app/src/styles/rules.ts`; ledger in `app/src/styles/budget.ts` | A value off the scale beyond the file's ledger entry, or a token defined as itself. `npm run lint:styles -- --fix` rewrites the ledger from the tree and the diff is the record. |
| Every form control has a name a screen reader can read, and no control loses its name to CSS at a width. | `npm run lint:labels`, part of `npm run lint`; rules in `app/src/a11y/labels.ts` | An unnamed control, or a name hidden by a stylesheet rule. |
| Retired words appear on screen no more often than the ledger allows. | `npm run lint:terms`, part of `npm run lint`; rules in `app/src/content/terms.ts`; ledger in `app/src/content/ledger.ts` | A file with more retired words than its ledger entry. `npm run lint:terms -- --fix` rewrites the ledger. |
| The bundle stays inside its byte budgets, per route. | `npm run budgets` after `npm run build`; figures in `app/perf-budgets.json` | First load, largest file or a route over its budget. |
| The surface a person must learn stays inside its counts: flags, kill switches, destinations, groups, plans, subprocessors. A budget that has drifted above its count also fails. | `app/src/lib/complexitybudgets.test.ts`; figures in `app/complexity-budgets.json` | A count over its budget, or a budget more than 10 per cent (at least 2) above its count. |
| Course data is consistent: figures, months and lesson audio line up. | `node pipeline/validate.mjs`, run from the repository root | Any inconsistency it reports. |
| No secret is committed. | The `secrets` job in `ci.yml` (gitleaks, configured in `.gitleaks.toml`) | A finding in the branch's changes or in any file the branch carries. |

## Enforced by a test

Run all of these with `npm test` from `app/`. Each is a file you can read.

| Standard | Held by |
| --- | --- |
| The top-level navigation is the approved list. No ad or tracking host in the source. Notifications are created only in the three named files. The rules are in [`docs/DO-NOT-BUILD.md`](../DO-NOT-BUILD.md), and the test reads that page, so a rule cannot be relaxed without the page changing. The page's other rules (for example no custom button, card or palette) are held by the style audit, `app/src/lib/contrast.test.ts` and review, as the page's own table says. | `app/src/donotbuild.test.ts` |
| Four company-level boundaries have a scan in this file: no service-role credential in anything a browser loads, no face library, screen capture only where the page allows it, and no relational database driver or connection string. The page lists all twelve boundaries and which are held by review only. | `app/src/lib/ops/boundaries.test.ts`; page at [`ops/strategic-boundaries/README.md`](../../ops/strategic-boundaries/README.md) |
| Every accent-and-ground pairing meets contrast against every surface it can sit on, for both faded strengths. A new ground is measured against every surface, not the one that flatters it. | `app/src/lib/contrast.test.ts` |
| A screen module renders inside `<Page>` or is listed with a reason in `FRAMELESS`. | `app/src/pageframe.test.ts` |
| Nothing is said only with colour or shape; focus, landmarks, motion, titles and modals follow the accessibility tests. | `app/src/a11y/tellings.test.ts` and the other files in `app/src/a11y/`, including `axe.test.tsx` |
| The width of a window changes how a capability is reached, never whether it can be. | `app/src/widthgate.test.ts` |
| No screen statically imports the assistant. | `app/src/aioptional.test.ts` |
| A screen gated on an AI key shows a gate that takes you there, not a paragraph naming it. | `app/src/keygate.test.ts` |
| A test that mocks a module runs in its own worker. | `app/src/isolation.test.ts` |
| A test that mounts a React root unmounts it in an after hook. | `app/src/rootunmount.test.ts` |
| Every flag defaults off, has an owner, a review date, a rollback and a capability binding; temporary flags expire; the registry page names every key. | `app/src/lib/flags.test.ts` |
| Every edge function is listed with the credential it answers to, and its source carries the evidence. | `app/src/lib/edgeguards.test.ts` |
| Edge functions import nothing over `https://`, are listed in `supabase/DEPLOY.md` and have a block in `supabase/config.toml`. | `app/src/lib/deployfunctions.test.ts` |
| Every function directory has a row in the deployment snapshot, and none sits outside the continuous pipeline. | `app/src/lib/functionsdeployed.test.ts` |
| A migration is numbered above the live ledger's last version, no version is claimed twice, and every created table enables row-level security in the repository. | `app/src/lib/migrationorder.test.ts`, `app/src/lib/tablerls.test.ts` |
| Every ledger row has a file. Recovered migrations stay out of the push. | `app/src/lib/ledgerfiles.test.ts`, `app/src/lib/migrationhistory.test.ts` |
| A decision is a file named for its pull request. No number is written twice. The log takes no new section. | `app/src/lib/ops/decisionlog.test.ts` |
| Licences, registry sources, workflow Actions (approved and pinned to a commit) and workflow token permissions. | `app/src/lib/supplychain.test.ts` |
| The branch-protection ruleset in the repository matches the CI job names. This holds the definition, not whether GitHub applies it. | `app/src/lib/branchprotection.test.ts` |
| CI runs `check:university`. | `app/src/lib/ci.test.ts` |
| The entry-chunk ceiling and the reading it is set from, both in [`REGRESSION-CHECKLIST.md`](../../REGRESSION-CHECKLIST.md), agree with each other. | `app/src/lib/checklist.test.ts` |
| The suite passes in other timezones and in a different order. | `npm run test:zones` and `npm run test:shuffle`; both run in CI |
| Pages that mirror a register are rendered from the data and compared byte for byte. | The register tests listed in the `registers` script in `app/package.json`; see [`HOW-TO-CHANGE-A-REGISTER-PAGE.md`](HOW-TO-CHANGE-A-REGISTER-PAGE.md) |
| The pages in `docs/developers/` and `CONTRIBUTING.md` quote real commands, paths and identifiers. | `app/src/lib/docs/developers.test.ts` |

## Enforced in the database

Run with `supabase/check.sh` from the repository root. It needs a PostgreSQL server of the major version in `supabase/config.toml`. CI runs it with `SEMESTER_CHECK_REAPPLY=1`.

| Standard | Held by |
| --- | --- |
| Every table in `public` has row-level security on; every `security definer` function pins its search path; no write policy is `true`; nothing in `private` is a client's to touch. | `supabase/rls-coverage.check.sql` |
| A function is reachable from the browser only if it is on an allowlist. | `supabase/grants.check.sql` |
| A second account sees only its own rows, for each feature's tables. | The feature's own `supabase/*.check.sql` suite |
| Every migration is idempotent: applied twice, the schema and the rows come out identical. | `SEMESTER_CHECK_REAPPLY=1 supabase/check.sh`; exceptions would be listed in `supabase/reapply.known`, which is empty |
| A new Core module has row-level security tests, an immutable history and a kill switch. | [`docs/DO-NOT-BUILD.md`](../DO-NOT-BUILD.md) rule 13, held by `app/src/site/modules.test.ts` and review |

## Practised and held by review

These are real, and a reviewer is the only holder. The pull request template in [`.github/pull_request_template.md`](../../.github/pull_request_template.md) asks the questions.

| Standard | Where it is written | Holder |
| --- | --- | --- |
| A fix says the failure it fixes and how it was measured. Commit messages carry figures, and the figures are checked. | [`CLAUDE.md`](../../CLAUDE.md) | Review. |
| A new guard is shown to fail against a revert of the fix, then restored. A guard has a control. | [`CLAUDE.md`](../../CLAUDE.md), [`TESTING-GUIDE.md`](TESTING-GUIDE.md) | A checkbox in the pull request template, and review. |
| A screen has one primary action, loading, empty, error and permission states, a source badge where it relies on outside data, and screenshots at 390 px and 1280 px. | [`docs/design/SEMESTER-UI-CONSTITUTION.md`](../design/SEMESTER-UI-CONSTITUTION.md) §9; [`docs/design/SCREEN-QUALITY-CHECKLIST.md`](../design/SCREEN-QUALITY-CHECKLIST.md) | The Screens section of the pull request template, and review. `app/src/screens/deadends.test.tsx` holds part of it. |
| A change above the lowest tier answers design, privacy, accessibility, data-owner and rollback questions in the pull request. | [`docs/operating-model/CHANGE-MANAGEMENT.md`](../operating-model/CHANGE-MANAGEMENT.md); `app/src/lib/governance/config-tiers.ts` | The Change advisory section of the template, and review. |
| A new module answers the ten questions, including its row in `app/src/lib/governance/pia.ts`. | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) | The New module section of the template, and review. |
| A feature is finished only when it meets the nine questions of the definition of done. | [`docs/DEFINITION-OF-DONE.md`](../DEFINITION-OF-DONE.md), rendered from `app/src/lib/launchcompleteness.ts` | Review. The page itself says question 1 is "asked at review; no test can ask it". |
| Every gate in [`REGRESSION-CHECKLIST.md`](../../REGRESSION-CHECKLIST.md) passes at the end of a phase. | [`REGRESSION-CHECKLIST.md`](../../REGRESSION-CHECKLIST.md) | The person running the phase. |
| A reviewer other than the author approves a change to `main`. | [`.github/CODEOWNERS`](../../.github/CODEOWNERS), [`docs/BRANCH-PROTECTION.md`](../BRANCH-PROTECTION.md) | Not active. The ruleset is a definition in the repository; the page's own Applied table reads "not yet applied". With one code owner, GitHub does not let that person approve their own pull request. |

## Convention

No command, test or reviewer checks these. They are written in [`CLAUDE.md`](../../CLAUDE.md) because getting them wrong cost time.

- Check `origin/main` for the thing itself before you start, and rebase onto it before you push.
- Run every npm command from `app/`. At the root there is no script and nothing fails.
- Name a new decision file after its pull request number, opening the pull request first. The test refuses a duplicate number but cannot know that you opened the pull request first.
- Say that a fix has landed and stop, rather than opening a second pull request.
- Keep code under `supabase/functions/` out of anything the gateway imports.
- A claim in documentation describes what the code does. Read the code before writing the sentence.

## Proposed, not enforced

[`docs/target-architecture/07-ENGINEERING-STANDARDS.md`](../target-architecture/07-ENGINEERING-STANDARDS.md) is a proposal from the architecture pack. None of the following is in force. Do not cite it as a rule, and do not write a how-to for it.

| Proposal | Status |
| --- | --- |
| Contract-first API with OpenAPI, generated clients, and an `oasdiff` breaking-change check. | Proposed, not enforced. No OpenAPI file or `oasdiff` step is in the repository. |
| Command and result envelopes (`CommandEnvelope`, `CommandResult`) as aliases over existing types. | Proposed, not enforced. |
| Idempotency keys on every command, with a stored request hash. | Proposed, not enforced. The gateway's two-phase action and the event receipts are the nearest existing pieces. |
| An event schema compatibility test in a separate event-schema package. | Proposed, not enforced. No such package exists. The event catalogue lives in `packages/institution/src/events.ts`. |
| Every policy action has a conformance case against row-level security. | Proposed, not enforced. |
| Flags with an expiry date for every type, evaluated server-side. | Proposed, not enforced. Today only release and experiment flags must expire. |
| Two approvals for named areas; a pull request size budget of 800 changed lines. | Proposed, not enforced. One code owner exists today. |
| Vendor SDKs behind a port in `platform/`. | Proposed, not enforced. The directory does not exist. |
| Fast-check property tests, chaos subset, isolation fuzz, k6 load profiles. | Proposed, not enforced. |
| CI runs every journey with every adapter replaced by a failing stub. | Proposed, not enforced. |

The proposal's own status line reads "proposed". Moving a row from this section to an enforced section needs the command or test to exist first.
