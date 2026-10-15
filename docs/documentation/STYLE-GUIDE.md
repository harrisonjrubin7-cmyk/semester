# Documentation style guide

> **Type:** reference · **Audience:** contributors · **Owner:** `product` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/docsystem.test.ts`

How a page in the governed set is written. This guide covers prose, structure,
code samples and claims; the words *inside the product* are settled by
[`SEMESTER-CONTENT-STANDARDS.md`](../design/SEMESTER-CONTENT-STANDARDS.md), which
a help page follows exactly and which `npm run lint` enforces on screens.

## Principles

1. **Say what it does.** Describe behaviour that exists and that you checked.
   A sentence you could not check is deleted or marked as unchecked.
2. **Put the answer first.** The first sentence after the card says what the page
   is for and who should stop reading. A reader who is in the wrong place leaves
   in five seconds instead of five minutes.
3. **One page, one job.** If a page has to choose between teaching and listing,
   it is two pages ([the four kinds](README.md#the-four-kinds-of-page)).
4. **The reader is doing something else.** They are mid-task, in an incident, or
   between lectures. Short sentences; the step before the reason; the reason only
   if it changes what they do.
5. **Say it once and link.** Link to the page that owns a fact instead of
   copying it. If a generated reference holds the value, do not retype the value.

## Sentences and words

| Do | Not |
| --- | --- |
| Present tense, active voice: "The gateway returns 503." | "A 503 will be returned." |
| Second person for instructions: "Open **Courses**." | "The user should open Courses." |
| One term per concept, every time | Alternating "tenant", "school", "institution", "campus" for one thing |
| The product's words for what a person sees: the label as written, in bold | A paraphrase of a button |
| A number or a name instead of an adjective | "Fast", "large", "many" |
| "Can" for what is possible, "must" for what is required, "does not" for what is not | "Should" for a rule; "may" for a permission |
| Dates as `2026-10-04` in references; "4 October 2026" in prose a person reads | "Last month", "recently", "soon" |
| Say what is *not* done: "No institution has been activated" | Silence that lets the reader assume |

Sentences over about thirty words usually hold two sentences. Paragraphs over
about five lines usually hold two paragraphs. Neither is checked; a reviewer
asks.

### Words this system does not use

The gate fails a page whose prose contains one of these. They sell where the
page should say, and each has a plainer replacement. Code and link targets are
not scanned, so a code sample, or a button label written in code formatting, is
safe.

| Word | Write instead |
| --- | --- |
| `simply`, `easily`, `effortless`, `effortlessly` | Delete it. If the step is easy, the steps will show it |
| `seamless`, `seamlessly` | Say what continues to work, for example "your open document stays open" |
| `powerful`, `robust`, `cutting-edge`, `world-class`, `best-in-class`, `revolutionary`, `game-changing`, `blazing`, `delightful`, `magical`, `next-generation` | Say what it does and what it was measured at |
| `leverage`, `utilize` | use |

### Claims

Documentation is where an unreviewed claim does the most damage, because a
buyer's security reviewer reads it as a statement of record. A page may say what
a control *is* and where its evidence *is*. It may not say Semester *is*
compliant, certified or conformant, or use "bank-grade", "military-grade",
"100% secure" and similar. A sentence that states an absence or a condition — "no
SOC 2 report exists", "FERPA posture is pending counsel review" — is the honest
form and passes. The rule, its sources and who approves a claim are in
[`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) and
[`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md).

## Status words

When a page's subject is not fully live, the first screen says so, using the
words of [`FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md):

| Word | Say it when |
| --- | --- |
| `LIVE` | It works for a real user today without further action by anyone |
| `IMPLEMENTED_NOT_RELEASED` | Built and tested; off by default or waiting on configuration |
| `PARTIAL` | Part of it exists; the page names what does not |
| `MOCK_DEMO` | Only seeded, sandbox or synthetic data sits behind it |
| `PLANNED` | Designed or written about; no working code path. Belongs in an explanation or the roadmap, never a how-to |
| `BLOCKED` | Waiting on an approval, credential, contract or decision outside the repository |

A sandbox is named a sandbox. A page that documents the institution gateway says,
in its first screen, that it currently runs against a sandbox adapter if that is
what the code wires.

## Structure

- **Title** names the thing as the reader will search for it. Sentence case. No
  "Guide to…", no colon-subtitles.
- **Headings** are nouns for references and verbs for how-tos. Two levels is
  usual; a third is a reason to split.
- **Steps** are numbered, one action each, with what the reader will see after
  the step when it is not obvious.
- **Tables** for anything with the same fields repeated. A table cell holds a
  clause, not a paragraph.
- **Admonitions** are plain bold lead-ins — **Note**, **Warning** — not images
  and not colour. Use one **Warning** only for an action that loses data or is
  hard to reverse, and put it *before* the step.
- **Links** are relative inside the repository and descriptive ("the
  [rollback runbook](../../ROLLBACK.md)", not "here"). External links are to
  standards or vendor documentation, never to a marketing page.

## Code and examples

- Every fenced block names its language: `bash`, `ts`, `json`, `sql`, `http`.
- A command is written the way it is run, from the directory it is run in — the
  directory is stated once above the block. In this repository that is almost
  always `app/` (see [`CLAUDE.md`](../../CLAUDE.md)).
- A request/response pair is a real one, captured from the running code. Do not
  hand-write a response body: a hand-written body is the commonest way a
  reference becomes fiction.
- A sample longer than a screen lives under `examples/`, is run by a test, and
  is quoted into the page. See rule 4 of the [charter](README.md#the-rules).
- No real person's name, email, ID number, token or private hostname appears in
  any sample. Use obviously fictional values (`example.edu`, `student-001`).
- Environment variables are named, never valued. Where a secret lives is
  [`SECRETS.md`](../../SECRETS.md)'s business.

## Accessibility of the page itself

Plain Markdown headings in order; alt text for any image, and no information that
exists only in an image; link text that makes sense out of context; tables with a
header row; no meaning carried by colour alone. A diagram has a text version
beside it or in the same section: the repository already uses Mermaid and ASCII
diagrams, and either is fine if the same facts are in the prose.

## Vocabulary for help pages

A help page uses the app's words and none of the company's. The retired words
(`action`, not "task" or "to-do"; `plan`, not "roadmap"; `assignment`, not
"homework"; and the rest in `app/src/content/terms.ts`) apply to documentation
a student reads exactly as they do to a screen. Register names, council seats,
gate ids and decision numbers belong in pages for contributors and operators,
not in help.
