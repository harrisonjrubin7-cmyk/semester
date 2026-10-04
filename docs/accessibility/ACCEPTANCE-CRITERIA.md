# Accessibility acceptance criteria

Companion to [PROGRAM.md](PROGRAM.md). **Proposal, 2026-10-04.** These are the criteria a story must carry to
leave G0 and meet G1, and the extra criteria each role's critical journeys add. They are written to be tested:
each line is a thing someone can check and record as pass, fail or not tested. A criterion nobody can check is
reworded until they can.

## How a story carries them

1. **Every story that renders UI or generates content** inherits the **Universal set (U)** below. Do not copy the
   twenty lines into the story; write "Accessibility: U + R-<role>" and list only what is *specific*.
2. A story states its **surface** (web desktop, web phone, email, PDF, notification, audio, call) and the criteria
   apply on each.
3. A story that cannot meet a criterion does not carry an exception. It carries a split: the part that meets it, and
   a story for the rest with an owner and an SLA (ISSUE-PROCESS §3).
4. "Done" for accessibility means the checks ran and are recorded. A box ticked for a check nobody ran is a
   finding against the story, not a pass.

### Story template

```text
As a <role> who <uses assistive technology or has this need>,
I want <outcome>
so that <reason>.

Accessibility: U + R-<role>   (surface: <desktop | phone | email | pdf | audio | call>)
Specific:
  - Keyboard model: <how it is operated; focus on open / on close / on error>
  - Name, role, state: <for anything custom>
  - Alternatives: <drag | hover | chart | map | timer | media>
  - Content: <plain-language check; terms defined; reading level>
  - Settings that change it: <text size, Less motion, contrast, plain language>
Evidence at G1: <tests added> + <manual checks and who ran them>
```

Write at least one story from the point of view of a person using assistive technology for any new journey. "As a
screen-reader user I can register for a section and hear the conflict named before I commit" is a story;
"the page has ARIA" is not.

## The Universal set (U)

Applies to every story with UI. IDs are stable; cite them in tests and findings.

### Perceivable

| ID | Criterion | WCAG |
| --- | --- | --- |
| U-1 | Every non-text element that carries meaning has a text alternative; decorative elements are hidden from assistive technology | 1.1.1 |
| U-2 | Headings form an outline with one `h1` and no skipped levels; lists, tables and groups are real markup | 1.3.1 |
| U-3 | Reading and focus order match the visual order at every width | 1.3.2, 2.4.3 |
| U-4 | Nothing depends on colour, shape, position or sound alone: each state is word plus glyph | 1.3.3, 1.4.1 |
| U-5 | Text meets 4.5:1 (3:1 large); controls, focus ring and meaningful graphics meet 3:1; on **every ground** the surface can sit on, in light, dark, high contrast and forced colours | 1.4.3, 1.4.11 |
| U-6 | Content survives 200% zoom, 200% text-only zoom, the largest in-app text size, and the text-spacing overrides without clipping, overlap or lost function | 1.4.4, 1.4.12 |
| U-7 | At 320 CSS px ordinary content has no two-way scroll; any exception (table, calendar grid, map) has a linear alternative | 1.4.10 |
| U-8 | Popovers and tooltips shown on hover or focus are dismissible without moving the pointer, hoverable, and persist until dismissed | 1.4.13 |
| U-9 | Media has captions and a transcript; prerecorded video with meaningful visuals has audio description or a described alternative; nothing autoplays | 1.2.x, 1.4.2 |

### Operable

| ID | Criterion | WCAG |
| --- | --- | --- |
| U-10 | Every action works by keyboard alone, with a visible focus ring; no keyboard trap other than a modal, which Escape leaves | 2.1.1, 2.1.2, 2.4.7 |
| U-11 | A focused control is never wholly hidden by the header, tab bar, Focus bar, assistant button or a sheet | 2.4.11 |
| U-12 | Focus is placed deliberately on open, close, route change, delete and failed submit | 2.4.3 |
| U-13 | Single-character shortcuts act only outside text fields and can be turned off | 2.1.4 |
| U-14 | Targets are at least 24x24 CSS px (44 for primary touch controls) | 2.5.8 |
| U-15 | Every drag, swipe, path, multi-finger or hover gesture has a single-pointer, no-drag alternative; pointer actions complete on release and can be cancelled | 2.5.1, 2.5.2, 2.5.7 |
| U-16 | The accessible name contains the visible label text | 2.5.3 |
| U-17 | Motion and animation honour the device query and Less motion and Low stimulation; nothing moves for more than five seconds without a pause; nothing flashes over three times a second | 2.2.2, 2.3.1, 2.3.3 |
| U-18 | Every time limit is disclosed, adjustable, extendable or removable, with a warning; nothing expires while the user is typing | 2.2.1 |
| U-19 | The page has a unique title and a skip link; the destination is findable by navigation, search or help; the current location is `aria-current` | 2.4.1, 2.4.2, 2.4.5, 2.4.6 |
| U-20 | Link and button text describes the destination or action; "here" and "click" alone fail | 2.4.4 |

### Understandable

| ID | Criterion | WCAG |
| --- | --- | --- |
| U-21 | Document language is set; passages in another language are marked | 3.1.1, 3.1.2 |
| U-22 | Focus and input never change context on their own; navigation and help are in the same relative place on every screen | 3.2.1 to 3.2.4, 3.2.6 |
| U-23 | Every field has a visible label, a stated format, and correct `autocomplete`; errors appear beside the cause in words with a way to fix, through `FieldMessage`; focus goes to the first invalid field | 1.3.5, 3.3.1 to 3.3.3 |
| U-24 | Submissions that are legal, financial, grade-affecting or data-deleting are reversible, checked, or confirmed, with a review step before commit | 3.3.4 |
| U-25 | Information already given in a flow is not requested again | 3.3.7 |
| U-26 | Sign-in has no cognitive-function test without an alternative; paste and password managers work | 3.3.8 |
| U-27 | Copy follows [INCLUSIVE-CONTENT-STANDARD.md](INCLUSIVE-CONTENT-STANDARD.md): plain language, defined terms, no idiom, no urgency pressure | COGA |

### Robust

| ID | Criterion | WCAG |
| --- | --- | --- |
| U-28 | Every control exposes name, role, state and value; ARIA only where native HTML cannot; ARIA references resolve; IDs are unique | 4.1.2 |
| U-29 | Status messages (saved, loading, results found, error) are announced without taking focus; live regions are polite unless the failure blocks | 4.1.3 |
| U-30 | Works with the platform's own adaptations (zoom, dark mode, reduced motion, larger text, forced colours, voice and switch control) without breaking | 1.4.x, 2.5.x |

### Verification attached to U

| IDs | How it is checked at G1 | Automated today |
| --- | --- | --- |
| U-1, U-2, U-3, U-10, U-19, U-28 | Keyboard and screen-reader walk of the story's surface | `a11y/labels`, `landmarks`, `title`, `axe`, `skiplink` |
| U-4, U-5 | Greyscale, forced colours, contrast sweep | `lib/contrast.test.ts`, `unity.test.ts`; `sweep:contrast` |
| U-6, U-7 | 200%, 400%, text-spacing run | `textscale.test.ts`; `smoke:a11y` (six journeys) |
| U-11, U-14 | Tab walk and target sweep | `tokens.test.ts`, `taps.test.ts`, `reach.test.ts`; `keyboard-pass`, `sweep:targets` |
| U-12, U-13, U-15, U-17 | Manual walk with the keyboard model in the story | `focus`, `modal`, `dragging`, `motion`, `calm` |
| U-16 | Voice Control or Dragon pass | **None** |
| U-8, U-18, U-21, U-24 to U-27 | Review at G0 and a manual check | `fielderror` for U-23 only; **no other guard** |
| U-9 | Caption and transcript check on every media item | `<track>` in two players; not every player |
| U-22, U-29, U-30 | Manual walk | `unity.test.tsx`, `tellings` (parts) |

## Role sets (R)

Each role set adds the criteria the role's critical journeys need. The roles are those the platform knows
(`app_roles`, `supabase/migrations/20260922012000_capabilities.sql`), plus **guardian**, which is a relationship in
the Family domain and not a role row. A "journey" is end to end, not a screen: the pass is run on the whole
journey. Every role inherits U.

The common pattern in each set: *the task that has a deadline or a consequence is the one that must work for
everyone, without a request for help.*

### R-STU Student (undergraduate, graduate, transfer, prospective)

Critical journeys: first run and sign-in; Today and the next action; plan the term and resolve conflicts;
register, add and drop; deadlines and the calendar; study with sources; submit and see work; pay a bill; get
help; request an accommodation or alternate format.

| ID | Criterion |
| --- | --- |
| R-STU-1 | The whole registration journey (find, compare, resolve a conflict, save plan and backups, register) is completable by keyboard and by screen reader, with the conflict named in words before commit and a review step before the irreversible action |
| R-STU-2 | The Calendar's Agenda is a full alternative to the grid, one step away, with every event read as date, time, course and status; move and resize have a non-drag path |
| R-STU-3 | Deadlines and the next action are read in words with source and freshness ("From the registrar, updated 2 hours ago"), not colour or icon alone |
| R-STU-4 | A timed registration window shows the time zone and wall-clock time, announces the opening and its extension, and never drops a half-entered plan |
| R-STU-5 | Degree progress, grades and balances are available as text and a table, never only a ring or bar |
| R-STU-6 | The accommodation and alternate-format request is reachable from Help in two steps, needs no reason, and its status is visible without email |
| R-STU-7 | Study material generated by the assistant has real headings, readable maths, a text version of any chart, and named source links; read-aloud works on it |
| R-STU-8 | The Focus bar, assistant button and sheets never cover a focused control (U-11) in Focused mode at 320px |
| R-STU-9 | Prospective students applying or visiting a public page can do it without an account and with the same criteria as the app |

### R-GRD Guardian and family

Critical journeys: accept an invitation; see what the student has chosen to share; pay or view a bill; revoke or
change sharing; get a notification; contact the school. A guardian may be older, on a shared device, less fluent in
English, or using a phone only.

| ID | Criterion |
| --- | --- |
| R-GRD-1 | Invitation and acceptance work by email link with no account-creation puzzle (U-26), on a phone, with a screen reader and at 200% zoom |
| R-GRD-2 | Every sharing scope is written in plain language ("can see your course schedule; cannot see your grades") and is the same words in the guardian's view and the student's, with a text summary of what is shared |
| R-GRD-3 | Consent changes (grant, narrow, revoke) are confirmable and undoable, and announce the new state in words |
| R-GRD-4 | The surface works in translation and in right-to-left layout (`lang`, isolates) and can be read aloud; machine-translated text is labelled as such |
| R-GRD-5 | Billing and deadlines state amount, date and consequence in words, with the school's accessible contact route |
| R-GRD-6 | Notifications (email, push, SMS) are readable on their own, carry no information in images, and say why they were sent |

### R-ALU Alumni and lifelong

Critical journeys: claim an account after graduation; get a transcript or verification; find the network and
opportunities; manage a portable record; control what is kept.

| ID | Criterion |
| --- | --- |
| R-ALU-1 | Account claim and recovery work without access to the former institutional mailbox, with an accessible alternative to any identity-proofing step, and no timed puzzle |
| R-ALU-2 | Transcript and credential exports are tagged, accessible PDFs (title, language, headings, table headers), with a plain-text or HTML equivalent |
| R-ALU-3 | Directory and opportunity searches are keyboard and screen-reader operable; result counts are announced; filters do not reflow focus |
| R-ALU-4 | The retention and export controls name what will happen in words and confirm before deletion (U-24) |
| R-ALU-5 | Their saved settings (text size, contrast, motion, reading) are still applied when they return years later |

### R-FAC Faculty, teaching assistant and tutor

Critical journeys: set up a course; publish materials and policies; grade and give feedback; review a source pack;
post an announcement; respond to an accommodation.

| ID | Criterion |
| --- | --- |
| R-FAC-1 | The authoring surface prompts for, and refuses to publish without (or flags), alt text, heading structure, link text, caption and transcript on every item students will meet (content-author validation) |
| R-FAC-2 | Uploaded documents and slides are checked on import and the instructor is told, in words, what is inaccessible and how to fix it; the platform offers an accessible version rather than blocking |
| R-FAC-3 | Gradebook and rubric views are tables with headers, sortable by keyboard, with selection read as a count; grading by keyboard needs no pointer |
| R-FAC-4 | Time accommodations (extra time) are a setting on the assignment or exam, applied automatically, and visible to the instructor without disclosing the reason |
| R-FAC-5 | Announcements and feedback are delivered as accessible email and in-app text, never only as an image or recording |
| R-FAC-6 | Faculty with disabilities can do all of the above (inclusive of the staff console), and the criteria apply to the staff surfaces as fully as to the student's |

### R-ADV Academic advisor

Critical journeys: receive a student-approved agenda; review a shared plan; record notes and follow-ups; schedule
a meeting; use meeting mode.

| ID | Criterion |
| --- | --- |
| R-ADV-1 | The advisor meeting mode is operable by keyboard and screen reader, and meetings can be held in person, on a call with live captions, or by chat |
| R-ADV-2 | A shared plan is presented as a table with headers and a text summary of conflicts and risks, not only a colour-coded grid |
| R-ADV-3 | Notes and follow-up actions are editable without a pointer; a follow-up created in the meeting appears in the student's view in text |
| R-ADV-4 | An advisor's access limits are stated in words on every screen ("only what this student shared") |

### R-STF Staff, department and university administrator

Critical journeys: the Console and University workspaces; configuration; bulk operations and imports; reports;
publishing a verified resource; support and moderation; audit export.

| ID | Criterion |
| --- | --- |
| R-STF-1 | The console is held to the same criteria as the student surface, and its dense tables, filters, bulk selection and wizards are keyboard and screen-reader operable and reflow |
| R-STF-2 | A **configuration change** states its effect on every user before commit, in words; a destructive or tenant-wide change is confirmed (`TypeToConfirm`) and recoverable |
| R-STF-3 | Imports and exports report outcomes as text, a count and a downloadable list of failures, not only a toast or a colour |
| R-STF-4 | Content a staff member publishes goes through the same alt, caption, heading and link checks as faculty content (content-author validation) before it is shown to students |
| R-STF-5 | Reports and dashboards have a table alternative for every chart, and an export that is accessible |
| R-STF-6 | The accessibility settings of the tenant (default text size, caption defaults, alternate-format contact, step-free and quiet-space fields) are first-class configuration, with an owner and a published contact |
| R-STF-7 | The accessibility office has a console view of alternate-format requests with the SLA clock (ISSUE-PROCESS §6) |

### R-ORG Student organisation member, officer and admin

| ID | Criterion |
| --- | --- |
| R-ORG-1 | Events carry step-free access, captioning, ASL, quiet-space and food-allergen fields; the event form requires an answer, even "none", so the field is never silently absent |
| R-ORG-2 | RSVP, check-in and ticket flows are keyboard and screen-reader operable; QR codes have a typed alternative |
| R-ORG-3 | Posted images need alt text before posting; a flyer-as-image is flagged and a text version required |
| R-ORG-4 | Roster and permissions screens are accessible tables with named row actions |

### R-EMP Employer, partner and business admin (marketplace)

| ID | Criterion |
| --- | --- |
| R-EMP-1 | Listing and application flows meet U in full; an applicant using assistive technology can apply without a pointer and without a timed assessment that has no accommodation path |
| R-EMP-2 | Any assessment or video interview an employer sets states its time and format in advance and has an extra-time and alternative-format route that the applicant can use without disclosing a reason |
| R-EMP-3 | Orders, fulfilment and dispute flows state status and amounts in words; receipts are accessible documents |
| R-EMP-4 | Moderation and report flows are available by keyboard and in plain language, with a human route |

### R-MOD Moderator, trust-and-safety and support (including platform admin)

| ID | Criterion |
| --- | --- |
| R-MOD-1 | Case queues, evidence viewers and decisions work by keyboard and screen reader; media evidence has transcripts or descriptions available to the reviewer |
| R-MOD-2 | Distressing content has warnings that do not rely on colour, can be turned on and off, and are announced before the content is read |
| R-MOD-3 | Support access granted by a student is announced to the student in text and in their notification channel, with the scope and the end |
| R-MOD-4 | A person reporting harm can do so by any route (keyboard, voice, phone, chat) without losing their draft |

## Cross-role acceptance for shared platform capabilities

Capabilities every role meets. Their criteria are written once here and referenced by role pages.

| Capability | Criteria |
| --- | --- |
| Sign-in, recovery, MFA, session | U-26; paste works; a non-memory alternative; MFA codes pasteable; recovery does not require a phone call as the only route; timeouts save drafts (U-18) |
| Search and ⌘K | Dialog with a named combobox; result counts announced; no shortcut while typing; recent items are real links |
| Notifications and inbox | Each message readable on its own; the channel (in-app, email, push, SMS) is the user's to choose and mute; digests have headings; no information only in an image |
| Settings and personalisation | Reachable from any screen in a fixed place; every accessibility setting is available to every user, needs no justification, and persists across devices; a change applies immediately and is announced |
| AI assistant | The AI rows in PROGRAM §5 and §6.10; the human route is always one step away; AI actions that change data show a preview in text and require a keyboard-operable confirmation |
| Exports and records | Accessible PDF or HTML; machine-readable data export |
| Billing and payments | U-24 review step; amounts, dates and consequences in words; no payment form that blocks paste or autofill |
| Help and support | Same place on every screen (3.2.6); a human contact; Help itself meets U |
| Onboarding and first run | Skippable; no more than one new idea per screen; progress stated; can be resumed; settings offered early ("reading, motion, contrast") |

## What counts as evidence for a criterion

| Level | Meaning | Citing it |
| --- | --- | --- |
| **Guarded** | A test or lint in `npm test` or `npm run lint` fails when it regresses | Name the file |
| **Swept** | A browser script measured the built app for this commit (`smoke:a11y`, `sweep:*`, `keyboard-pass`); not in CI | Name the script and commit |
| **Walked** | A named person did the manual check in a named environment and recorded the result | Name the pass record row |
| **Reviewed** | A design or content review recorded a decision | Name the story |
| **None** | Nothing | Say so |

A pass record and a conformance claim need Walked or Guarded for every row. Swept supports; Reviewed does not
establish an implementation.
