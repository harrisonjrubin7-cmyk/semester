# One data contract — step 1

Step 1 of the two-phase plan: the contract as a document, and the mapping table
between it and what each client actually holds. **No code.** `packages/contract`
and the adapters are step 2, and the plan says to stop here and report.

This document does three things: state the contract, table what the app holds
against it, and name the places where the contract as written would break
something that currently works. The last of those is the part worth reading.

---

## 0. The blocker, first

**The website is not in this repository.** The plan's mapping table has a
"Website location" column and I cannot fill a single cell of it honestly.

What is here:

    project/_ds/industry-ec2ca40c-…/   the Industry design system (Phase 2)
    project/Semester.dc.html           the front door
    project/Semester Phone.dc.html     a phone mock
    project/Canvas.dc.html

What is not here, anywhere, checked by name and by content:

    Website_version_request/           the 58-route desktop client
    candidates/                        the nine alternates named in §2.6
    student-api.js                     the abstraction §"Rules" says to keep
    semweb:v1, semweb:custom:v1, …     no file in the repo mentions these keys

So §1.2 ("audit both clients and produce a mapping table") is half-doable. The
app column below is real, read out of the source. The website column is a
question, and inventing plausible-looking answers for it would be worse than
leaving it open — the whole point of a reconciliation table is that somebody
can trust it.

**What I need:** the website source in this repo, or a dump of its live
`semweb:*` keys from a browser with real data in it, or its type definitions.
Any of the three unblocks the other half.

One thing that can be settled without it, and is worth settling first, is §2.5:
if the website becomes *the desktop client at the same origin*, the
cross-origin sync problem disappears and roughly half of Phase 1 stops being
necessary at all. The plan already recommends that. Deciding it before building
adapters would avoid building adapters for an arrangement that is about to be
retired.

---

## 1. The contract

Version 1. Every type below is a record with the common envelope.

```ts
export const CONTRACT_VERSION = 1;

export interface Record_ {
  id: string;          // uuid v4, generated identically in both clients
  updatedAt: string;   // ISO 8601, UTC
  deletedAt?: string;  // ISO 8601, UTC. Soft deletes only.
  origin: 'app' | 'web';
}
```

| Type | Holds |
|---|---|
| `Term` | an academic term — id, name, startsOn?, endsOn?, status |
| `Course` | id, termId, code, title, professor, credits, meetings, grading, aiPolicy, source |
| `Item` | id, courseId, kind, title, dueAt?, startAt?, effortMin?, weight?, status, source, externalUid? |
| `Score` | id, courseId, itemId?, component, earned, possible |
| `Unit` | id, courseId, title, body, order |
| `Card` | id, unitId, front, back, sure?, outcome? |
| `Note` | id, courseId?, kind, body |
| `Sitting` | id, itemId?, startedAt, endedAt, focusMs |
| `Attend` | id, courseId, on, status |

### Rules

1. **Every record has `id`, `updatedAt`, `deletedAt`.** Soft deletes only.
2. **`id` is uuid v4, generated the same way in both clients.** Never derived
   from content or position. *(See §3.1 — this rule has two exceptions in the
   app today, one of them load-bearing.)*
3. **Dates are ISO 8601 strings in UTC.** Convert at the boundary, never in
   storage.
4. **`origin` is diagnostic only.** Never used for precedence.
5. **Anything not in the contract is client-local and never syncs**, and this
   document must list which fields those are, per client. The app's list is
   §4; the website's is unwritten for the reason in §0.

---

## 2. The mapping table — app side

Read out of `app/src/lib/types.ts`, `app/src/state/shape.ts`,
`app/src/lib/attend.ts`, `app/src/lib/session.ts` and `app/src/lib/grades.ts`.

| Contract type | App location | Shape today | Mismatch |
|---|---|---|---|
| `Term` | **none** | an academic term is a *string* (`'2026FA'`) on `Course.term`, plus `archivedTerms: string[]` | No record exists. `types.ts` *does* export `Term`, but it is `{t, d}` — a glossary term. **Name collision.** |
| `Course` | `state.courses[].course` | nested inside `CourseModule`, not top-level | `name`→`title`, `prof`→`professor`, `credits` is a **string**, `meets` is one free-text string vs structured `meetings`, `term?` optional |
| `Item` | `state.courses[].items[]` | nested in the module | `c`→`courseId`; date is **`{month (0-based), day, year?}` + `dueTime` free text**, not `dueAt`; `weight` is a string; no `status`, no `effortMin` |
| `Score` | `state.grades` | `Record<string, string>`, key `` `${courseId}:${index}` `` | **Not records at all** — a flat map, string values, positional key. See §3.1. |
| `Unit` | `state.courses[].guide` units | `{name, mastery, cards}` | **No `id`.** Order is array position. `mastery` is app-only. |
| `Card` | `Unit.cards[]` → `StudyCard` | `{q, a}` | **No `id`, no `unitId`.** `sure`/`outcome` live separately in `state.reviews`. |
| `Note` | `state.notes[]` | `{id, title, body, created, updated, courseId, fileIds}` | Closest match in the app. `updated` is a number, not ISO. No `kind`. |
| `Sitting` | `lib/session.ts` → `state.sittings[]` | `{id, courseId, kind, …}` | keyed to a course, not an `itemId` |
| `Attend` | `lib/attend.ts` → `state.attendance[]` | `Attended`, id is `` `courseId:date` `` | **Id is derived on purpose.** See §3.1. |

Not in the contract at all, and each is a real feature: `tasks`
(`PersonalTask`), `appointments`, `sources`, `applications`, `people`,
`letters`, `places`, `residences`, `costs`, `balances`, `feeds`, `windows`,
`registrar`, `requirements`. The plan needs to say whether these sync. Today
they do.

---

## 3. Mismatches, and what I would do about each

The plan says every mismatch gets a written resolution: which shape wins, and
what the conversion is. These are proposals — three of them are decisions
rather than conversions, and I would not make them alone.

### 3.1 Two derived ids, and only one is a bug

**`Attend.id = ` `` `courseId:date` `` — keep it, and change the rule.**

`lib/attend.ts` says why, and it is right:

> Derived rather than random, because that is what makes the sync merge
> correct without a special case: two devices marking the same class produce
> the same id, `union` keeps the newer `at`, and a duplicate can never become
> a second absence.

A uuid here would mean two devices marking the same class produce two records,
and the merge cannot tell they are the same meeting. Rule 2 would replace
working idempotence with a de-duplication special case. **My proposal: the
contract permits a derived id where the record is a fact about a
(entity, day) pair, and `Attend` is the named case.**

**`Score` key `` `${courseId}:${index}` `` — this one is a real bug.** The
index is the grading component's *position* in the syllabus. Re-import a
syllabus that adds a category at the top and every stored grade shifts to the
wrong component, silently. It is exactly what rule 2 exists to prevent.
Resolution: a uuid per `Score`, with `component` carrying the name it belongs
to, migrated by reading today's index against the course's grading array at
migration time.

### 3.2 Dates

`Item` holds `{month: 0-based, day, year?}` plus `dueTime` as free text —
*"exactly as the syllabus words it"*. That last part is not sloppiness: the
syllabus says "in class" or "before lecture" and the app deliberately does not
invent a clock time it does not have.

Resolution: `dueAt` is ISO where a real time exists; where the syllabus gives
none, `dueAt` is the date at local midnight **and the original string is kept**
in a client-local field. Losing "in class" to gain a fake `T00:00:00Z` would be
a downgrade the user can see.

### 3.3 `Term` is two different things

`types.ts` exports `Term = {t, d}` — a glossary term, used by the study guides.
The contract's `Term` is an academic term. Whichever name moves, it is a rename
across the study formats. Resolution: the contract keeps `Term`; the app's
glossary type is renamed `Definition` at the same time.

### 3.4 The big one: splitting the course module

The contract makes `Course`, `Item`, `Unit`, `Card` and `Score` five top-level
record types. Today they are one `CourseModule` JSON blob.

The `sync-per-record` branch argues explicitly against that split, and its
reasoning is on the record:

> Course modules are stored as JSON on purpose: a module is generated from a
> syllabus and read and written whole, and splitting it would cost the import
> pipeline, every study format, and sharing, to buy joins.

That branch drew the line at *what is genuinely a list of independent records*
— notes, tasks, appointments, papers — and left the module whole.

This is the one place where the new plan and the existing work point in
opposite directions, and it is a decision, not a conversion. **My read:** the
website needing to render and edit coursework is a genuinely new requirement
that the earlier reasoning did not have to serve, so the split is probably
right *for `Item` and `Score`* — those are the ones the website will write. But
`Unit` and `Card` are generated artefacts read whole by five study formats, and
splitting them buys nothing until something edits a single card. I would split
`Item` and `Score` now and leave `Unit`/`Card` inside the guide.

That is a recommendation, not a decision I should take on my own.

---

## 4. App fields that are client-local and must never sync

From `state/shape.ts`, and this list is a claim to check rather than an
assumption: `screen`, `nav`, `query`, `sheet` and the rest of the navigation
state; `look` (ground, accent, typeface, density — a device setting, not an
account one); `lastOpened`; `visited`; `notifs`; the `ai` conversation
threads (their own key, `semester.threads.v1`); `spend`; `lastSync`.

Everything else in `DEFAULT_PERSISTED` — 92 fields — is currently synced.

---

## 5. What is already done, and what it means for the plan

Two things landed before this plan arrived and change its shape:

**§1.3's IndexedDB migration is done.** It merged today (`395dd10`). The app is
already on per-record IndexedDB stores keyed by type — 30 stores, 92 fields
classified as 29 collections / 17 maps / 46 settings, classified *from the
merge map* rather than a hand list. `semester.v1` is left byte-identical as the
way back. So §1.3's parenthetical — *"if the IndexedDB migration has not run,
run it as part of this"* — is satisfied, and the contract is not being built on
a blob.

**§1.4's per-record sync is written but unmerged**, on `sync-per-record`
(rebased onto current main today, 3,581 tests passing). It carries the
tombstone work and a test — `resurrect.test.ts` — demonstrating the bug the
plan's tombstone requirement exists to fix: *a union merge cannot express a
deletion*, so a note deleted on a phone comes back from a laptop. That test
currently passes by describing what happens today; the branch's own note says
the proof is rewriting it to assert the opposite once the client half lands.

That branch is most of §1.4 already. It should be reviewed as part of this
plan rather than separately.

---

## 6. Open decisions, in the order they block things

1. **Origin** (§2.5) — same-origin desktop client, or two origins kept in
   sync? Answering this first may delete half of Phase 1. The plan already
   recommends same-origin.
2. **The course-module split** (§3.4) — all five types, or `Item` and `Score`
   only?
3. **Derived ids** (§3.1) — does the contract admit the `Attend` exception, or
   does attendance grow a de-duplication path?
4. **The fourteen types not in the contract** (§2) — do tasks, appointments,
   sources, applications, people, letters and the rest sync? They do today.
5. **The website source** (§0) — needed before the mapping table can be
   finished at all.
