# Ownership, review and versioning

> **Type:** reference · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/impact.test.ts`

Who is accountable for a page, what a change owes the pages that describe it,
how and how often pages are reviewed, and how they are versioned and retired.
Read this before opening a pull request that changes behaviour.

## Ownership

Every governed page names an **owner** in its card. The owner is a seat of the
[launch readiness council](../LAUNCH-READINESS-COUNCIL.md), never a person: a seat
is accountable for the page being right, whoever happens to hold it. The seat
list is the `SEATS` constant in `app/src/lib/launchreadiness.ts`, and the card
check fails a page that names anything else.

Today most seats are held by the founder, acting, and some are vacant. That does
not change who owns a page — a vacant seat is still the owner of record, and the
[staleness report](#cadence) groups pages by owner so a gap shows up as a pile
of overdue pages under one seat rather than as nothing at all. The names behind
the seats are in [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md).

### Default owner by kind of page

The author chooses the seat whose decision the page describes. When in doubt,
use this table.

| The page describes… | Owner | Why that seat |
| --- | --- | --- |
| Gateway, edge functions, events, configuration, repository layout, standards | `engineering` | Decides reliability, release and rollback |
| Connectors, integration guides, source freshness, SIS/LMS adapters | `data` | Decides source quality and connector health |
| What a student, parent or instructor does in the product; the style guide | `product` | Decides the golden path and its acceptance criteria |
| Support articles, institution admin and implementation guides, release notes to customers | `success` | Decides onboarding, training, support and communication |
| Runbooks, monitoring, incident procedures | `operations` | Decides monitoring, on-call and release readiness |
| Security overview, access control, threat model | `security` | Decides the threat model and access controls |
| Privacy, retention, consent, data rights, terms | `privacy` | Decides the privacy and legal posture |
| Accessibility statements and help for assistive technology | `accessibility` | Decides WCAG/VPAT status |
| Moderation, reporting and safety escalation | `trust` | Decides reporting, escalation and moderation scope |

[`.github/CODEOWNERS`](../../.github/CODEOWNERS) has one owner for everything
today and says so. The seats above are accountability; CODEOWNERS is who GitHub
asks for approval. They converge when a second reviewer exists.

## What a change owes

**A change is not finished until the pages that describe it are.** Two
mechanisms hold that, for two different kinds of fact.

**A list of what exists** — routes, error codes, event types, edge functions,
environment variables — is held by a `generated` or `held` reference page whose
test goes red the moment the list and the code differ. You do not need to
remember: add a route and `docs/reference/` fails until it is documented, and the
failure names the route.

**A description of what a person experiences** — a screen, a procedure, an
onboarding step — cannot be diffed. For those, `npm run docs:impact` (run in CI
on every pull request) looks at what the branch changed and fails if it touched
a path in the table without touching any page that answers it.

```bash
cd app
npm run docs:impact              # your branch against origin/main
npm run docs:impact -- --base HEAD~3
```

| Rule | A change under… | Must also touch one of… | Because |
| --- | --- | --- | --- |
| `gateway` | `app/server/institution/`, `app/api/`, `packages/institution/src/` | `docs/reference/`, `docs/guides/`, `docs/decisions/` | The gateway, its contract package and its entry point are what the API, error and event references describe |
| `edge-functions` | `supabase/functions/` | `docs/reference/`, `docs/guides/`, `docs/decisions/` | EDGE-FUNCTIONS.md and CONFIGURATION.md describe every function |
| `integration-worker` | `app/server/integration/` | `docs/reference/`, `docs/guides/`, `docs/INTEGRATION-OPERATOR-RUNBOOK.md`, `docs/decisions/` | The operator runbook and integration guides describe how it behaves |
| `screens` | `app/src/screens/*.tsx` | `CHANGELOG.md`, `docs/help/`, `docs/support/` | The changelog says what a tester will see; help says how to use it; support says how to fix it |
| `tooling` | `app/package.json`, `app/scripts/`, `.github/workflows/`, `app/vite.config.ts`, `app/tsconfig*.json` | `docs/developers/`, `CONTRIBUTING.md`, `CLAUDE.md`, `REGRESSION-CHECKLIST.md`, `docs/decisions/` | Onboarding and the testing guide quote the commands |
| `examples` | `examples/` | `docs/guides/integrations/`, `examples/` | A guide quotes the code and a test holds the quotation |

Test files, `*.check.sql` and fixtures never fire a rule. The rules are data in
[`app/src/lib/docs/impact.ts`](../../app/src/lib/docs/impact.ts); this table is
held to it by [`impact.test.ts`](../../app/src/lib/docs/impact.test.ts).

### When no page needs to change

Some changes are real and invisible: a refactor, a comment, a rename inside a
file nobody documents. Say so, in a sentence, on a line of its own in the pull
request description or a commit message:

```text
Docs: none because the handler was split into two functions and nothing it returns changed
```

The reason needs at least ten characters and is printed in the CI log, so a
reviewer reads it. "Docs: none because n/a" is a waiver nobody should accept; a
reviewer who sees one asks.

### In the pull request

[`.github/pull_request_template.md`](../../.github/pull_request_template.md) asks,
for every change, which documentation moved with it. A change that adds a module,
a route, an event, a role or a flag also updates the register that lists it
(`SEMESTER-OPERATING-SYSTEM.md` links each register; `npm run registers` rewrites
the rendered ones).

## Review

Four things can be wrong with a page, and a different reader catches each.

| What can be wrong | Who catches it | When |
| --- | --- | --- |
| The page disagrees with the code or the product | The author, running the thing — and the gate where the page is `generated` or `held` | Before the pull request is opened |
| The page is unclear, long or in the wrong voice | A reviewer who did not write it, against the [style guide](STYLE-GUIDE.md) | In review |
| The page makes a claim about security, privacy, accessibility, AI or compliance | The `privacy` seat (qualified counsel for legal conclusions); the claim wording check in the gate catches only the obvious ones | Before merge, and listed in [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) if it states a legal position |
| The page cannot be used by someone who is not the author | A person from the page's audience, working only from the page | Before a help page or guide is first relied on; see [Where the system is thin](README.md#where-the-system-is-thin) |

The last row has not happened for any page yet. The first pilot cohort is where
it does.

A page that a customer, buyer or student reads is reviewed by someone other
than its author. With one code owner that reviewer is sometimes an agent or
the same person on another day; the pull request says which, honestly, so the
record shows how little independent review has happened.

## Cadence

Each type of page has a review interval. A page is **due** when its `Reviewed`
date is older than the interval, and **overdue** after that.

| Type | Interval | Why |
| --- | --- | --- |
| `reference`, `how-to`, `runbook`, `help` | 92 days | Read mid-task; wrong fastest |
| `tutorial`, `explanation` | 183 days | Ages slowly |
| `release` | 366 days | Dated by construction; reviewed only if reused as a template |

The intervals are `REVIEW_DAYS` in
[`app/src/lib/docs/card.ts`](../../app/src/lib/docs/card.ts).

```bash
cd app
npm run docs:stale                 # what is overdue and due soon, with the owning seat
npm run docs:stale -- --fail       # exit 1 if anything is overdue (for a scheduled job)
```

The gate does not fail on staleness: a test that goes red because the calendar
moved teaches people to ignore red. The report is meant to be run weekly by the
`engineering` seat. Nothing schedules it yet and it is not in
[`OPERATING-RHYTHM.md`](../operating-model/OPERATING-RHYTHM.md); until it is, an
overdue page is found only when someone runs the command.

**A review is a person reading the page against the product or the code and
either fixing it or confirming it stands.** Only then does the `Reviewed` date
change. Bumping the date to quiet the report is the failure this system exists
to prevent, and it looks exactly like diligence in a diff.

## Versioning

Pages are versioned by the repository, and nothing else.

- **A page's version is the commit it is read at.** There is no version number in
  a card, no `v2` copy of a page, and no published archive of old pages. `git log
  -- <page>` is the history and `git show <commit>:<page>` is an old version.
- **Pages follow `main`.** The live product deploys from `main` on every push
  ([`README.md`](../../README.md)), so the documentation on `main` is the
  documentation of what is deployed. A branch's pages describe that branch.
- **A cohort or an institution is pinned to a commit, not a version.** A release
  note ([`docs/releases/`](../releases/README.md)) records the commit it was cut
  from. If a pilot institution must be able to read what applied on the day it
  went live, the note's commit is the answer.
- **Interfaces carry their own versions, as the code has them.** The gateway,
  SCIM, the event catalog and the data contract each have a version in code; the
  reference page states that version and says what, if anything, the code does to
  keep it compatible. No page promises compatibility the code does not enforce.
  The compatibility policy proposed in
  [`07-ENGINEERING-STANDARDS.md`](../target-architecture/07-ENGINEERING-STANDARDS.md)
  is proposed, and is labelled that way wherever it is mentioned.

### Retiring a page

Nothing is deleted (D-002). A page that no longer describes the product gets one
line under its card, in the form `**Status:** superseded by [new page](path.md) on YYYY-MM-DD.`,
and its card's `Truth` becomes `reviewed` with `Held by` set to
`—`, because nothing should still be holding a page that is wrong on purpose.
The page keeps its place in [`INDEX.md`](INDEX.md), marked superseded, and the
page that replaces it takes over the inbound links.

### When a page and the code disagree

The code wins, and the page is wrong from that moment. It is a defect with an
owner — [`08-ORGANIZATION-AND-MILESTONES.md`](../target-architecture/08-ORGANIZATION-AND-MILESTONES.md)
says documentation debt counts — so fix the page in the same change if the code is
right, and fix the code if the page was the intent. Where a test holds the page it
will say so first.
