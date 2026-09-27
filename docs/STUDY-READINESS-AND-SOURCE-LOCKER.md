# Study Readiness + Source Locker: Phase H

**Flags:**

- `study_readiness` (`VITE_STUDY_READINESS`)
- `source_locker` (`VITE_SOURCE_LOCKER`)

Both are off by default (D-012). With both off, the course hub keeps its five
tabs, and Study Studio behaves exactly as before; tests hold both.

**Destination:** Course Companion → `course/:id`, as two tabs:

- **Readiness**, after Study tools.
- **Sources**, after Readings & materials.

No new top-level destination.

**Builds on:**

- **Sources:** Drive files (`lib/files.ts`), added materials (`state.updates`),
  the syllabus and prepared guide, and the reading list (`state.sources`).
  Study Studio (`lib/studystudio.ts`) records what a guide was built from.
- **Readiness:** spaced review (`state.reviews`), practice papers
  (`state.sittings`) and `isExam` (`lib/runway.ts`).
- `docs/ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md` said a unified locker
  should merge these rather than add a fourth store. This does that (D-044).

## Study Readiness

For each upcoming exam or major assessment in the course (a selector when
there are several):

| Command asks for | How |
|---|---|
| Assessment date | Title, date and days away, with the date's source (Imported when checked against the syllabus, else Needs review) |
| Topics: Reviewed, Practicing, Needs review | Each prepared-guide topic has "Where it stands", which the **student** sets. Semester never sets it |
| Self-rated confidence | "How confident you feel": Not yet, A little, Somewhat, Mostly, Very (1–5) |
| Practice outcome signals | Per topic: cards practiced, right, missed and due now, from the student's own reviews. Practice papers are shown as taken (got of out-of, date, items to look back at). Counts only |
| Recommended short study session | One 25-minute session, with the reason in words and three steps, plus **Open topic**. It goes to Needs review first, then unmarked topics, then Practicing; within those, the lowest confidence, then the most due (D-045). When everything is Reviewed and nothing is due, it says so |
| Links to approved, source-grounded materials | Per topic: the prepared guide from the syllabus (Imported) and material added to that unit (Imported if read from a file, else Student entered) |
| No grade prediction, no ranking | The page says "makes no prediction about a grade" and "not a forecast of your result". Tests hold words like predicted, likely grade, chance, rank and "compared with" out |

**Stored:** `semester.study-readiness.v1` on the device only, holding the marks
per assessment and topic (the 60 most recent assessments).

## Source Locker

| Command asks for | How |
|---|---|
| List connected/uploaded course materials | The syllabus, this course's Drive files, added materials and reading-list entries. No other course's |
| Source type, file version, date, access state | Type (for example "PDF upload"). Version ("Upload 2 of 2 named notes.pdf" when the same name was uploaded again; the Drive keeps no other versions). Date added. Where it is (on this device, in Drive trash, has a link, not stored on this device) |
| What generated assets use each source | **Used by:** added materials read from a file, study guides built from it (directly or through a material read from it), and notes it is attached to |
| Open source | Files open in the browser. Reading links open only after the "You are leaving Semester" confirmation |
| Remove source | **Remove…** shows a confirmation, with focus on Cancel, that lists everything affected |
| Delete dependent generated assets after confirmation | In that confirmation, "Also delete these N generated items" is **unticked by default**. Ticked, the listed added materials and guides are deleted. **Notes are never deleted**, only detached. Dates checked against the file stay, and the confirmation says so |
| Source provenance and freshness | Label (Imported or Student entered) with its age. "From": imported with the course, uploaded to this device, read from N files, or the citation's author, year and publisher |
| Student control over AI source usage | **Use with AI** per material. Turned off, Study Studio leaves it out of what can be sent and says how many are hidden. A course whose AI policy is *banned* locks every switch off and says why |

**Removal, concretely** (`removalPlan`, D-044):

- **A file** is detached from notes, then moves to Drive trash, where it stays
  30 days.
- **An added material** is deleted with its cards and terms.
- **A reading** leaves the list.
- **The syllabus** cannot be removed here; removing the course is the way.

**Provenance from now on:** when Study Studio saves a guide, it records which
materials were selected:

- a syllabus unit maps to the syllabus;
- an added material maps to itself;
- an uploaded page maps to its file;
- personal notes and pasted text are not materials.

Guides saved before Phase H have no record, so the locker shows only links it
can see. `makeDocument` gained an optional `id` so the record can name the new
document.

**Stored:** `semester.source-locker.v1` on the device only, holding blocked
material keys and build records (at most 500).

## What it never does

- Predict a grade, estimate a chance of passing, score or rank a student.
- Delete a note.
- Delete a generated item without the student ticking it in a confirmation that
  names it.
- Send a material to AI that the student blocked, or any material under a
  banned policy.
- Remove a syllabus.
- Open an external link without confirmation.
- Touch another course's materials or assets.

## Data and privacy

- **Two new device-only stores.** "Erase this device" removes both, since it
  clears every `semester.` key.
- **Neither is synced or exported.** Export's registry has the same known gap
  for newer stores (D-018).
- **No server change:** no table, migration or network call.

## Files

| New | Purpose |
|---|---|
| `lib/source-locker.ts` | `materials`, `dependents`, `removalPlan`, `forgetRemoved`, `recordBuilt`, `setAiUse`, `materialOfStudySource`, the store |
| `lib/study-readiness.ts` | `assessmentsAhead`, `topicSignals`, `signalLine`, `papersFor`, `recommend`, `materialsFor`, the store |
| `components/SourceLocker.tsx` | The Sources tab |
| `components/StudyReadiness.tsx` | The Readiness tab |

| Changed | Change |
|---|---|
| `components/CourseHub.tsx` | `readiness` and `locker` props (default: the flags); the two tabs |
| `components/StudyStudio.tsx` | `sourceLocker` prop (default: the flag): blocked materials left out; the build recorded on save |
| `state/shape.ts`, `state/slices/made.ts` | `makeDocument` accepts an optional, unused `id` |
| `styles/app.css` | `.locker-*`, `.readiness-*`, and the fact-list fix inside `.portal-workspace` |
| `vite.config.ts` | The new `vi.mock` test file in `MOCKS_MODULES` |

## Tests

| File | Covers |
|---|---|
| `lib/source-locker.test.ts` | **Listing:** only this course; type, version, date, access and label; never Institution verified; https-only links; syllabus not removable. **AI:** the student's choice, and the policy over it. **Dependents:** from a file directly, through a material, attached notes and checked deadlines; other courses never; deleted guides forgotten. **Removal:** nothing generated unless ticked; exactly the listed items when ticked; notes never; the syllabus and trashed files refused; material and reading plans; forgetting afterwards. **Studio mapping and the store:** round trip and refusals |
| `lib/study-readiness.test.ts` | Assessments ahead (exams and heavy items, not past or done, this course). Signals from reviews. Papers newest first. **Recommendation:** Needs review first, then unmarked or most due, then lowest confidence; none when all reviewed. No grade or ranking words. Labelled materials. The store |
| `components/SourceLocker.test.tsx` | The tabs only with the flags. The list with its facts and dependents. Removal only after the preview (focus on Cancel), keeping generated items unless ticked and notes always; deleting them when ticked. The AI switch stored, and Study Studio leaving the material out (and not, with the flag off). A saved guide recording its materials. Policy lock. External link after confirmation. Readiness marks stored, the recommendation following them, no prediction wording |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- Generated items always deleted.
- Notes deleted.
- Other courses' assets included.
- The syllabus removable.
- The policy ignored.
- Study Studio ignoring blocks.
- Remove without confirming.
- Tabs ignoring the flags.
- Needs review not first.
- Non-https links.
- A link opened without confirming.
- Save recording nothing.
- The reducer ignoring the id.

## Responsive manual-test checklist

Checked in Chromium with both flags on and an own course that has three topics,
a midterm, an added material, a reading and a recorded guide:

- [x] 390 and 1280px: the Readiness tab, marking a topic Needs review, and the
  recommendation following it.
- [x] 390 and 1280px: the Sources tab facts as two-column rows. This was fixed
  after the first screenshot: `.portal-workspace dt` pushed labels below their
  values.
- [x] Remove… lists what was built from it, with the tick unticked and focus on
  Cancel.
- [x] No horizontal overflow (measured), no `pageerror`.
- [ ] Removing a real Drive file in the browser. Seeding IndexedDB was out of
  scope here; covered by the component test with the Drive mocked.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `readiness_marked` | A topic's state or confidence changed (never the value) |
| `readiness_session_opened` | Open topic from the recommendation |
| `locker_ai_toggled` | Use with AI changed (`kind`) |
| `locker_removed` | After confirmation (`kind`, `alsoGenerated`) |

## Rollback

- **The features.** Leave both flags unset (the default). The tabs go, and
  Study Studio stops filtering and recording.
- **The data.** Both device stores stay, unread. Files removed through the
  locker are in Drive trash for 30 days and can be restored there.
- Nothing is on the server to undo.
