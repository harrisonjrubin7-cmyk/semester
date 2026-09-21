# Semester — implementation plan

What to build, in dependency order, for the requirements in
[`SEMESTER-MASTER-COMMAND.md`](SEMESTER-MASTER-COMMAND.md). Steps 2, 4 and 6 of
§63. What is already built is in
[`SEMESTER_IMPLEMENTATION_STATUS.md`](SEMESTER_IMPLEMENTATION_STATUS.md), and
every claim here rests on that file rather than repeating it.

§63 step 12: *"Do not skip foundational work to build visually impressive
later-stage features."* That sentence decides the whole order below. The
impressive things in this specification — a workload heatmap, a focus mode, a
study-buddy matcher, an organization page — each sit on top of a record that
does not exist yet, and building the surface first means building it twice.

## Step 4 — the current phase

**Part B, and near the end of it.** Twenty-four of §86–128's forty-three
sections are built; §90, §93, §106, §108, §127 and §128 are built past what
they ask for. The academic loop §86 draws runs end to end except at three
points, and all three are the same missing record.

**Part A has not started, and one of its rows is a P0.**

So the current phase is: close the P0, then finish Part B's foundation, then
begin Part A's.

---

## P0 — §58, the report that cannot be read

The only row in either part that is a defect rather than an absence, and the
only one the specification names outright: *"Do not implement report buttons
that disappear into nowhere."*

`public.reports` takes a report and keeps it. It has **no status column**, so
`OPEN / UNDER_REVIEW / RESOLVED / DISMISSED` has nowhere to live, and **no
select policy at all** — the migration says so in a comment — so no admin
interface can read the table even in principle.

It is a P0 rather than a feature because a student is being invited to do
something about being harassed, and the thing they do lands in a table nobody
can open. The app is honest about it on screen (`lib/classmates.ts`: *"Reports
are stored, not moderated. Nobody is watching a queue."*), which is why it is a
P0 and not an emergency — but honesty about a dead end is not the requirement.

Three pieces, in this order:

1. **A status column**, defaulting to `OPEN`, with a check constraint on the
   four values. A migration of its own.
2. **A select policy for admins.** `public.app_admins` and
   `private.is_app_admin()` landed on 21 September
   (`20260921161500_roles.sql:244`) and are exactly the identity this needs, so
   the policy is `using (private.is_app_admin())` and an update policy for the
   status alongside it. A check suite beside it: an admin sees a report, a
   verified student does not see their own, an anonymous caller sees nothing.
3. **A screen behind the admin gate** listing open reports with the message
   copy the table already keeps, and the four transitions.

Then the sentence in `lib/classmates.ts` changes, because it will no longer be
true — and it must not change before the queue exists.

**Nothing here is blocked and nothing here needs a decision.** It is the first
thing to build.

---

## Phase 1 — §91, the record the rest of Part B is waiting on

`Item` in `lib/types.ts:64` is what a deadline is, and against §91 it is
missing priority, estimated effort, attachments, subtasks, and five of seven
statuses.

The status gap is the load-bearing one. `lib/underway.ts` already made half of
this argument, for one of the five:

> A tick box has two positions and coursework has three. A paper you have
> written two pages of is not "not done" in any sense a person recognises, and
> it is certainly not done.

§91 is that argument continued to seven. It should be built the way
`underway.ts` built its one: **as facts that are independently true, not as an
enum that collapses them.** `SUBMITTED` and `GRADED` are not two points on the
line `done` already lives on — a paper can be submitted and ungraded for three
weeks, and `MISSED` is derived from the date and the absence of the others
rather than stored. Getting this wrong makes un-ticking lose information, which
is the exact mistake `state.started` exists to avoid.

Order within the phase:

1. **Status**, as above, plus the migration in `lib/migrate.ts` and a case in
   `state/keyread.test.ts`'s terms.
2. **Estimated effort**, stored per item. It is currently inferred per *kind*
   by `lib/worth.ts`; the inference stays as the default, and a stored value
   overrides it. §93's completion percentage and §98's rebalancing both read
   this.
3. **User-set priority**, likewise: `lib/worth.ts` computes one and §93 lists
   the user's own as a separate input.
4. **Subtasks** (§92). `lib/assignment.ts` already produces a plan and saves it
   as tasks; §92 wants those hanging off the item rather than beside it.
5. **Attachments and links.** Files already live in IndexedDB with notes
   holding their ids (`state/slices/notes.ts`); the same shape works here.

**Prove each one the way this repository proves things.** A stored field with
no reader is what the thirty-second pass cut out of the app and
`state/sessionread.test.ts` now guards against; a field added here without the
screen that reads it would be the same fault, added deliberately.

## Phase 2 — what Phase 1 unblocks

None of these can be built honestly first, and all of them are cheap after it.

| § | what | reads from Phase 1 |
| --- | --- | --- |
| 93 | completion percentage in the priority ranking | status, effort |
| 96 | workload heatmap | effort, per day |
| 98 | automatic study rebalancing | status, effort |
| 103 | study goals | `state.sessions` plus effort |
| 100 | focus mode | `lib/clocks.ts` and `state.liveSession` already exist |

§96 is the one to do first of these, because it is §86's loop closing: the
heatmap is the view that makes "when should I do it?" answerable from the
record rather than from the student's memory.

## Phase 3 — the small Part B gaps, any time

Independent of everything above, and each an afternoon:

- **§94 Agenda view.** Calendar has Day, Week, Month, Semester
  (`screens/Calendar.tsx:2832`). Agenda is the fifth.
- **§112 Socratic mode.** Nothing in the tree names it; the assistant
  (`lib/assistant.ts`, `ai/`) is where it goes, as a mode beside the others.
- **§116 Academic search**, scoped to one course's materials rather than
  app-wide.
- **§124 TA records** beside `Course.prof` and `Course.email`.
- **§88/§89 Course hub.** `screens/Courses.tsx` has three grains where §88 draws
  ten sections. This is an aggregation of things that already exist, so it is
  cheap — and it is the only Part B item whose value is mostly presentational,
  which by §63 step 12 is why it is here and not earlier.

---

## Part A, and the order its pieces actually have

Every Part A requirement past authentication rests on one of four records. One
of them — the university — landed on `origin/main` on 21 September while this
was being written, so three are left: a profile worth the name, a connection,
and a conversation. Two more — an organization and an event — rest on a
decision rather than on code.

### Phase 4 — §47.4, now that §47.2 has landed

**Half of this phase was built by another session while this plan was being
written,** and it is worth saying what that changes rather than quietly
deleting the row. `20260921170000_schools.sql` added `public.schools` and
`profiles.school_id`, with `claim_school()` checking the address the server
confirmed against that school's published domains and the column revoked from
the API roles so it cannot be self-declared. §47.2 is done, and done more
strongly than §47.2 asks.

What remains is **`public.profiles`**, which is five columns — handle, a
140-character bio, two timestamps, and now the school. §47.4 needs name, photo,
major, graduation year and interests on top of that, plus the privacy controls
over each. §47.3's onboarding writes into it; `state.aboutMe` and
`state.myName` are what it reads from on the device.

`private.school_of()` and `private.same_school(uuid)` arrived with the schools
migration and are the predicates the next two phases' policies should be
written against — "people at your university" is now a question the server can
answer, which it could not a day ago.

**Privacy-conscious defaults are a §57 requirement and should be built into the
column set rather than added over it** — a visibility value per field, defaulting
to private, decided once here rather than fourteen times later.

### Phase 5 — §47.8 connections, then §47.9 conversations

A connections table (request, accept, decline, remove; following and followers)
with row-level policies, and its check suite. `public.blocks` is the model to
follow: blocking is enforced in the database so a blocked person's words never
reach the device, and connections deserve the same treatment rather than a
client-side filter.

**Then, and only then, direct messages.** `public.messages` is keyed
`(term, code, user_id)` — a course room with no recipient column. §47.9 is a
second model beside it, not a widening of it: a conversation, its participants,
and a per-participant read cursor for the unread state. Block enforcement comes
free if the policy is written the way the room's was.

§47.13's notification types follow immediately: five of its six have no
entity today, and three of them exist the moment this phase does.

### Phase 6 — §47.10 and §47.11, once the decision is made

Organizations and events are **not blocked on engineering.** `lib/activities.ts`
refuses to compile an organization list, and gives its reasons:

> There is no list of Vanderbilt organisations compiled into this file either,
> and there will not be: there are several hundred, they change every year, and
> a list of invented or stale ones would be worse than no list, because
> somebody would email a president who graduated in 2021.

§53 agrees with that comment — *"Do not rely on manually editing hundreds of
hardcoded frontend objects"*, *"Build data import scripts that are
repeatable"* — and so does §47.14's *"Prefer authoritative/public data
sources"*. The requirement and the refusal are compatible the moment a real
repeatable source is named. Until one is, building the tables produces empty
pages, and §47.12 has a sentence for that too: *"Do not show fake personalized
modules."*

So this phase starts with an answer to one question — **what is the source of
organization and event data, and what refreshes it?** — and then it is
ordinary work: two tables, RSVP and follow as rows, and the entity pages §47.7
lists.

§61's demo flow is the acceptance test for this phase and the two before it.
Its steps 6 through 24 are precisely organizations, events, connections and
messages, in that order.

### Phase 7 — §54 and §55, if the promise changes

Analytics is blocked on a decision, not a dependency. The app tells students it
has none, in `lib/guidebook.ts:222` and `lib/privacy.ts:185`. If that changes,
§54's own instruction is the right shape — *"Create a clean analytics
abstraction rather than scattering tracking calls across the codebase"* — and
§55's metrics come off it.

---

## Blocked on the author, not on the program

§63 step 13 asks that these be documented exactly rather than worked around.

| | what is needed | where |
| --- | --- | --- |
| **Google OAuth** | switch the provider on in the Supabase dashboard and paste a client id and secret | `SETUP.md:268` |
| **Organization/event data source** | name a real, repeatable source, or agree there will not be one | §47.10, and `lib/activities.ts` |
| **The account promise** | §47.1 wants protected routes; the app tells students it has no account requirement | `lib/privacy.ts:185` |
| **The analytics promise** | §54 wants eleven tracked events; the app tells students it has none | `lib/guidebook.ts:222` |

The first is configuration. The other three are the author's product calls, and
§63 step 14 — *"Never replace a real integration requirement with fake success
behavior"* — is why none of them will be worked around here.

---

## How each batch is proved

§63 step 8 asks that each meaningful batch be tested. This repository's bar is
higher than passing, and [`CLAUDE.md`](CLAUDE.md) states it:

- **Revert the fix under the new test and watch it go red.** A guard that has
  never failed is not known to be a guard.
- **Include a control.** Measuring six suspects and finding six problems is
  also what a broken probe looks like.
- **Check `origin/main` for the defect before starting**, not for the title.
  Several sessions work this repository at once and converge; the duplicate
  index that made this branch's CI red on 21 September was two sessions fixing
  one missing index forty minutes apart.

Every gate runs from `app/` and is read by its exit status:

```bash
cd app
npx tsc -b && npm run lint && npm test && npm run test:shuffle && npm run build
```

and the database half from the repository root:

```bash
supabase/check.sh          # seventeen policy suites
```

Phases 4 through 6 are almost entirely row-level security, so `supabase/check.sh`
is the gate that matters for them: a policy is only ever wrong in a way you
notice when a second account is involved, which is what those suites are for.
