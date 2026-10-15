# How to add a decision record

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for recording a product, engineering or policy decision as a file named for its pull request; stop reading if you are writing an architecture record, which is [`HOW-TO-ADD-AN-ADR.md`](HOW-TO-ADD-AN-ADR.md).

**Status:** LIVE. The rules are held by `app/src/lib/ops/decisionlog.test.ts`.

[`docs/DECISION-LOG.md`](../DECISION-LOG.md) holds decisions D-001 to D-160 and is closed. Every later decision is its own file, `docs/decisions/D-<pull request number>.md`. Two open pull requests cannot take the same number or edit the same lines. The reasons are in [`docs/decisions/README.md`](../decisions/README.md).

1. Check main for the decision itself, as [`CLAUDE.md`](../../CLAUDE.md) says.

   ```bash
   git fetch origin main
   git log --oneline -40 origin/main | grep -i <the-thing>
   ```

   If the decision has landed, stop. A merged decision is a decision.
2. Open the pull request first, as a draft if it is not ready. Note its number, `N`.
3. Create `docs/decisions/D-<N>.md`. The first line is a level-2 heading with the number and the decision as a sentence, then a middle dot, as in the existing files such as [`docs/decisions/D-1150.md`](../decisions/D-1150.md).

   ```markdown
   ## D-N · The decision, written as a sentence

   **Decided 4 Oct 2026.** What was decided, and why. What is not done.
   ```
4. Hold one decision to a file. If a pull request truly records two, the second is `D-N` plus a letter, but prefer one.
5. Cite the decision as `D-N` wherever the old log's numbers were cited.
6. Do not add a section to `docs/DECISION-LOG.md`.
7. Run the rules from `app/`.

   ```bash
   npx vitest run src/lib/ops/decisionlog.test.ts
   ```

## What fails if you get it wrong

| Mistake | Test that fails |
| --- | --- |
| A number written as the heading of two decisions, anywhere | `has no number written down twice, in the log or across the files` |
| A new section in `docs/DECISION-LOG.md` | `takes no new decision into the log` |
| A file whose name and heading disagree, or that holds two decisions | `names each decision file for the one decision it holds` |

The test cannot know that you opened the pull request first. That part is a convention.
