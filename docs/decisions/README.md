# Decisions

D-001 to D-160 are sections of [`../DECISION-LOG.md`](../DECISION-LOG.md).
Every decision after them is a file of its own here, named for the pull
request that records it: `D-<pull request number>.md`.

## Why

The log numbered decisions in turn, and on 30 September that broke every
time two pull requests were open at once:

- both took the next number;
- both appended to the end of the same file, so git conflicted;
- the one that merged second had to renumber, rebase and wait for CI again.

One pull request was renumbered nine times that day, from D-139 to D-154.
Once, two sections both called D-148 went through a clean rebase, and nothing
noticed.

A pull request's number is unique and is known as soon as the pull request is
opened. A file of its own touches no line anyone else is editing. Numbering by
pull request and writing one file per decision means two open pull requests
cannot collide.

## How

1. Open the pull request, as a draft if it is not ready.
2. Write `docs/decisions/D-<its number>.md`, starting with
   `## D-<its number> · <the decision, as a sentence>`, then the same body a
   log entry had: **Decided <date>.**, what was decided and why, and what is
   not done.
3. Cite it as `D-<its number>` wherever the log's numbers were cited.

A pull request that records two decisions writes the second as
`D-<its number>` plus a letter only if it truly cannot be one decision.
Prefer one.

`app/src/lib/ops/decisionlog.test.ts` holds the rules:
- no number is written down twice, anywhere;
- the log takes no new sections;
- each file here holds exactly the one decision it is named for.

## ADR program (Phase 0, 4 October 2026)

`D-<pull request number>` stays the record of *what was decided and shipped*.
The ADR program adds a second, separate namespace, `ADR-nnnn`, for the
architecturally significant decisions that are **still being made**: the 25
in [`DECISION_BACKLOG.md`](DECISION_BACKLOG.md). The two do not share numbers
and `written(root, 'ADR-0001')` stays false by design.

- Template: [`ADR_TEMPLATE.md`](ADR_TEMPLATE.md). Index: [`ADR_INDEX.md`](ADR_INDEX.md).
- An ADR lives in the folder of its status: `proposed/`, `accepted/`,
  `superseded/`, `deprecated/`. Moving a file is how its status changes; the
  status field inside it must agree.
- **Link the two when an ADR is accepted.** The pull request that accepts or
  implements an ADR writes its `D-<pr number>.md` as usual and the ADR cites it
  (and vice versa). A Proposed ADR has no D-number yet; that is correct.
- Governance: [`../governance/ADR_REVIEW_POLICY.md`](../governance/ADR_REVIEW_POLICY.md),
  [`../governance/DECISION_RIGHTS.md`](../governance/DECISION_RIGHTS.md).
- Nothing here is accepted. Every ADR in `proposed/` is a proposal drafted from
  repository evidence and awaits its named owner's review.
