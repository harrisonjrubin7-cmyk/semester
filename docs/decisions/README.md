# Decisions

D-001 to D-156 are sections of [`../DECISION-LOG.md`](../DECISION-LOG.md).
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
