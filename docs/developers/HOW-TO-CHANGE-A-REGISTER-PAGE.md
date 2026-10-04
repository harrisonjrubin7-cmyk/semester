# How to change a page that a register renders

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for changing a document that is generated from data in `app/src/lib/`; stop reading if the page has no `Rendered from` comment, because then you edit it by hand.

**Status:** LIVE.

Many pages in `docs/` and `ops/` are rendered from TypeScript data by a test and compared byte for byte. You can tell by the comment under the title, which has this form:

```markdown
<!-- Rendered from app/src/lib/ops/proofcalendar.ts by proofcalendar.test.ts. Edit the data, then run `npm run registers` from app/. -->
```

Editing the page by hand makes its test fail. Edit the data.

1. Find the data module and the test named in the comment.
2. Change the data. For example, a title in `WINDOW_TITLE` in `app/src/lib/ops/proofcalendar.ts`.
3. Run the test. It fails with `<page> is stale; run npm run registers from app/`.

   ```bash
   npx vitest run src/lib/ops/proofcalendar.test.ts
   ```

4. Regenerate the page. To rewrite one page, run its test with `REGISTERS=write`. To rewrite them all, run the script.

   ```bash
   REGISTERS=write npx vitest run src/lib/ops/proofcalendar.test.ts
   npm run registers
   ```

   `npm run registers` first runs `scripts/source-index.mjs`, then runs a long list of register tests with `REGISTERS=write`. It takes longer than one test. It was not run in full for this page.
5. Run the test again without the variable. It must pass.
6. Read the diff of the generated page. The diff is what reviewers see.
7. If you wrote a new register test, add its path to the `registers` script in `app/package.json`, or `npm run registers` will not regenerate it and its page will go stale unnoticed.

## What fails if you get it wrong

This was followed in a scratch copy on 2026-10-04.

| Step | Result |
| --- | --- |
| Changed `'Month 1'` to `'Month one'` in `proofcalendar.ts` | `proofcalendar.test.ts` failed 1 of 11: `docs/PROOF-CALENDAR.md is stale; run npm run registers from app/`. |
| `REGISTERS=write` on that test | 11 of 11 passed, and `docs/PROOF-CALENDAR.md` changed in one line: `## Month 1` became `## Month one`. |
| The test again without the variable | 11 of 11 passed. |

A generated page that quotes a count derived from the repository, such as the licence inventory in [`docs/SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md), follows the same rule: see [`HOW-TO-ADD-A-DEPENDENCY.md`](HOW-TO-ADD-A-DEPENDENCY.md).
