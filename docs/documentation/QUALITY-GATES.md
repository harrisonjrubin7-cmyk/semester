# Documentation quality gates

> **Type:** reference · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/docsystem.test.ts`

Every automated check on documentation: what it catches, what runs it, and how to
run it yourself. Read it when a docs check is red and you want to know what it
is for, or before you rely on a page and want to know what stands behind it.

All of them run in `npm test` from `app/` (so in CI's `build` job, in the
shuffled run, and in the time-zone runs) except the two that need git or the
clock, which have scripts and, for one of them, its own workflow.

```bash
cd app
npx vitest run src/lib/docs                 # every documentation gate
npm run docs:impact                         # does this branch document itself?
npm run docs:stale                          # which pages are due for a read?
REGISTERS=write npx vitest run src/lib/docs # rewrite the generated pages, then review the diff
```

## The gates

| Gate | Catches | Runs as |
| --- | --- | --- |
| **The card** — `docsystem.test.ts` | A governed page with no title, no card, a type, audience or owner outside the controlled lists, an owner that is not a council seat, a malformed date | `npm test` |
| **A reference is held** — `docsystem.test.ts` | A `reference` page whose only assurance is "reviewed" | `npm test` |
| **The holder exists and mentions the page** — `docsystem.test.ts` | A page that says a test holds it where the file is missing, or never names the page or its directory | `npm test` |
| **Generated pages are marked** — `docsystem.test.ts` | A `generated` page that does not say what rendered it | `npm test` |
| **Links resolve, headings included** — `docsystem.test.ts` | A dead relative link or a `#fragment` that matches no heading | `npm test` |
| **Reachable from the front door** — `docsystem.test.ts` | A page nobody can find: not linked, directly or through another governed page, from `docs/README.md` | `npm test` |
| **Indexes are complete** — `docsystem.test.ts` | A reference page missing from `docs/reference/README.md`; a guides folder missing from `docs/guides/README.md`; a governed folder with no README linked from the front door | `npm test` |
| **No filler** — `docsystem.test.ts` | The words [the style guide](STYLE-GUIDE.md#words-this-system-does-not-use) bans, in prose (not in code) | `npm test` |
| **No unqualified claim** — `docsystem.test.ts` | "FERPA compliant", "SOC 2 certified", "bank-grade", "100% secure" and the like, unless the sentence states an absence or a condition | `npm test` |
| **The index is current** — `docindex.test.ts` | `INDEX.md` out of step with the cards | `npm test`; `REGISTERS=write` rewrites it |
| **What a change owes** — `impact.test.ts`, `docs:impact`, `.github/workflows/docs.yml` | A pull request that changes a gateway, an edge function, a screen, a script or an example without touching a page that describes it, and without a `Docs: none because …` line | The test holds the rules; the script and workflow apply them to a real diff |
| **Release notes** — `releases.test.ts` | A note naming a change the changelog does not hold, or still carrying `TODO(edit)`; a note not listed in the releases README; a change class missing from the communication matrix | `npm test` |

The generated and held pages are each checked by the test named on their own
card. Those tests are written by the area they cover, and each is shown to go red
against a deliberate break before it is trusted.

## What stands behind each part

| Part | Held by | What it fails on |
| --- | --- | --- |
| `docs/reference/` | The reference tests named on each page's card | A route, error code, event type, edge function or environment variable that exists and is undocumented, or is documented and does not exist |
| `docs/guides/integrations/` and `examples/` | The examples test, which runs every example in-process | An example that no longer runs; a quoted fragment that no longer matches the file it came from |
| `docs/guides/institution/` | The institution-guides test | A role, label or status the guide names that the code does not have |
| `docs/help/`, `docs/support/` | The help and support tests | A UI label a page quotes that is not in the app; a retired word; a sentence too long to read |
| `docs/developers/`, `CONTRIBUTING.md` | The developers test | A command, script, file or directory a page names that does not exist; a top-level directory the repository map does not mention |
| `docs/trust/` pages in this system | The trust-documentation test | An unlisted trust document; control facts that differ from the sources they are counted from |
| `docs/releases/` | `releases.test.ts` | See above |

## Gates that already existed

These were here before this system and still do their jobs. This system does not
repeat them.

| Gate | Holds |
| --- | --- |
| [`runbooklinks.test.ts`](../../app/src/lib/runbooklinks.test.ts) | Every relative link in the operational runbooks |
| [`decisionlog.test.ts`](../../app/src/lib/ops/decisionlog.test.ts) | Decision numbers: none written twice, none added to the closed log |
| [`operatingsystem.test.ts`](../../app/src/lib/ops/operatingsystem.test.ts) | The company operating register and the pages it links |
| [`claims.test.ts`](../../app/src/lib/ops/claims.test.ts) | Every label on the public site against the claims register |
| `npm run lint` (`terms.mjs`, `labels.mjs`) | The retired words and the label rules on screens |
| `npm run registers` | Rewrites every register-rendered page from its data |

## What no gate checks

Saying this plainly is part of the design; a green docs build means less than it
looks like it does.

- **That a page is clear.** A test can bound sentence length; it cannot tell
  whether a student understood the step. Review does that, and for help pages no
  real student has yet.
- **That a procedure works end to end for someone who is not the author.** The
  tests check that the commands and labels exist, not that following the page
  from the top reaches the goal. The first pilot cohort is the test.
- **That a label is quoted from the right screen.** The help tests check that a
  string exists somewhere in the app's source, so a label that was renamed breaks
  the page but a label moved to a different screen does not.
- **That a runbook works under pressure.** Runbooks are `reviewed`, and say whether
  they have been drilled. Most have not.
- **That a claim is true.** The claim check finds the obvious forms. Whether
  "row-level security separates accounts" is true is the RLS check's job, and the
  page links the evidence rather than repeating it.
- **Staleness.** Nothing fails because a page is old; `docs:stale` reports it, and
  only when someone runs it. It is not scheduled.
- **Translation and reading level beyond sentence length.**

## Proving a gate is a gate

[`CLAUDE.md`](../../CLAUDE.md) requires every guard here to have failed once. The
card, claim, filler, link and reachability checks each have a control that feeds
the probe a made-up page that must fail and one that must pass, in the same test
file; delete the line that makes a probe work and its control goes red. The
authors of the generated and held references record, in their pull request, the
break they made — a renamed route, a deleted event — and the red message they saw.
