# Trust cues and source presentation

How Semester says where something came from, how current it is, and how far
to rely on it — including anything an AI model drafted.

## The provenance ladder

`app/src/lib/where.ts` existed before this work and is the source of truth. It
orders six origins by how far a row should be trusted as a record of fact,
strongest first (`TRUST`):

| Rank | Key | Word on screen | Sentence (`aboutWhere`) |
| --- | --- | --- | --- |
| 0 | `official` | Official | Your institution's own record, read from its system. |
| 1 | `connected` | Connected | From a calendar or account you connected, last checked recently. |
| 2 | `made` | Made here | The app built this from sources you gave it. |
| 3 | `yours` | Yours | You entered this yourself. Nothing has checked it. |
| 4 | `sample` | Sample | Shipped with the app as a demonstration. Not your semester. |
| 5 | `stale` | Out of date | From a connection that has not been checked lately. It may have moved. |

- `stale` ranks below `yours` on purpose: an unchecked copy of something that
  may have moved is worth less than a guess that knows it is a guess.
- A subscribed calendar becomes `stale` after `QUIET_DAYS = 3` without a
  successful pull, and one that has never pulled is `stale` from the start.
  A file imported once is `yours`, never `stale` (`whereFeed`).
- No code path in this build returns `official`: the institution adapter
  registry is empty. The header of `where.ts` says `where.test.ts` asserts this
  as a tripwire; that assertion was not found in `where.test.ts` when this was
  written, so treat the tripwire as unverified. The word is reserved for the
  day an adapter lands.
- `worthSaying` limits per-row badges to `official`, `sample` and `stale`; the
  ordinary states are not badged on every row.

## The status vocabulary builds on it

`app/src/lib/status.ts` reads those six from `where.ts` and adds the brief's
further trust and freshness states. The full table, with glyphs and tones, is
in [SEMESTER-PLATFORM-UNITY-PATTERNS.md](SEMESTER-PLATFORM-UNITY-PATTERNS.md#status-vocabulary).

The brief's labels, mapped:

| Brief label | App key and word | Placed on a screen? |
| --- | --- | --- |
| Official institution source | `official` — Official | Calendar and Connect via `where.ts`; no path returns it yet |
| Faculty-approved | `faculty-approved` — Faculty-approved | Defined; not yet used |
| Course-provided | `course-provided` — Course-provided | Defined; not yet used |
| Student-entered | `yours` — Yours | Today's path snapshot, Degree, Pathway, a deadline typed by hand, Career's opportunity, the toolkit workspace |
| AI-assisted, source-linked | `ai-assisted` — AI-assisted, source-linked | Study Studio's draft context bar |
| Updated today | `updated-today` — Updated today | Defined; not yet used |
| Needs advisor confirmation | `needs-confirmation` — Needs confirmation | Today's path snapshot; Degree; Pathway; `NotOfficial` |
| Policy-restricted | — | Not in the vocabulary |
| Stale | `stale` — Out of date | Calendar and Connect feed rows |
| (Semester-created) | `made` — Made here | A deadline, course hub or study guide from a syllabus the student imported |
| (connected system) | `connected` — Connected | University's school records |
| (demonstration) | `sample` — Sample | The deadline, course hub and guide for the sample semester's courses |
| Unavailable / Current | — | Not in the vocabulary |

Two deliberate wording differences:

- **"Yours", not "Student-entered".** `where.ts` chose plain words over
  product words: "Yours" rather than "Local" (which a student reads as their
  town), "Made here" rather than "Semester-created". The status file keeps
  those rather than introducing a second word for the same state.
- **"Needs confirmation", not "Needs advisor confirmation".** The confirming
  party varies (advisor, registrar, compliance office), so the chip says the
  state and the sentence beside it names who.

"Policy-restricted", "Unavailable" and "Current" were not added. Add them to
`TABLE` in `status.ts` (with a sentence and a glyph) when a screen needs them;
`lib/unity.test.ts` will require both.

## `made` versus `ai-assisted`

The brief splits "Semester-created" from "AI-assisted". The app keeps that
split, and it matters: `made` is a rule-based extraction (dates read out of a
syllabus by the parser), `ai-assisted` is a model's draft. They carry
different risks — an extraction can misread, a draft can be wrong while
sounding right — and a student should be able to tell them apart at a glance.
They have different glyphs (`○` and `✦`) and different sentences.

## Freshness

- Feed rows on Calendar and Connect show `saysWhere(whereFeed(…))` and
  `lastPulled(…)` when the state is worth saying.
- The Source & details drawer has a "Freshness" row for any caller that knows
  when its source was last checked; it is free text in tabular figures
  ("Entered 3 days ago").
- Today's near-term panel ends with the last account sync time
  (`syncLabel` in `TodayDecisionSurface.tsx`).

## Where the cues are applied

| Surface | Cue |
| --- | --- |
| Today → "Your path" (`components/TodayDecisionSurface.tsx`) | `StatusChip` "Needs confirmation" (built from what the student typed, never the registrar's audit); "How this status is calculated" disclosure; Source & details with origin `yours`, "Used in" Today / My Path / Registration readiness, limitations, and "Open My Path" |
| Today → "Next best step" | "Why am I seeing this?" disclosure with a "Source:" line |
| A deadline (`ItemDetail` in `screens/Courses.tsx`) | Context bar with the origin — `yours` when typed by hand (its source line is `ADDED_BY_YOU` from `lib/edit.ts` — not a missing quote, since the importer keeps items whose quote it could not verify), `made` when its course was imported, `sample` otherwise — plus "Action required" when the date moved; Source & details says where the date came from |
| The course hub (`components/CourseHub.tsx`) | Context bar: `made` for an imported course, `sample` for a seed course, whatever the term. This corrected a label that had called imported courses "Sample course" |
| The study guide (`screens/Guide.tsx`) | Context bar with `made` or `sample` and the guide's recorded source |
| Study Studio's AI draft (`components/StudyStudio.tsx`) | Context bar: "AI-assisted, source-linked", Saved; Source & details with origin `ai-assisted`, the sources used, limitations, and visibility "Only you — kept on this device until you save it to Write"; the line "Saved temporarily on this device. Matched quotations support source review; they do not guarantee an AI explanation is correct." |
| Pathway and Degree | `yours` and "Needs confirmation" — the student's arithmetic, not the registrar's |
| Career's open opportunity | Object card, `yours`: "You entered this listing" |
| University's school records | Object cards, `connected` |
| The toolkit's assignment workspace | Context bar, `yours`, Saved |
| `components/NotOfficial.tsx` | `StatusChip` "Needs confirmation", then "This is not official — confirm with your compliance office." |
| Calendar and Connect feeds | Out of date / Connected with last-pulled time |
| Every screen | About this screen → "Where does this information come from?" |

`rollout-a.test.tsx` asserts that every seed course's deadline, hub and guide
reads "Sample" and never "Made here" or "Official".

## AI presentation

AI is an assistive layer, not the product's personality. The rules, and where
the app stands against each:

| Rule | Status |
| --- | --- |
| Label every model draft "AI-assisted, source-linked" | Study Studio's draft context bar does; the vocabulary makes it one word everywhere |
| Show the sources it was drawn from | Study Studio: "View cited material" per section, with the quotation, its location, "Open original file" and the passage in context; drawer lists "Sources used" |
| State limitations | Study Studio: "Matched quotations support source review; they do not guarantee an AI explanation is correct." The drawer repeats it as a limitation |
| Let the student edit | Study Studio: each section is an editable textarea |
| Let the student verify | Citations open the original source |
| Save | "Save & open in Write", the context bar's primary, held (disabled) while a draft is generating |
| Report an issue | **Not wired** — `SourceDetail.report` is supported by the drawer, but Study Studio does not pass it |
| Turn into practice | Not on this panel |
| Show genuine progress, not fake certainty | Study Studio shows its generation as `StepStatus`: Selecting sources → Drafting → Matching quotations → Ready, marking the step that failed (`rollout-a.test.tsx`) |
| Avoid "Ask anything", "AI genius", "let AI do your work" | The shared components use none of these; not audited app-wide in this change |

The brief's action-first phrasing ("Explain this concept", "Check my
reasoning", "Find gaps in my evidence") is guidance for new AI entry points;
existing entry points were not re-worded in this change.

## Rules for new work

1. Say a state through `statusOf(key)` or `StatusChip`. Never write "Official",
   "Synced", "Out of date" or any other vocabulary word as a string literal.
2. Give anything with a source a "Source & details" link, via `showSource`.
3. Anything a model drafted is `ai-assisted`, carries `sourcesUsed` and
   `limitations`, and is editable before it is kept.
4. Do not claim `official` for anything the institution did not send.
5. Keep trust cues quiet: they sit in the eyebrow or state row, never louder
   than the primary action.
