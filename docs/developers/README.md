# Contributor documentation

> **Type:** reference · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This is the index of the pages for people changing this repository; stop reading if you are using Semester or evaluating it, because none of these pages describe the product.

Start with [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for the flow, then [`ONBOARDING.md`](ONBOARDING.md) for a first run. [`CLAUDE.md`](../../CLAUDE.md) is the authority for working in this repository.

## Learn

| Page | Type | What it gives you |
| --- | --- | --- |
| [`ONBOARDING.md`](ONBOARDING.md) | tutorial | Clone to a first change: prerequisites, install, run, gates, the local gateway, the database checks. |

## Look up

| Page | Type | What it gives you |
| --- | --- | --- |
| [`REPO-MAP.md`](REPO-MAP.md) | reference | What lives in each directory, and the dependency rules a test enforces today. |
| [`CODING-STANDARDS.md`](CODING-STANDARDS.md) | reference | Each standard, what holds it, and a separate section of proposals that are not in force. |
| [`course-engine-ci.md`](course-engine-ci.md) | reference | The isolated Course Engine API, migration and web source gate. |

## Do

| Page | Type | What it gives you |
| --- | --- | --- |
| [`TESTING-GUIDE.md`](TESTING-GUIDE.md) | how-to | How the suite is arranged, how to write a guard and prove it fails, what CI runs. |
| [`HOW-TO-ADD-A-DECISION-RECORD.md`](HOW-TO-ADD-A-DECISION-RECORD.md) | how-to | A decision as `docs/decisions/D-<pull request number>.md`. |
| [`HOW-TO-ADD-AN-ADR.md`](HOW-TO-ADD-AN-ADR.md) | how-to | An architecture record in `docs/architecture/`. |
| [`HOW-TO-ADD-A-MIGRATION.md`](HOW-TO-ADD-A-MIGRATION.md) | how-to | A migration and its SQL check. |
| [`HOW-TO-ADD-A-GATEWAY-ROUTE.md`](HOW-TO-ADD-A-GATEWAY-ROUTE.md) | how-to | A route in the institution gateway. |
| [`HOW-TO-ADD-AN-EVENT-TYPE.md`](HOW-TO-ADD-AN-EVENT-TYPE.md) | how-to | A type in the domain event catalogue. |
| [`HOW-TO-ADD-AN-EDGE-FUNCTION.md`](HOW-TO-ADD-AN-EDGE-FUNCTION.md) | how-to | A Supabase edge function. |
| [`HOW-TO-CHANGE-A-REGISTER-PAGE.md`](HOW-TO-CHANGE-A-REGISTER-PAGE.md) | how-to | A page that is rendered from data. |
| [`HOW-TO-ADD-A-DEPENDENCY.md`](HOW-TO-ADD-A-DEPENDENCY.md) | how-to | An npm package or a GitHub Action. |
| [`HOW-TO-SHIP-BEHIND-A-FLAG.md`](HOW-TO-SHIP-BEHIND-A-FLAG.md) | how-to | A tenant feature flag and what must change with it. |

## How these pages are held

Every page here is held by one test, `app/src/lib/docs/developers.test.ts`. It checks that:

- each page has a title, a blank line and a card line with a known type, audience, owner and truth, and that `reference`, `how-to` and `tutorial` pages are `held`;
- every relative link resolves;
- every npm script name, `npx vitest run` path, repository path and environment variable name the pages quote exists;
- the map names every top-level directory and every directory of `app/src`;
- the standards page cites only scripts and files that exist, and keeps proposals in their own section;
- the facts each how-to relies on are still in the code.

The how-to pages end with a record of what failed when the procedure was followed in a scratch copy. That record is a dated reading. The test does not rerun it.

## Where the rest is

- `docs/README.md` is meant to index the rest of `docs/`. It is written outside this slice and may not be in your checkout yet.
- [`docs/architecture/README.md`](../architecture/README.md) indexes the architecture records.
- [`docs/target-architecture/README.md`](../target-architecture/README.md) is a proposal. Nothing in it is in force unless a page here says so.
