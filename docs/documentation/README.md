# The documentation system

> **Type:** explanation · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/docsystem.test.ts`

How Semester's documentation is organised, who it is for, who owns it, what
makes a page trustworthy, and what stops a page from lying. The front door for
readers is [`docs/README.md`](../README.md); this page is for the people who
write and review what is behind it.

## Why this exists

The repository holds about three hundred documents. Most are audits of a moment
or plans that were overtaken, and [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md)
already says which page wins for the company's own controls. What was missing was
the layer *for the people who use the thing*: a way into the pile by audience,
references that cannot disagree with the code, a way for a partner to build
against the gateway without reading its source, and a rule that a change is not
finished until the page that describes it is.

Three failures shaped the rules below, each of them already in this repository:

- **Prose that was wrong in both directions.** The market-readiness scorecard
  reported six built things absent. A page written from memory of the code is a
  claim about the code, and nothing was checking the claim.
- **A dead link found during an incident.** Hence
  `app/src/lib/runbooklinks.test.ts`, scoped to the operational set because 261
  dead links elsewhere were nobody's emergency.
- **Documents that describe the target as if it were the state.** Hence the
  status vocabulary (`LIVE`, `PARTIAL`, `PLANNED`…) in
  [`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md). Documentation in
  this system says what the product *does*; what it will do belongs in the
  roadmap and is labelled there.

## The four kinds of page

Pages are written to one purpose, because a page that tries to teach, instruct,
specify and justify at once does none of them. This is the
[Diátaxis](https://diataxis.fr) split, with the two kinds this company also
needs.

| Type | The reader is | It answers | It must not |
| --- | --- | --- | --- |
| `tutorial` | New, wants to succeed once | "Take me through it" | Offer choices; explain why |
| `how-to` | Competent, has a goal | "How do I do X?" | Teach concepts; list every option |
| `reference` | Mid-task, needs a fact | "What exactly is Y?" | Argue; narrate; be incomplete |
| `explanation` | Wants to understand | "Why is it like this?" | Give steps |
| `runbook` | Under pressure, something is wrong or being switched on | "What do I do now, in order?" | Assume the reader has context |
| `help` | A student, parent, instructor or administrator using the product | "How do I get this done in the app?" | Use internal vocabulary; describe a feature that is off |

Templates for each are in [`templates/`](templates/). Wording rules are in
[`STYLE-GUIDE.md`](STYLE-GUIDE.md).

## The card

Every page this system governs opens, directly under its title, with one
blockquote line — its **card**. It is the thing a gate can read and a reader
can trust at a glance.

```markdown
> **Type:** reference · **Audience:** partner-developers · **Owner:** `data` · **Truth:** generated · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/reference.test.ts`
```

| Field | Values | Meaning |
| --- | --- | --- |
| **Type** | `tutorial` `how-to` `reference` `explanation` `runbook` `help` `release` | One of the kinds above, or a release note |
| **Audience** | `students` `families` `faculty` `institution-admins` `implementers` `partner-developers` `contributors` `operators` `support` `buyers` `security-reviewers` | Who it is written for. More than one is allowed, comma-separated; more than two usually means the page should be two pages |
| **Owner** | A council seat, e.g. `engineering` | The seat accountable for the page being right. A seat, never a person, exactly as in [`LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md). Seats that are vacant or held by the founder acting are still the owner: the page says whose job it is, and the council page says who currently does it |
| **Truth** | `generated` `held` `reviewed` | How the page is kept honest — see below |
| **Reviewed** | `YYYY-MM-DD` | The day a person last read the page against the product or the code and it stood |
| **Held by** | A path, or `—` | The test or script that fails when the page and the product disagree. Required for `generated` and `held`; must name a file that exists |

### Truth: the three levels

The levels are not a ranking of effort. They are a statement of what *can* go
wrong with the page, so a reader knows how much to lean on it.

1. **`generated`** — a test renders the page from the code and fails if the
   file differs (`REGISTERS=write` rewrites it; the same convention the
   operating registers use). It cannot be out of date at a green build. Use for
   anything that is a list of what exists: routes, error codes, event types,
   edge functions, environment variables, flags.
2. **`held`** — the page is written by hand, and a test reads both the page and
   the code and fails when a named fact diverges (a route in the guide that the
   gateway does not serve, a command in onboarding that `package.json` lacks, a
   status the page claims that the register contradicts). Use for guides that
   quote specifics.
3. **`reviewed`** — a person read it against the product on the `Reviewed` date.
   Nothing else holds it. Allowed for explanation, help and runbooks, which
   describe judgement and screens, and **never** for `reference`. A runbook that
   has not been drilled says so in its first paragraph; "reviewed" is not
   "rehearsed".

A `reference` page that is `reviewed` is a failed gate, because a reference is
the page whose whole value is that it is exactly right.

## What goes where

```
docs/
├─ README.md              the front door: pick your audience, land on the page
├─ documentation/         this system: charter, style, ownership, gates, templates
├─ developers/            onboarding, standards, repo map, how-tos for contributors
├─ reference/             generated and held facts: API, events, errors, functions
├─ guides/                integration and implementation guides; examples live in /examples
├─ help/                  product help for students, families, faculty, administrators
├─ support/               support articles and the macros behind them
├─ releases/              release notes, the change-communication matrix
├─ architecture/          ADRs and architecture explanations (existing)
├─ decisions/             D-<PR>.md decision records (existing)
├─ trust/, security/, compliance/, legal/   trust and compliance material (existing)
└─ …                      the rest of the existing estate, indexed but not moved
```

**Nothing existing is moved or renumbered** (D-002 stands). Pages that already
exist are *indexed* from the front door and, where they are the authoritative
answer, linked from the new pages instead of being restated. A second copy of a
fact is a second place for it to be wrong.

Outside `docs/`: `CONTRIBUTING.md` at the root (the first file a new engineer
opens), `CLAUDE.md` (agent notes), `README.md` (the product), and
`examples/` (runnable reference applications, each with its own README that
carries a card).

## The rules

1. **A change is not finished until its page is.** The pull request that
   changes behaviour changes the page that describes it, in the same pull
   request. [`OWNERSHIP-AND-REVIEW.md`](OWNERSHIP-AND-REVIEW.md) says which pages
   a given path obliges, and `npm run docs:impact` (CI runs it) fails the pull
   request that touches such a path without touching any of them — or without
   saying, in the pull request body, `Docs: none because <reason>`.
2. **Describe what the product does, not what it should.** If a feature is
   switched off, partly built or sandbox-only, the page says so in the first
   screen with the word the truth table uses. Help pages for a capability that
   is not live do not exist; a *planned* thing is an explanation page or a
   roadmap row, never a how-to.
3. **Say it once.** A fact has one authoritative page. Others link to it. When a
   generated reference holds the fact, hand-written pages link to the reference
   rather than copy its values.
4. **Examples are tests.** A code sample in a guide is either extracted from a
   file under `examples/` that a test runs, or is a fragment short enough that
   the gate parses it. A sample nobody ran is a guess with syntax highlighting.
5. **No claim outruns its evidence.** Security, privacy, accessibility and
   compliance statements in any page follow
   [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)
   and the claims register. A page may say what a control *is* and where its
   evidence *is*; it may not say a company is compliant, certified or secure.
   Legal conclusions are for qualified counsel (see
   [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md)).
6. **A broken guard is not a guard.** Every test that holds a page has been
   shown to fail against a deliberate break (a renamed route, a deleted
   event) and then restored. The pull request says so, as
   [`CLAUDE.md`](../../CLAUDE.md) requires of every guard here.
7. **Plain, and the same word for the same thing.** One term per concept, the
   product's own words on the screen, and no internal register names in a page
   a student reads. [`STYLE-GUIDE.md`](STYLE-GUIDE.md) holds the glossary.

## The parts of the system

| Part | Page | What it settles |
| --- | --- | --- |
| Style and templates | [`STYLE-GUIDE.md`](STYLE-GUIDE.md), [`templates/`](templates/) | How a page is written; a skeleton for each type |
| Ownership, review, versioning | [`OWNERSHIP-AND-REVIEW.md`](OWNERSHIP-AND-REVIEW.md) | Who owns what, when review is due, what a change owes, how pages are versioned and retired |
| Quality gates | [`QUALITY-GATES.md`](QUALITY-GATES.md) | Every automated check, what it catches, how to run it, and what is still only a human's job |
| Discoverability | [`docs/README.md`](../README.md), [`INDEX.md`](INDEX.md) | The front door by audience; the full map of the estate |
| Release communication | [`../releases/README.md`](../releases/README.md) | Release notes, the change-communication matrix, deprecation notice |

## Where the system is thin

Stating this here so nobody discovers it by trusting something:

- **No page has been tested with a real reader.** Help pages are checked against
  the code and the truth table, not against a student who has never seen the
  app. The first pilot cohort is where that happens.
- **Owners are seats, and most seats are vacant or held by one person acting.**
  A review date is a commitment by a seat; today one person makes most of them.
- **There is no published documentation site.** The pages are Markdown in the
  repository and render on GitHub. A hosted, searchable site is a decision for
  [`docs/PUBLIC-SITE.md`](../PUBLIC-SITE.md) and the company site, not something
  this system assumes exists.
- **Translation is not covered.** Help is English; see
  [`LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md`](../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md).
