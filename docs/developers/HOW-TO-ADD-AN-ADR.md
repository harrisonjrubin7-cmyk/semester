# How to add an architecture decision record

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for recording a significant, lasting architecture decision as a numbered record in `docs/architecture/`; stop reading if the decision is a product or policy call, which is [`HOW-TO-ADD-A-DECISION-RECORD.md`](HOW-TO-ADD-A-DECISION-RECORD.md).

**Status:** LIVE for the format. The numbering rule is a convention; no test holds it.

Architecture records are in [`docs/architecture/`](../architecture/README.md), named with a four-digit number, a hyphen and a short title. The index says: one decision per file, and a record is added only when something real turns on it. A record indexes the reasoning that already lives in the source file it governs and adds what the source cannot carry: what was chosen, what it was chosen over, and what would have to change for it to be revisited.

1. Check main for the decision (`git fetch origin main`, then `git log --oneline -40 origin/main | grep -i <the-thing>`).
2. Take the next number. At the time of writing the last record is `0012`, so the next file starts `0013-`. Two open pull requests can collide on the same number, as decision numbers once did, so look at `origin/main` again just before you push. Numbering by pull request is a proposal in [`docs/target-architecture/07-ENGINEERING-STANDARDS.md`](../target-architecture/07-ENGINEERING-STANDARDS.md) and is not the rule today.
3. Copy the shape of an existing record such as [`docs/architecture/0008-event-envelope-and-outbox.md`](../architecture/0008-event-envelope-and-outbox.md): a title `NNNN · the decision`, a **Status:** line, then `## Decision`, `## Why`, `## How it is held`, `## What it was chosen over`, and `## What this constrains` where it applies.
4. In **How it is held**, name the tests, check files or review step that hold the decision. If nothing holds it, say so.
5. Add a row to the table in [`docs/architecture/README.md`](../architecture/README.md).
6. Cite the record by its number in the code or register that depends on it. Two tests resolve citations to files whose name starts with the number: `app/src/lib/ops/operatingsystem.test.ts` and `app/src/lib/ops/boundaries.test.ts` (for `ADR-NNNN`). A citation with no file fails there.
7. Run those tests from `app/`.

   ```bash
   npx vitest run src/lib/ops
   ```

## What holds this

Only the citation check in step 6. Nothing checks that the README table lists every file, or that the number is unused. A reviewer does.
