# The university platform queue

Specification items 118–159, ordered against the repository that already
exists rather than against a blank one.

**Read the next section before picking anything up.** The brief that produced
this queue opened with an architectural correction — build one reusable
configuration and campus-data platform, populate institutions as data, do not
fork the app a hundred times — and that correction is already this codebase's
stated design rule. Half of what looks like new work is a gap in something
built, which is a different job from building it.

## The correction was already the rule

[`app/src/lib/school.ts`](../app/src/lib/school.ts) says it in its header, and
it is worth quoting because it sets the bar every item below is measured
against:

> So no screen asks "is this Vanderbilt?". Screens ask "does this school have
> a meal plan?", and Vanderbilt is the school that answers yes with swipes and
> a card called Commodore Cash. That single rule is what stops school support
> from being unbounded work: **adding a university is filling in a form, and if
> supporting one ever needs a code change then this abstraction is wrong and
> should be fixed rather than worked around.**

So the test for every item here is not "does it work for Harvard". It is
**"did supporting Harvard require a code change"**. If it did, the fix belongs
in the abstraction and not in a Harvard file.

What exists today, load-bearing for most of the queue:

| Piece | Where |
| --- | --- |
| Capability flags, not school branches | `app/src/lib/school.ts` |
| A documented, versioned pack format | [`docs/SCHOOL_DATA_PACK.md`](SCHOOL_DATA_PACK.md) |
| The pack importer | `app/src/lib/schoolpack.ts` |
| One school, compiled in | `app/src/data/schools/vanderbilt.json` |
| Multi-term calendars | `TermCalendar[]` in `school.ts` |
| Campus answers for the assistant | `app/src/ai/providers/campus.ts` |
| A live-connection gateway, registry deliberately empty | `app/server/institution/` |
| Why that registry stays empty | [`UNIVERSITY_CONNECTIONS.md`](UNIVERSITY_CONNECTIONS.md) |

## How to read the state column

| Marker | Means |
| --- | --- |
| `BUILT` | Exists and the named file is the evidence |
| `PARTIAL` | Exists in a form that does not yet meet the item; the gap is named |
| `TODO` | Nothing in the repository does this |
| `BLOCKED` | Cannot proceed without a decision or data this repository does not have |
| `CUT` | Deliberately not doing it, with the reason |

**How far this survey went, stated honestly.** Every `BUILT` row was read.
Every `PARTIAL` row was found by grep and sampled, not audited — the shape is
right and the detail may not be, so re-check the named file before building on
one. Three claims in the first draft of this table were wrong and were caught
by checking: terms are already a list rather than a single semester, the
assistant already has a campus provider, and the pack format already carries
an `importedAt`. Assume the same rate applies to what remains.

## The queue

Ordered by what unblocks what, not by item number.

### First, because it makes the rest safe to exist

Listing a hundred universities is a claim about a hundred institutions. Until
the app can say plainly what its relationship to each one is, the catalog is
the liability rather than the feature. These come first.

| Item | State | Note |
| --- | --- | --- |
| **156 Do not fake integrations** `BUILT` | `app/src/lib/readiness.ts` holds the five states; `app/src/screens/University.tsx` shows the current one above everything else on the screen, in a sentence rather than a label — *"It is not a customer, nothing is connected to its systems, and nobody there has agreed to anything."* The refusals are tested: no quantity of pack data reaches a connected level, and a configured integration against an institution that agreed to nothing is still shown as public data. The relationship registry is a table in the repository, deliberately not a field a data pack can carry. |
| **155 Readiness levels** `BUILT` | Levels 0–5 in `app/src/lib/readiness.ts`, derived with no setter and capped by what the relationship permits, shown on `app/src/screens/University.tsx`. Level 3+ needs the school's own gateway to report a connection — `connectionsFrom` reads `ConnectionStatus[]` and counts only `connected` — so every school here is level 2 while the adapter registry stays empty. Verified in a browser, not only in the suite. |
| **157 Public university mode** `TODO` | Depends on 156 landing first. |
| **158 Contracted mode** `TODO` | Depends on 156. |

### Then the data platform, which everything downstream reads

| Item | State | Note |
| --- | --- | --- |
| **129 One platform, no forks** `BUILT` | `app/src/lib/school.ts`. The rule exists; the queue is about honouring it. |
| **132 Tenant seed system** `PARTIAL` | `schoolpack.ts` + `app/src/data/schools/` is the seed system, for one school. Needs: many packs, and the database-backed path the item prefers over files. |
| **133 University data schema** `PARTIAL` | `SchoolData` covers roughly eight of the item's twenty categories — calendar, buildings, dining, housing, library, health, advising, registrar. Missing: departments, faculty, organizations, career, financial aid, transportation, recreation, IT, student services. |
| **134 Source registry** `TODO` | Today a pack carries `importedAt` and a `verified` flag. The item wants per-record `source_url`, `source_type`, `retrieved_at`, `verified_at`, `import_method`, `confidence`. This is the item that makes a hundred universities maintainable, and it is cheapest to add *before* there is data to backfill. |
| **130 Cohort configuration** `TODO` | `US_INITIAL_100` as data. Must not encode an ordinal ranking. |
| **131 Initial cohort** `BLOCKED` | See **The blocker** below. |
| **135 Freshness cadence** `TODO` | Depends on 134. |
| **136 Data health dashboard** `TODO` | Depends on 137. |
| **137 Completeness score** `TODO` | Depends on 133 and 134. The item says compute, never fabricate, percentages. |

### Then the abstractions that a second university will break

These are where "adding a university needed a code change" will first come
true. Each is a place the Vanderbilt shape is currently the only shape.

| Item | State | Note |
| --- | --- | --- |
| **145 Term configuration** `PARTIAL` | `TermCalendar[]` is already a list, so a quarter system fits structurally. Missing: named `registration_start`/`add_drop_deadline`/`withdrawal_deadline` fields — today these are free-text `deadlines[]` labels, which nothing can reason about. |
| **144 Academic structure** `TODO` | School → college → department → program → course, with per-institution terminology. |
| **146 Degree requirement providers** `TODO` | No degree-requirement logic exists to generalise yet, which makes this cheaper now than later. |
| **147 Campus resource taxonomy** `PARTIAL` | The capability flags are an ad-hoc taxonomy already. The item wants a named, closed set that institution-specific names map onto. |
| **148 Process engine** `TODO` | Prerequisite for 149. |
| **143 Branding** `TODO` | Sampled, not confirmed absent. Check before starting. |
| **142 University switching** `TODO` | Needs 156 first: switching between a customer and a public-data institution has to look different. |

### Then the assistant, where getting it wrong is the worst failure

| Item | State | Note |
| --- | --- | --- |
| **150 AI tenant grounding** `PARTIAL` | `app/src/ai/providers/campus.ts` exists, so campus context reaches the assistant. Whether retrieval is *scoped* — and what happens with two schools on one device — was not audited. **Audit this before building 149 on top of it.** The item calls cross-tenant leakage P0 and that is the right severity. |
| **149 Campus concierge** `TODO` | Depends on 148 and the 150 audit. |
| **151 Knowledge base** `TODO` | Depends on 134 for provenance. |
| **152 Knowledge freshness** `TODO` | Depends on 151. |

### Then the campus experience

| Item | State | Note |
| --- | --- | --- |
| **140 Campus-specific home** `PARTIAL` | Capabilities already drive navigation, which is most of this. Sampled, not audited. |
| **141 Campus-specific discover** `PARTIAL` | Same. Confirm scoping is by tenant and not by shipped-data coincidence. |
| **138 Data error reporting** `TODO` | Depends on 139 having somewhere to route to. |
| **139 Data review queue** `TODO` | |

### Then implementation and operations

| Item | State | Note |
| --- | --- | --- |
| **153 Onboarding automation** `TODO` | Depends on most of the data platform. |
| **154 Implementation template** `TODO` | |
| **121 Implementation estimator** `TODO` | Item says never emit a timeline unless labelled an estimate. |
| **122 Go-live checklist** `TODO` | |
| **123 Go-live gate** `TODO` | Depends on 122. |
| **124 Post-launch command center** `TODO` | |
| **125 Hypercare** `TODO` | |
| **126 Customer success workspace** `TODO` | |
| **127 Adoption analytics** `TODO` | Item's own constraint: do not turn Semester into surveillance software. `app/src/lib/privacy.ts` is the standard to hold it to. |
| **128 Adoption by module** `TODO` | Depends on 127. Report only statistically meaningful aggregates. |

### Last, the sales surface

Deliberately last: every one of these describes the platform, and a document
or a demo that describes capabilities the platform does not have is the exact
failure mode item 118 and item 156 both warn about.

| Item | State | Note |
| --- | --- | --- |
| **120 Sales engineering docs** `TODO` | Ten documents under `docs/sales-engineering/`. Each must match real capability; several cannot be written truthfully until the items above land. |
| **118 Sales demo flow** `TODO` | Eighteen steps. Needs every screen in the sequence to exist and to be honestly labelled where it is a demonstration. |
| **119 Executive demo mode** `TODO` | Impersonation across five roles. **Security-sensitive**: the item says never enable it in production accounts, and that has to be a mechanism, not a policy. Treat as its own review. |
| **159 Sales pipeline handoff** `BLOCKED` | The specification is truncated mid-sentence — it ends at `CONTRACT ↓` with nothing after. Needs the rest before it can be built. |

## The blocker

**Item 131 lists ninety-nine institutions, and this repository cannot supply
their data.**

The item asks for `official_domain`, `registrar_url`, `dining_url`,
`financial_aid_url` and a dozen more fields per institution, and item 133 says
"only populate information from legitimate sources". A model writing those
URLs from memory produces plausible, unverifiable, frequently-wrong strings —
and `SCHOOL_DATA_PACK.md` already refuses that shape of data for one school,
let alone a hundred.

So 130 (the cohort mechanism) is buildable now and 131 (its contents) is not,
until there is a decision about where the data comes from. The options are
roughly: an authoritative public dataset such as IPEDS for the institutional
identity fields; a scraper per institution with 134's provenance attached; or
hand-entry with review through 139. They are very different amounts of work
and only the first is plausibly automatable.

**Build 130 so the cohort is data. Leave it empty but for Vanderbilt until
that decision is made.** An empty cohort is honest; ninety-nine invented
registrar URLs are not, and they would be discovered one broken link at a time
by students.

## What this queue is not

It is not a commitment to ship forty-two items, and it is not an estimate. It
is the order they unblock each other in, and the evidence for what is already
done. Rows move to `BUILT` when something is merged, and
`app/src/lib/universityqueue.test.ts` fails if a row loses its state marker or
names a file that is not there — the same guard `roadmap.test.ts` puts on
`VIDEO_PODCAST_ROADMAP.md`, and for the same reason: this document is about
its own repository, so it can be wrong in ways nobody notices by reading it.
