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

That question — **what is the source of organization and event data, and what
refreshes it?** — is answered below, in *The four product calls, decided*: the
source is the organizations themselves, writing their own pages under the role
grants [#703](https://github.com/harrisonjrubin7-cmyk/semester/pull/703)
landed. Nothing is seeded, so nothing goes stale. With that settled the phase
is ordinary work: two tables, RSVP and follow as rows, and the entity pages
§47.7 lists.

§61's demo flow is the acceptance test for this phase and the two before it.
Its steps 6 through 24 are precisely organizations, events, connections and
messages, in that order.

### Phase 7 — §55 on the device, and §54 only if the promise changes

Analytics was blocked on a decision rather than a dependency, and the decision
is below: the promise in `lib/guidebook.ts:222` and `lib/privacy.ts:185`
stands, and nothing is sent. §55's activation figures do not need it — they
are computable from state the device already holds, and the device is where a
student can see their own. That part is buildable now.

What the decision defers is the aggregate. If the author reverses it, §54's own
instruction is the right shape — *"Create a clean analytics abstraction rather
than scattering tracking calls across the codebase"* — and the sentence in
`lib/guidebook.ts` changes in the commit that sends the first event.

---

## The four product calls, decided

§63 step 13 asks that anything blocked on the author be documented exactly
rather than worked around. Four entries sat here for that reason. Three of
them were never really questions about what the author wants — they were
questions about what two documents mean when read together, and reading them
together answers all three. They are settled below, with what would have to
change to reverse each one.

One thing is still genuinely the author's, and it is configuration rather
than product:

| | what is needed | where |
| --- | --- | --- |
| **Google OAuth** | switch the provider on in the Supabase dashboard and paste a client id and secret | `SETUP.md:268` |

### 1. The account promise — §47.1 and §258 are one decision, and it is already made

§47.1 lists nine things and calls them required. Eight of them exist: sign up,
login, logout, email verification, password reset, persistent sessions,
account settings, account deletion. The ninth — **protected routes** — is the
only one that reads as a contradiction of `lib/privacy.ts:185`, which tells
students *"It works without an account"*.

It is not a contradiction, because §258 settles it in the same document.
§258 names what must work offline: *Schedule, Assignments, Recent notes,
Downloaded files, Study materials, Saved campus information.* That is the
academic core, and a route cannot be both protected and offline-first. §258
also draws the line for the other side — *"Do not promise offline capability
for features that require server confirmation"* — and every screen §47.1 is
really written for is on that side: a message to another student, an RSVP
another person can count, a report a moderator reads.

**Decided: the promise stands, and §47.1's protected routes are scoped to the
server-backed surfaces.** The academic core stays usable with no account,
because §258 requires it to be. Authentication is real — no mock login, no
hardcoded current user, per §47.1's closing line — and it is real *already*;
what changes is nothing, because the surfaces that need a gate are the ones
not yet built.

This decision carries an obligation for whoever builds them. The claim in
`lib/privacy.ts` is not decoration, and it is accurate today in a strong
sense: signed out, nothing leaves the device at all. The first feature that
makes that false changes the sentence **in the same commit** — *"It works
without an account"* becomes a claim about the academic core specifically.
Never the feature first and the copy after.

### 2. Analytics — §54's promise stands, and §55's question is still answerable

`lib/guidebook.ts:222` tells students the app *"has no account requirement and
no analytics, and signed out nothing leaves this device."* §54 asks for eleven
tracked events.

Seven of the eleven — connection request sent, connection accepted, message
sent, organization followed, event viewed, event RSVP, notification opened —
are events of features that do not exist. So the question today is narrower
than it looks: it is whether four events (account created, onboarding
completed, search performed, search result opened) are worth breaking a
sentence for.

**Decided: they are not, and the promise stands.** §54's own qualifiers argue
this side — *"privacy-conscious"*, *"Avoid collecting unnecessary sensitive
data"* — and a search query is about the most sensitive string this app holds.

That is not a decision to stop measuring. §55 asks *"Track whether people
actually use the product"* and lists activation: what fraction complete
onboarding, what fraction take one meaningful action. Every one of those
figures is computable from state the device already holds, and the device is
where the student can see their own. What §55 cannot have without a reversal
is the *aggregate*.

Reversing it is a coherent thing to want, and it has a shape: §54's own
instruction — *"Create a clean analytics abstraction rather than scattering
tracking calls across the codebase"* — plus opt-in, plus the same sign-in the
sync already uses, plus a new row in `lib/privacy.ts`'s `CLAIMS` naming
exactly what is sent. The sentence in `lib/guidebook.ts` changes in the commit
that sends the first event, not in the one after it.

### 3. Organizations and events — the source is the organizations

This was the one that looked most like a blocked question. `lib/activities.ts`
refuses to ship a hardcoded directory because a hardcoded directory goes stale
and then somebody emails a president who graduated in 2021; §53 and §47.14
agree with the refusal.

The answer was in §47.10 the whole time. It asks for *"Authorized organization
admins can edit profile"*, *"Create event"*, *"View membership requests"*.
An organization that maintains its own page **is** the repeatable source §53
asks for, and it is the only one that refreshes itself. There is no public
student-accessible API for Vanderbilt's organization directory to import from,
and there does not need to be one.

**Decided: build the tables user-generated, not seeded.** An organization page
exists when somebody holding a role over it creates it — which is precisely
what `private.holds_role()` and `public.role_grants` were built for in
[#703](https://github.com/harrisonjrubin7-cmyk/semester/pull/703). Nothing is
hardcoded, so nothing goes stale, and §47.12's *"Do not show fake personalized
modules"* holds by construction: an empty directory is empty because nobody
has written to it, not because a seed rotted.

`lib/activities.ts`'s comment stays exactly as it is. It refuses to *ship* a
directory; it never refused to let people write one.

### 4. Conflict resolution — §261 forbids silence, not last-write-wins

§261 asks for *"Your version / Server version / Merge"* and closes with
*"Avoid silently overwriting user work."* `lib/cloud.ts` already states its
reconciliation in its own header: what arrives from the account is merged
field by field through `lib/merge.ts`, so lists keep both sides; one record
edited on both devices is last-write-wins, and the file says so rather than
implying better.

The gap between those two is not the merge. It is the word **silently**.

**Decided: build the disclosure, not the three-way merge.** When a sync
replaces a record the device also edited, the app says which record and keeps
the copy that lost retrievable. §260's sync-status vocabulary — *Saved,
Saving, Offline, Syncing, Sync failed* — is the surface it belongs on, and
`lib/cloud.ts`'s own judgement stands: *"Anything cleverer is a
distributed-systems project, and pretending otherwise in the UI would be worse
than saying it plainly."* §261's prohibition is satisfied in full by not being
silent. Its three-pane UI is a means, and the cheaper means reaches the same
end.

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

---

# Queued: Part C, the second-pass gap analysis (§226–300)

Seventy-five sections, supplied after the plan above was written. They are
**queued rather than folded into the phases**, deliberately, and this section
says why and what the first move is.

## Why queued and not scheduled

§226 opens by forbidding exactly the thing that scheduling them now would be:

> Before adding additional surface-area features, audit everything specified so
> far.

Its deliverable is a matrix — `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md` —
classifying every feature across six states and thirteen defect flags. That
audit has to happen against the tree before any of §227–300 can be ordered,
because a third of them look, from a first reading, as though they may already
be built. Writing them into the phase list before measuring would produce the
same fault this plan's §0 already records once: **a name standing in for the
thing.**

## What the first reading suggests, and why it is not a verdict

Marked with the module that would settle each. **None of these has been
measured yet** — they are where the audit should start, not what it will find.

| § | likely state on a first reading | what would settle it |
| --- | --- | --- |
| 263 Draft recovery | **probably built** | `lib/draft.ts` exists and its docblock describes §263 almost exactly |
| 266 Import center | **probably built** | `lib/extract.ts` (PDF/DOCX/PPTX/text/zip), `lib/intake.ts`, `lib/import-review.ts` previews before committing |
| 267 Export center | **probably built** | `screens/Export.tsx`, `lib/export.ts`, `lib/docx.ts`, `lib/pdfout.ts` |
| 270 PDF → study material | **probably built** | the syllabus importer already does this *and* keeps the source reference §270 requires |
| 258 Offline-first review | **built by construction** | the app is offline-first; `lib/privacy.ts` states it to the student |
| 261 Conflict resolution | **probably absent, and argued against** | `lib/cloud.ts` says plainly that one record edited on two devices keeps the later edit, and that anything cleverer "is a distributed-systems project" |
| 229 Universal save | **partly** | `lib/bookmarks.ts` saves *places*, not entities |
| 247 Time zone system | **probably absent** | no timezone module in `lib/`; #619 fixed one instance in the ICS export |
| 249–250 i18n and locale | **probably absent** | no translation infrastructure in `lib/` |
| 236 Command center | **partly built** | `components/Command.tsx` and `lib/launcher.ts` exist; §236's list is wider than what they reach |
| 251–256 Global search 2.0 | **partly, and local only** | `screens/Search.tsx` makes no network call at all — see below |
| 230–235, 239–240 | **absent** | collections, share, comments, mentions, activity, inbox, requests — no module, and most need §47.8's social graph first |

Two entries there matter more than their row.

**§261 is a conflict, not a gap.** `lib/cloud.ts` argues its position and warns
against pretending otherwise in the UI. §261 asks for *Your version / Server
version / Merge*. That is a fourth item for the conflicts list above, and the
author's call rather than a program's.

**§258 is the third appearance of the offline promise.** §47.1 wants protected
routes, §54 wants analytics, and §258 wants the offline-first behaviour this
app already has. The first two conflict with the promise; the third depends on
it. Deciding §47.1 therefore decides §258 as well, and they should be settled
together rather than separately.

## The order, once the matrix exists

1. **§226 — the matrix.** Every feature, six states, thirteen flags. Measured,
   with the file that settles each row, the way
   [`SEMESTER_IMPLEMENTATION_STATUS.md`](SEMESTER_IMPLEMENTATION_STATUS.md)
   was. §226 says *"Do not merely document gaps. Fix them according to
   priority"* — so the matrix is the first commit, not the whole phase.
2. **§257 — search authorization, before §251 widens what search reaches.**
   §257 marks itself *critical*: search must apply authorization before
   returning records. It is the only section in Part C that is a security
   requirement rather than a feature.

   Measured: **`screens/Search.tsx` makes no network call.** Search today runs
   entirely over the device's own data, so §257 is satisfied *vacuously* —
   there is no shared index, so there is nothing to leak. That is not a
   property to be proud of; it is a property that disappears the instant §251
   adds People, Organizations, Jobs or Housing to what search can reach.

   So §257 is not a box already ticked. It is a constraint on §251, and the
   authorization has to land in the same change that gives search its first
   server-side record — never after it.
3. **§227–228 — the connection audit and the entity graph**, which decide the
   shape everything from §229 onward hangs off. §228 warns against
   overengineering it into a graph database; this repository's existing
   registry (`lib/nav.ts`, fifty-nine destinations) is the precedent for how
   much structure is enough.
4. **Everything else, by whatever the matrix says is broken rather than
   merely missing** — §226's own instruction.

## What Part C does not change

The P0 above it. `public.reports` still cannot be read by anybody, and nothing
in §226–300 supersedes that.
