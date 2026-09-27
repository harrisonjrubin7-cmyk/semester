# Career Evidence + Résumé Bullet Builder: Phase I

**Flag:** `career_evidence` (`VITE_CAREER_EVIDENCE`). Off by default (D-012).
With it off, Career keeps its tabs and courses have no skills panel; a test
holds both.

**Destinations:**

- Me → `career` › **Evidence**, a tab after Skills & fit.
- Each course's overview › **Skills this course may show**.

**Builds on:**

- `screens/Career.tsx`: the résumé entries, fairs, contacts and library, and
  the skills graph (`lib/skills-graph.ts`, `careerSkillsGraph`).
- The application tracker (`state.applications`, `screens/Applying.tsx`).
- Write documents.

It adds sections to those, and leaves them unchanged.

**The rule (D-046):** nothing reaches a résumé that the student did not
confirm or write. Semester never invents an experience, employer, number,
award or skill, and never applies anywhere.

## What the student can do

| Command asks for | How |
|---|---|
| Course/project to skill mapping | The skills graph already reads courses, projects, work and organisations. Evidence shows each suggestion with "Because of:" and the courses and entries behind it. Each course's overview lists the skills its own description suggests |
| Review, accept, edit or reject suggested skills | **Confirm**, **Edit name** (renames and confirms, in the student's words), **Reject** (it stays out) and **Undo** (back to suggested). The course panel and the Evidence tab share one set of decisions. A skill of the student's own needs a course or entry that shows it |
| Portfolio artifact capture | Title, kind (Project, Paper, Presentation, Code, Design, Data analysis, Other), month, an https link, a description, **the course or entry it was made in** (required), and confirmed skills only |
| Résumé bullet builder | Entry, then "What did you do?" and the three prompts. The bullet is built as they type. Unanswered prompts are named and left out ("Semester never fills these in"). Mark **Finished** to use it |
| Metrics prompts | "How many people did this affect?" (digits only, or blank), "What tools or methods did you use?", "What was the outcome?" |
| Résumé versions and templates | Name a version and choose entries, finished bullets and portfolio items, under **Chronological**, **Skills first** or **Projects first**. Skills listed are confirmed only. **Preview and open in Write…** shows the exact text first; confirming makes an editable document. Nothing is sent |
| Internship/application tracker | The existing tracker (Career's Applications row). Evidence feeds it: a fair contact becomes a tracked application only on **Add to my tracker** |
| Interview preparation action cards | One card per tracked application at the interview stage. Steps: reread the posting (when there is one), practise two stories from finished bullets, prepare two questions, confirm logistics, send a thank-you. Ticks are kept |
| Career fair planner | For each fair on the Fairs tab: a pitch (**Start from my details** fills the student's own name, headline, latest entry and confirmed skills, with `[brackets]` for the rest), employers to visit with why and a question, a visited tick, and a follow-up |

## What it never does

- **Invent anything.** It adds no experience, employer, metric, award or
  skill.
  - Bullets hold only the student's words, plus "using", "reaching" and
    "people".
  - A number appears only if the student typed it.
  - Suggested and rejected skills never reach a résumé, pitch or artifact.
- **Apply anywhere.** It never submits an application or sends a résumé or
  message.
- **Guess at a gap.** It never fills a missing name, contact or reason; it
  leaves a `[bracket]`.

## Data

- **Store:** `semester.career-evidence.v1:<account|device>:<term>`, on the
  device only, scoped like the career library (D-047). It holds:
  - skill decisions and the student's own skills;
  - artifacts and bullets;
  - résumé versions;
  - interview ticks;
  - fair plans.

  The reader refuses anything malformed, and "Erase this device" clears it.
- **Not synced yet.** The server's `skill_claim` tables exist
  (`20260923211000_evidence_graphs.sql`) but are not written from the app
  yet. That is follow-up work (D-047).
- **No server change.**

## Files

| New | Purpose |
|---|---|
| `lib/career-evidence.ts` | `reviewedSkills`, `confirmedSkills`, `decide`, `addOwnSkill`, `saveArtifact`, `composeBullet`, `missingPrompts`, `saveBullet`, `renderResume`, `saveVersion`, `interviewCards`, `pitchDraft`, `saveEmployer`, the store |
| `components/CareerEvidence.tsx` | The Evidence tab: Skills, Portfolio, Bullets, Résumé versions, Interviews, Fair plans |
| `components/CourseSkills.tsx` | The course overview's skills panel |

| Changed | Change |
|---|---|
| `screens/Career.tsx` | `careerEvidence` prop (default: the flag) and the Evidence tab |
| `components/CourseHub.tsx` | `careerEvidence` prop and the panel on the overview |
| `styles/app.css` | `.evidence-*` |

## Tests

| File | Covers |
|---|---|
| `lib/career-evidence.test.ts` | **Skills:** none confirmed until decided; confirm, rename, reject and undo; own skills need evidence. **Bullets:** composed from answers; gaps left out and named; a property check that no word or number was added; they belong to a real entry; digits only. **Artifacts:** tied and confirmed-only; https; month. **Versions:** confirmed skills only; finished bullets only; template order; unknown entries ignored; brackets for a missing name. **Interview cards** at that stage only. **Pitch** from own details with brackets. **Employers**, and the store |
| `components/CareerEvidence.test.tsx` | Flag off: no tab, no panel. Suggestions wait for a decision. The live bullet and "left out" line. Write only after the preview, with focus on Cancel, confirmed skills only. The tracker only on the student's click. The interview card and its ticks. The course panel sharing decisions |
| `screens/career.test.tsx` (existing) | Still passes: Career unchanged with the flag off |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- Suggested counted as confirmed.
- An own skill without evidence.
- A bullet inventing a metric.
- Drafts on the résumé.
- An artifact taking unconfirmed skills.
- A bullet on no entry.
- Write without the preview.
- Auto-adding to the tracker.
- Interview cards for any stage.
- The tab ignoring the flag.
- The panel ignoring the flag.
- The pitch inventing a reason.

Two of these first passed against their reverts, because the tests were
weak: one checked a lower-case string against a capitalised bullet, and one
counted documents after the early write. Both tests were fixed and shown red.

## Responsive manual-test checklist

Checked in Chromium with the flag on, one entry, a fair and an application at
the interview stage:

- [x] 390 and 1280px: the Evidence tab; skills with "Because of"; the bullet
  building live with the "left out" line; the interview card.
- [x] No page overflow. The section tab strip scrolls sideways within itself
  at 390px (`.portal-tabs`, by design).
- [x] No `pageerror`.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `skill_decided` | Confirm, reject or undo (`status`); never the name |
| `bullet_saved` | Saved (`answered`: which prompts were answered, not the text) |
| `resume_version_opened` | After the preview is confirmed (`template`) |
| `fair_contact_tracked` | Add to my tracker |

## Rollback

- **The feature.** Leave the flag unset (the default). The tab and the panel
  go; the device store stays, unread.
- **The data.** Documents already opened in Write, and applications already
  added to the tracker, are the student's own and stay.
- Nothing is on the server to undo.
