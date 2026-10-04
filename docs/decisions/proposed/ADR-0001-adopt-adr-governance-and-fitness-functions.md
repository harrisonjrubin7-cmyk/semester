# ADR-0001 · Architecturally significant decisions are recorded as ADRs and kept true by automated fitness functions

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Decision-program owner (the repository's decision authority; held by the founder today, no named backup: `findings-platform.md` #7) |
| Deciders / reviewers | Founder (acceptance); platform/CI owner; security owner; counsel for any "counsel" row |
| Review date | 2026-11-04 |
| Phase / gate | Phase 0 exit; precondition for Phase 1 gate (a check that fails on a stale ADR is only useful once main can refuse a merge) |
| Related | `CLAUDE.md` ("A decision takes its pull request's number"); `docs/decisions/README.md` ("ADR program"); `docs/governance/ADR_REVIEW_POLICY.md`; `docs/governance/FITNESS_FUNCTIONS.md` #1, #13; `docs/architecture/0001..0012`; `docs/platform/adr/*` |
| Supersedes / superseded by | — (adds to `docs/architecture/0011` rules; supersedes nothing) |

## Context
- `D-<pull request number>` is the record of what was decided and shipped; the log closed at D-160 and one pull request was renumbered nine times before that (`CLAUDE.md`, `docs/decisions/README.md` "Why").
- The ADR program adds a second namespace `ADR-nnnn` for decisions still being made. `app/src/lib/ops/decisionlog.test.ts` exempts the sidecars and status folders (`ADR_SIDECARS`, lines 14-18, skip at line 42) and asserts `written(root, 'ADR-0001')` is false (line 55), so the two namespaces cannot collide by test, by design.
- Three other records already use bare four-digit numbers: `docs/architecture/0001..0012-*.md` (12 files, all "Accepted"), `docs/platform/adr/*.md` (9 slug-named files, e.g. `tenant-is-derived-never-submitted.md`, "not yet adopted by any route"), and the 25-item decision backlog this program drafts. A reader citing "0007" is ambiguous.
- No check covers any of them: `app/src/lib/runbooklinks.test.ts` scans only the `OPERATIONAL` list, not `docs/architecture/` or `docs/decisions/`; its header records 261 dead relative links on 27 Sep (`FITNESS_FUNCTIONS.md` #1).
- No check can block a merge: `rules/branches/main` and `rulesets` read `[]`, `branches/main` `protected:false` (`findings-platform.md` header, #2; `docs/BRANCH-PROTECTION.md` "Applied" table empty).
- Four of the twelve existing ADRs say their own adoption is partial: 0007 ("adoption by route is incremental"), 0008 ("no producer writes to the outbox yet"), 0004 ("not deployed"), 0001 ("under review").

## Problem
How does a proposed architectural decision become binding, stay linked to the code that implements it, and be shown stale when the code drifts, without a second numbering race and without prose that nothing enforces?

## Decision drivers
1. No number collisions between concurrent pull requests (the measured failure in `CLAUDE.md`).
2. Every Accepted ADR names a check that fails when the decision is violated (`ADR_REVIEW_POLICY.md` rule 3).
3. An agent never accepts an ADR; legal items reach counsel (`ADR_REVIEW_POLICY.md` "Lifecycle").
4. Existing accepted records are cited, not silently contradicted.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Extend `D-<pr>` only (write ADRs as `D-<pr>.md`) | One namespace; no collision by construction | A decision still being made has no pull request yet; `D-` means shipped | Rejected: conflates proposal with record |
| B. Continue `docs/architecture/0013+` | Reuses an existing folder | No status folders, no review date, no template; bare numbers keep clashing with `docs/platform/adr` and the backlog | Rejected |
| C. Separate `ADR-nnnn` namespace in `docs/decisions/{proposed,accepted,superseded,deprecated}/`, link to `D-<pr>` on acceptance | Matches `decisionlog.test.ts` exemption already on main; status = folder | Sequential numbers can race like the old log | Chosen, with a duplicate-number check (see Decision 3) |
| D. Tooling (adr-tools, log4brains) | Off-the-shelf lifecycle | New dependency; does not know `D-<pr>` or fitness names | Rejected for Phase 0 |

## Decision
**Recommended, unratified. Only the founder can accept it; no agent has.**
1. Adopt `ADR_TEMPLATE.md` and `ADR_REVIEW_POLICY.md`; an ADR is required for the changes the policy lists.
2. Cite existing records by path (`docs/architecture/0007-...`) and new ones as `ADR-nnnn`; never a bare number. Each ADR states what it adds to or supersedes.
3. `ADR-0001..0013` are reserved by this batch. Later numbers come from `ADR_INDEX.md`; `check-adr-links` fails on a duplicated number, so a race fails CI instead of renumbering silently. If races occur, switch to the pull request number as `D-` did.
4. Accepting or implementing pull request writes `docs/decisions/D-<its number>.md` and the ADR cites it.
5. Implement the twenty fitness functions in `FITNESS_FUNCTIONS.md` as `scripts/architecture/*` in the order that file gives; none is a gate until the branch ruleset is applied and read back.

## Consequences
- Positive: status and links become checkable; proposals stop being confused with shipped decisions.
- Negative: three numbering schemes persist (`D-`, `ADR-`, `docs/architecture/NNNN`); more files per change.
- Harder: a quick architectural change needs an ADR or `ADR-Exempt: <reason>` that a reviewer must agree to.

## Impact
- **Data / tenancy:** none directly.
- **Security:** changes to grants, FORCE RLS or definers become reviewable decisions (policy "When an ADR is required").
- **Privacy:** none directly.
- **Accessibility:** none directly (see ADR-0013).
- **Operations (SLO, alert, runbook, support):** one more CI step; single-person ownership stays a risk (`findings-commercial.md` #19, `findings-platform.md` #7).
- **Cost / commercial:** CI minutes only.

## Implementation
1. Merge the 13 proposed ADRs and `ADR_INDEX.md` in one pull request (open it first; Phase 0 batch numbers are fixed by the index).
2. Write `scripts/architecture/check-adr-links.mjs` (relative links in `docs/architecture/*.md`, `docs/decisions/**/*.md`, `docs/governance/*.md`; Status vs folder; `ADR-nnnn` cited with no file; duplicate numbers; Accepted ADR with no `D-<pr>`).
3. Run it in `ci.yml` job `build` beside `npm test`; extend `app/src/lib/ops/decisionlog.test.ts` so `docs/decisions/proposed/` files cannot be mistaken for `D-` numbers.
4. After the ruleset is applied (ADR-0012), add the check to its required contexts.

## Tests and verification
- `check-adr-links` must fail on: an ADR file in `proposed/` whose Status says Accepted; two files numbered `ADR-0003`; a relative link to a missing file; `ADR-0099` cited with no file. Revert each fix and watch it go red (`CLAUDE.md` "A guard that has never failed").
- Control: run it on the current tree; it must pass for the 13 ADRs and report the known dead links in `docs/architecture/` rather than skip the folder.
- `decisionlog.test.ts` must still fail when a `D-` number is written twice.

## Fitness functions
- `check-adr-links` (`scripts/architecture/check-adr-links.mjs`): any failing condition above; runs in `ci.yml` job `build`.
- `branch-protection-readback` (`scripts/architecture/branch-protection-readback.sh`): live ruleset lacks `pull_request` or `required_status_checks`; scheduled. Without it ADR checks do not gate.

## Rollback / reversal
Delete the check step and the folders' status rule; ADR files remain as notes. Cheap until an ADR is Accepted and a `D-<pr>` cites it.

## Open questions
- Whether the founder accepts a bare-number-free citation rule for existing records (touches 12 files' inbound links).
- Whether `docs/platform/adr/*` (9 files) join the program or stay a package-local record.
- Who is the second decider while the founder is the only operator (`findings-platform.md` #7).

## Addenda
(none)
