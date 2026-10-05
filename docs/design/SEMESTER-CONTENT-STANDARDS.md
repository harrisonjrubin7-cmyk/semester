# Semester content standards

The words Semester uses, and the rules for writing new ones. It applies to
navigation, screen titles, button labels, help, notifications, AI answers,
error messages, onboarding and analytics event names.

Semester should sound **clear, supportive, calm, direct and honest about
uncertainty**. It should never sound condescending, alarmist, bureaucratic,
overly casual, judgmental, vague, or more confident than its data.

> **Enforced, not only written.** The retired words in §2 are checked by
> `npm run lint` (`app/src/content/terms.ts`), in `.tsx` and `.ts` alike,
> outside the course material in `data/`. A file may not use more of them
> than `app/src/content/ledger.ts` allows, and the ledger only goes down. See
> §9.

---

## 1. Principles

1. Use plain language.
2. Put the next useful action first; background second.
3. Use one word for one idea, everywhere (§2).
4. Say where a fact came from and how sure it is (§5).
5. Never shame anyone for missed work, a low grade, or money trouble.
6. Keep official facts and AI-assisted guidance visibly separate.
7. Write for screen readers and translation: short sentences, no idioms in
   controls, no meaning carried only by colour or shape
   (`a11y/tellings.test.ts` already enforces the last).
8. Prefer specific verbs.
9. Say the consequence before an irreversible action.
10. When something fails, say how to recover.

## 2. Canonical terminology

"Retired" words are counted by the lint. "Contextual" words are allowed where
the note says so — a rule that is wrong half the time gets deleted rather than
obeyed, so they are written down here instead of counted.

| Use | Retired (lint) | Contextual — allowed only as noted | Meaning |
|---|---|---|---|
| **Action** | task, to-do, todo | "task" survives only in other products' names (Google Tasks) and as a search alias | A concrete next step. "Your own actions" are the ones a student adds; Mine's tab is **Actions**. Navigation by purpose is **By goal**. |
| **Plan** | roadmap | schedule (a timetable), agenda (a meeting's) | A future-oriented arrangement. |
| **Course** | — | class = *one meeting* of a course ("your 10:00 class"); module = an LMS module inside a course | An enrollment. |
| **Assignment** | homework, deliverable | work (as a verb) | Course work with a due date or outcome. |
| **Deadline** | — | due date (in a form label beside a date field); cutoff (a grading-scale boundary, never a time) | The last time something can be done. |
| **Service** | — | resource (a reading or file), office (a physical place) | A campus help pathway. |
| **Appointment** | — | session = a *study session* the student runs; meeting = a class or group meeting | A scheduled interaction with a person or office. |
| **Official** | — | verified — see §5 | From an approved source of record. |
| **Synced** | — | imported — a one-time copy (§5) | Refreshed from a connected system. |
| **AI-assisted** | smart | generated — only for non-AI output ("generated from the app itself") | Content or a recommendation involving AI. |
| **Needs confirmation** | unverified | needs review (the source label, §5) | Must be confirmed by the student or the institution. |
| **Save** | — | apply (a filter) | Keep a change inside Semester. |
| **Confirm** | — | submit (only for what an external system calls submitting) | Commit an important or irreversible action. |
| **Open official system** | — | — | Leave Semester to act in a system of record. |
| — | "Something went wrong", "click here" | — | Say what failed (§6); name the destination (§3). |

**Proper nouns are exempt**: Google Tasks, Microsoft To Do, SMART Board. They
are listed in `PROPER` in `terms.ts`.

**Code is exempt.** The data model's `tasks` array, `'task'` discriminants
and class names are not user-facing and are not counted. Renaming them is not
part of this standard.

## 3. Labels and titles

- **Sentence case** everywhere in the interface: "Study plan", not "Study
  Plan".
- **Action labels are a verb plus an object**: *Start a study session, Book
  tutoring, Add an action, Review your plan, Open official registration, Save
  changes, Confirm request, Contact support.*
- **Avoid bare verbs** that do not say what happens: *Continue, Submit,
  Manage, Proceed, Go, Learn, Click here.* "Continue" is acceptable only as the
  forward step of a multi-step flow whose next step is visible.
- **Screen titles are noun-led and specific**: *Your next steps, Study plan,
  Tutoring support, Registration plan.* Not *Welcome to the Student
  Dashboard* or *Important information center*.
- The same control has the same label and icon everywhere (WCAG 3.2.4). If
  "Ask for help" opens a person in the Action Center, it opens a person
  everywhere it appears.
- Use "you". Write "your deadlines", not "the student's deadlines", in
  anything a student reads.

## 4. Writing for hard moments

Missed work, academic difficulty and financial stress get neutral, specific
language that leads to an action.

> **Weak:** Academic intervention recommendation required.
> **Better:** You may benefit from tutoring for this course.
> **Best:** You have two chemistry deadlines this week. Find tutoring or plan a study block.

Never "overdue!" in red alone, never "failing", never a count of misses
without a way forward.

## 5. Source and trust language

Semester already has one provenance vocabulary: the five **source labels**
in `app/src/lib/source.ts`, drawn by `<SourceBadge>`, and backed by a database
check on `term_plan_courses.source_label`. They are the canonical words for
*where a fact came from*. The terms in §2 map onto them:

| Idea (§2) | Source label on screen | When |
|---|---|---|
| Official | **Institution verified** | Confirmed by the institution's own system. |
| Synced / imported | **Imported** | Copied in from a file or feed; Semester has not checked it with the institution. |
| — | **Student entered** | The student typed it. |
| AI-assisted / computed | **Estimated** | Worked out by Semester. Not an official figure. |
| Needs confirmation | **Needs review** | Something looks wrong or out of date. |

Rules:

- Every fact that could be mistaken for official carries a `SourceBadge`
  with a freshness line: *"Imported · 12 minutes ago"*.
- Prose disclaimers use `<NotOfficial>`; AI provenance uses
  `intelligence/Disclosure.tsx`. Do not invent a fourth treatment.
- **An AI inference never reads like an official fact.** Say "AI-assisted",
  say what it was based on, and give a way to check it.
- Whether the badge text should become the shorter words in §2 ("Official"
  for "Institution verified") is an open decision — it touches the database
  enum — and is logged as **DD-003** in [DESIGN-DEBT.md](DESIGN-DEBT.md).

## 6. Message patterns

### Errors
In this order: what happened → what still works → what to do → how to get
help. Never a bare "Something went wrong" (retired, §2).

> We could not refresh your registration details.
> Your saved plan is still available.
> Try again, or open official registration.
> Contact support if this keeps happening.

The components are `Trouble`, `Notice` and `Boundary`'s `ScreenTrouble`
([INTERACTION-STANDARDS.md §5](INTERACTION-STANDARDS.md#5-states)).

### Empty states
What is absent → why it matters → one action. Use `EmptyState` with `action`.

> No study sessions planned.
> Add a focused block to make progress on your upcoming work.
> [Plan a study session]

### Confirmations
Short, past tense, specific: *"Changes saved." "Tutoring appointment
requested." "Registration request sent. Check your email for the official
confirmation."* Announced through `Said`; reversible ones offer Undo through
`Undone`.

### Destructive actions
Consequence first, including what is *not* affected:

> Delete this study plan?
> This removes the plan from Semester. It does not change your course enrollment.
> [Cancel] [Delete plan]

Irreversible account-level actions use `TypeToConfirm`.

### AI messages
Identify AI involvement, cite sources where there are any, avoid certainty
beyond the evidence, and offer edit / verify / dismiss / ask a person.

> **AI-assisted suggestion**
> Based on your upcoming deadlines and the study times you saved.
> Review the plan before using it.
> [Edit plan] [Find tutoring] [Dismiss]

## 7. Numbers, dates and times

- Dates as the app's `lib/` formatters produce them; never hand-format.
- Relative for the near future ("Friday at 11:59 PM"), absolute beyond a week.
- Times always carry the zone when the student's zone differs from the
  institution's (the test suite runs in two zones for this reason).

## 8. Analytics event names

Event names use the same nouns as the interface, snake_case, object then
verb: `action_completed`, `service_booked`, `official_system_opened`. A new
event that names a retired word (§2) is a review comment.

## 9. How the vocabulary is enforced

```bash
cd app
npm run lint:terms           # fails if any file uses more retired words than the ledger allows
npm run lint:terms -- --fix  # rewrite the ledger from the tree
```

- The ledger is generated. Commit it in the same change as the text it
  describes. A number that goes up is a line in the diff a reviewer will ask
  about; a number that goes down is the migration being recorded.
- `content/terms.test.ts` fails if the ledger is stale, so a fix cannot be
  banked as room for a later regression.
- To retire a new word, add a row to `RETIRED` in `terms.ts`, run `--fix`, and
  add it to §2 in the same change.
- **Never auto-replace.** Read the sentence. The rename of what is on screen
  today is tracked in [DESIGN-DEBT.md](DESIGN-DEBT.md): DD-001 (tasks → actions)
  is closed; DD-002 is open.
