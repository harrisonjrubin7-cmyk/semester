# Assistive-technology pass: protocol, results template and WCAG 2.2 AA checklist

> **Status: the manual assistive-technology pass has NOT been done.**
> Nobody has run NVDA, JAWS, VoiceOver or TalkBack against Semester and
> recorded the result. This page is the script for that pass and the form to
> record it in. It also holds the results of an **automated** keyboard,
> landmark, heading, name and axe-core pass (§6). That automated pass is
> regression evidence. It is not a screen-reader pass and not a conformance
> evaluation, and it must not be cited as either. An ACR/VPAT still needs the
> human pass below. `docs/trust/HECVAT-VPAT-PLAN.md` says the same.
>
> | Field | Value |
> | --- | --- |
> | Manual pass owner | _(unassigned)_ |
> | Manual pass date | _(not run)_ |
> | Build / commit under test | _(fill in)_ |
> | HECVAT rows this closes | A11Y-3 (screen-reader pass). Feeds A11Y-2 (ACR) |

Related: [GOLDEN-PATH-TEST-SCRIPT.md](../GOLDEN-PATH-TEST-SCRIPT.md) (the
journey), [RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md](../RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md)
(per-width checks), [ACCESSIBILITY-POLISH-CHECKLIST.md](../ACCESSIBILITY-POLISH-CHECKLIST.md)
(what the code already guards), [market-readiness/ACCESSIBILITY_READINESS.md](../market-readiness/ACCESSIBILITY_READINESS.md),
[trust/HECVAT-VPAT-PLAN.md](../trust/HECVAT-VPAT-PLAN.md).

---

## 1. Environments

Run every golden-path step (§3) in each **required** row. The optional rows
are for a later pass, or for an auditor who asks for them.

| # | Assistive technology | Browser | Platform | Required |
| --- | --- | --- | --- | --- |
| E1 | NVDA (current release), browse and focus modes | Firefox (current) and Chrome (current) | Windows 11 | Yes |
| E2 | JAWS (current release) | Chrome or Edge (current) | Windows 11 | Yes |
| E3 | VoiceOver | Safari (current) | macOS (current) | Yes |
| E4 | VoiceOver, touch gestures and rotor | Safari | iOS (current), 390pt-wide phone | Yes |
| E5 | TalkBack | Chrome | Android (current) | Optional |
| E6 | Keyboard only, no pointer, no AT | Chrome and Firefox | Any desktop | Yes |
| E7 | Browser zoom 200%, then 400%, on a 1280px-wide window | Chrome | Any desktop | Yes |
| E8 | 320 CSS px wide window (WCAG 1.4.10 reflow) | Chrome, responsive mode, and a real small phone | Any | Yes |
| E9 | Text-only zoom 200% (Firefox "Zoom text only") and the app's largest text size (Settings) | Firefox | Any desktop | Yes |
| E10 | `prefers-reduced-motion: reduce` (OS setting), then the app's own Less motion | Any | macOS or Windows | Yes |
| E11 | Windows High Contrast / forced colours (Contrast themes: Night sky and Desert) | Edge | Windows 11 | Yes |
| E12 | macOS Increase contrast plus Reduce transparency | Safari | macOS | Optional |
| E13 | Voice control (Voice Control on macOS/iOS, or Dragon) | Safari / Chrome | macOS or Windows | Optional |

Record the exact AT and browser version strings in the results table. A pass
recorded without versions cannot back an ACR.

## 2. Setup

1. Build and serve the version under test. For a local run, follow
   `.claude/skills/run` (dev server on 5173). A pass for an ACR must run
   against the deployed build, with its URL and commit recorded above.
2. Start from a fresh browser profile. The first screen is the adoption prompt
   ("Your syllabi. One brain."). Choose **Skip**. Skipping keeps the four
   sample courses, and the golden path needs them.
3. Leave the layout at its defaults: tab bar navigation (`nav: tabs`) and the
   Guided workspace mode. Repeat steps 2 and 7 once in **Focused** mode
   (Settings → Workspace mode). Focused mode has its own fixed Focus bar at
   the bottom, and it is the layout where §6 found and fixed overlap.
4. Screen reader settings: default verbosity and punctuation "some". Turn off
   any setting that reads the page on load, so that what the page announces
   can be heard.
5. For step 1 (sign in) the tester needs a seeded test account. See the "Step
   1" row in GOLDEN-PATH-TEST-SCRIPT.md. Without one, record step 1 as **Not
   tested** rather than passing it on the signed-out app.

## 3. The script: golden path, step by step

For every step, do it **with each required environment** and fill one row
per step × environment in §4. "Expect" is what a pass sounds or looks like.
Anything else is a finding. Record the words the screen reader actually said.

### Step 1: Sign in (`components/Credentials.tsx`)

| Do | Expect |
| --- | --- |
| Tab from page load | First stop is **Skip to content**, visible when focused. Enter moves focus to `main` |
| Reach the email and password fields | Each is announced with its label and role ("Email, edit text"). No field is announced as unlabeled |
| Submit with a wrong password | The failure is announced without moving the mouse or hunting for it: an alert or live region reads the message. Focus stays where it was, or moves to the message. The typed email is still there |
| Submit correctly | The new screen's title is announced (document title changes to "Today · Semester"), and focus is at the top of the new screen, not left on a control that no longer exists |
| 200% / 400% / 320px | Both fields and the button are reachable without horizontal scrolling, and nothing overlaps |

### Step 2: Sees Today (`screens/Today.tsx`)

| Do | Expect |
| --- | --- |
| H key (NVDA/JAWS) / rotor Headings (VO) | Exactly one level-1 heading, "Today". Section headings follow in order with no skipped levels |
| D / landmarks rotor | One `main`, one navigation (tab bar or rail), a banner. No unnamed duplicate landmarks |
| Arrow through the schedule | The current-time line is read as "Now, 3:11" (with the real time), not a bare time. This was fixed in this change; see §6 |
| Tab through the first 40 stops | Every stop has a visible focus ring. No stop is hidden under the header, the tab bar, the Focus bar (Focused mode) or the assistant button |
| Focused mode, 320px | Each focused control scrolls clear of the Focus bar. The assistant button sits above the Focus bar, not on it |

### Step 3: Understands one verified next action (Action Center, source labels)

| Do | Expect |
| --- | --- |
| Reach the next-action card | Its name says what the action is. Its source and freshness are read as text ("From the registrar, updated 2 hours ago"), not only as an icon or colour |
| Open "Why am I seeing this?" / Source & details | A dialog opens. Focus moves into it, it is announced as a dialog with a name, Tab stays inside it, Escape closes it, and focus returns to the control that opened it |
| "Did this help?" if present | The buttons are named, and the choice is confirmed in a status message |

### Step 4: Opens My Path or Plan (`screens/Degree.tsx`, `screens/Calendar.tsx`)

| Do | Expect |
| --- | --- |
| Navigate by tab bar / rail | The current destination is announced as current (`aria-current` or a selected tab) |
| Degree requirements | Progress is read in words ("12 of 120 credits"), not only drawn as a bar |
| Calendar: switch to Agenda | The week grid has a list alternative. Every event is reachable and read with its date and time. Drag-to-move has a non-drag alternative |
| 400% zoom | The agenda reflows. The week grid may pan, but the agenda is reachable |

### Step 5: Completes a registration, advising or study action (`screens/Yes.tsx`, `screens/Registrar.tsx`)

| Do | Expect |
| --- | --- |
| Fill a form with one field wrong, then submit | Focus moves to the first wrong field. The reader says the field's name, "invalid", and the error text. The error is shown with an icon and words, not colour alone. Other forms that already use the shared pattern (§6): Meals, Housing, Costs, Bill, Timers, Settings → Assistant proxy |
| Submit from inside the wrong field (Enter) | The error is still announced (polite live region), even though focus did not move |
| Correct the field | "invalid" is no longer announced for it, and its error text is gone |
| Destructive or irreversible action | A confirmation is required, or an Undo is offered and announced |

### Step 6: Opens a source-linked Assignment or Study workspace (`components/toolkit/AssignmentPanel.tsx`)

| Do | Expect |
| --- | --- |
| Open the workspace | The title is announced. Provenance is read as text |
| Editor (if present) | The text area has a name. The formatting toolbar buttons have names and pressed state. Tab can leave the editor (no keyboard trap) |
| Ask Semester / assistant button | Named "Ask Semester about ⟨screen⟩". The `A` shortcut does not fire while typing in a field |

### Step 7: Reaches human help (`components/OfficeHours.tsx`, Help)

| Do | Expect |
| --- | --- |
| Find help | "About this screen" is in the same relative place on every screen (WCAG 3.2.6) |
| Office hours and contact | Links say where they go. External links are identified |
| Preview what would be sent | Readable in full by the screen reader before anything is sent. **Do not send** |

### Step 8: Sees completion and the next step

| Do | Expect |
| --- | --- |
| Mark the action done | A status message confirms it without stealing focus. The next action is reachable and its change is announced or discoverable |
| Undo | Offered, announced politely, and it works from the keyboard |

### Step 9: Resumes safely on phone, tablet or desktop

| Do | Expect |
| --- | --- |
| Reload | The same screen and state come back. The title is announced |
| Offline (devtools or airplane mode) | The app says it is offline in text. Queued changes say "Queued to sync". Nothing is presented as an empty page |
| Rotate a phone (E4) | Content reflows. No orientation lock. Focus is not lost |

### Cross-cutting, on every step

- **Keyboard (E6):** every action can be done without a pointer. There is no
  trap. Focus order follows reading order, and the focus ring is always
  visible. Character-key shortcuts (`A`, `?`) can be turned off or only act
  when focus is not in a field.
- **Reflow and zoom (E7, E8, E9):** no two-dimensional scroll except the
  documented 2-D surfaces (week grid, sheet, map, slide canvas), each of which
  has a list or table alternative. No clipped or overlapping text. Text spacing
  overrides (WCAG 1.4.12 bookmarklet) lose no content.
- **Motion (E10):** sheets and pane changes do not animate, and nothing
  auto-plays.
- **Contrast (E11, E12):** in forced colours every control keeps a visible
  edge and the focus ring shows as `Highlight`. Nothing depends on a colour
  that forced colours removes.
- **Status messages (WCAG 4.1.3):** save, sync, undo, loading and errors are
  announced without moving focus.

## 4. Results table (template)

One row per step × environment. Result is **Pass**, **Fail**, **Partial**, or
**Not tested**. Every Fail or Partial needs a finding row in §5.

| Step | Env | AT + version | Browser + version | Result | What the AT said / what was seen | Finding # | Tester | Date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Sign in | E1 | | | | | | | |
| 1 Sign in | E2 | | | | | | | |
| 1 Sign in | E3 | | | | | | | |
| 1 Sign in | E4 | | | | | | | |
| 1 Sign in | E6 | | | | | | | |
| 1 Sign in | E7 | | | | | | | |
| 1 Sign in | E8 | | | | | | | |
| 1 Sign in | E9 | | | | | | | |
| 1 Sign in | E10 | | | | | | | |
| 1 Sign in | E11 | | | | | | | |
| 2 Today | E1 | | | | | | | |
| 2 Today | … | | | | | | | |
| 3 Next action | E1 | | | | | | | |
| 4 Path / Plan | E1 | | | | | | | |
| 5 Action / forms | E1 | | | | | | | |
| 6 Workspace | E1 | | | | | | | |
| 7 Help | E1 | | | | | | | |
| 8 Completion | E1 | | | | | | | |
| 9 Resume | E1 | | | | | | | |

_(Copy the E1 rows for E2 to E11, as for step 1.)_

## 5. Findings log (template)

| # | Step | Env | WCAG SC | Severity (Blocker / High / Medium / Low) | What happens | Expected | Workaround | Owner | Target date | Retest result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | |

A **Blocker** is a step a user of that AT cannot complete at all. Blockers
hold a launch (see `docs/GO-NO-GO-CHECKLIST.md`).

## 6. Automated pass: what was run, and what it found

**Run 2026-09-28** on branch `worktree-agent-a99d605c02411f0c9` (base
`origin/main` `7316e25`, with this change applied), dev server, Chromium
141.0.7390.37 through Playwright 1.63.0, axe-core 4.13.0. Script:
[`app/scripts/keyboard-pass.mjs`](../../app/scripts/keyboard-pass.mjs). Run
the existing `app/scripts/accessibility-smoke.mjs` beside it.

**What it checks** on 13 screens (Today, Home, Calendar, Courses, Assignments,
Registration, Degree, Search, Ask, Settings, Help, Meals, Timers) at
**1280×800** and **320×640**, with the tab bar, Guided mode and reduced
motion:

- visible `h1` count, `main` and `nav` landmarks, heading-level skips, and
  horizontal overflow;
- the first 40 Tab stops from the top of the document: the first stop, a
  visible focus indicator (outline or ring) at each stop, and whether each
  stop's centre is covered by something else the moment it takes focus;
- axe-core with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`
  tags: violations, and "incomplete" (needs review) results.

**Control.** `CONTROL=1` plants an unnamed button, a button with no focus
ring, an image with no alt, a second `h1` and grey-on-grey text. On Today and
Timers at both widths the probe caught the unnamed button (`button-name`), the
missing alt (`image-alt`), the ring-less button and the second `h1`. **It did
not flag the low-contrast text as a violation.** axe reports colour contrast
here as "incomplete", because the app's grounds use pseudo-elements and
gradients it cannot resolve. So this pass is **no evidence about colour
contrast** either way. Contrast is covered by `app/src/lib/contrast.test.ts`
and needs the manual E11/E12 checks.

### Results, final run

| Screen | h1 (1280 / 320) | main | Skip link first | Focus ring missing | Overflow at 320 | axe violations | Focus covered at 320 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Today | 1 "Today" / 1 | 1 | yes | 0 | 0 | 0 | 0 (1 transient, see below) |
| Home | 1 "Today" / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Calendar | 1 / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Courses | 1 / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Assignments | 1 "Work on it" / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Registration | 1 "YES" / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Degree | 1 / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Search | 1 "Today" / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Ask | 1 / 1 | 1 | yes | 0 | 0 | 0 | **2 (open, see below)** |
| Settings | 1 / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Help | 1 "Guide" / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Meals | 1 / 1 | 1 | yes | 0 | 0 | 0 | 0 |
| Timers | 1 / 1 | 1 | yes | 0 | 0 | 0 | 0 (was 1, fixed) |

No heading-level skips anywhere, and no page errors. Settings has two `nav`
landmarks, and both are named: "Sections" (the app rail) and "Settings" (the
settings index). Search at
`#/search` drew Today's `h1`, so the route opens over Today. It was not
audited separately. `app/scripts/accessibility-smoke.mjs` against the same
server: **ok**, 6 journeys × 2 widths.

### Found and fixed in this change

| Finding | WCAG | Before | After | Guard |
| --- | --- | --- | --- | --- |
| At 320×640 in Focused mode the assistant button sat on the Focus bar (workspace, feed, shelves, guides: bar 518–628, button 576–628; springboard: button 481–533) | 1.4.10, 2.4.11 | overlapping | button 454–506, bar 518–628 | `app/src/ai/focusbar.test.tsx` |
| In Focused mode with the tab bar layout the assistant button was off the top of the screen (`--bottom-chrome: 640px`, button at −64). The hidden tab bar measured its top as 0 | 2.1.1 | unreachable by pointer | on screen, above the bar | `focusbar.test.tsx` ("reads a bar that is not drawn as nothing") |
| In Focused mode, tabbing to a control under the Focus bar scrolled nothing, and the ring stayed under the bar | 2.4.11 | 8 of Today's 39 stops, 6 on Settings | 0, 0 | `focusbar.test.tsx` (scroll-padding) |
| Timers at 320: tabbing to **Start** left 46% of it, ring included, under the assistant button, below the button's "move" threshold | 2.4.11 | covered | button lifts clear on focus | `app/src/ai/dock.test.ts` ("counts the focused control as covered") |
| Today's "now" line had `aria-label` on a role-less `div`, which readers ignore (axe `aria-prohibited-attr`, "incomplete"). A reader heard a bare time | 1.3.1 | "3:11" | "Now, 3:11" | axe run above (no longer reported) |
| No shared field-error pattern. Six forms drew errors ad hoc, five with no announcement at all | 1.3.1, 3.3.1, 4.1.3 | colour-only text, no `aria-invalid`/`describedby` | `components/FieldMessage.tsx` everywhere | `app/src/a11y/fielderror.test.ts`, `components/FieldMessage.test.tsx` |

Screenshots (all small PNGs) are in [`screenshots/`](screenshots/):
`focusbar-320-workspace-before.png` / `-after.png`,
`focusbar-320-tabs-before.png` (no assistant button) / `-after.png`,
`focusbar-1280-after.png`, `field-error-meals-320.png`,
`focus-obscured-clocks-320-before.png` / `-after.png`.

### Still open

- **Ask at 320px:** the "↓ Latest" jump button, which floats over the
  conversation, partly covers the suggestion buttons ("What should I study
  next?", "How am I doing in my courses?") when they take focus. The rest of
  each button stays visible, so this fails 2.4.12 (AAA), not 2.4.11 (AA). Not
  fixed here.
- **Transient cover at 320:** on Today, "Arrange" read as covered by the
  assistant button at the instant it took focus. 700 ms later it was clear
  (the button moves on the next frame). Repeated twice. This is recorded as a
  probe artifact, not a finding.
- **Colour contrast:** not evidenced by this pass. See Control above.
- Anything below the first 40 Tab stops on a screen, every screen not in the
  list above, rich-text editors, charts, maps, media players, dialogs opened
  from within screens, and every signed-in flow.

## 7. WCAG 2.2 Level A and AA checklist (for the ACR)

The **Result** column uses the VPAT 2.x terms (Supports / Partially
Supports / Does Not Support / Not Applicable). **Every Result cell is empty on
purpose.** It is filled in only from the manual pass in §4. "Automated
evidence" names what already holds part of the criterion in the repository.
It is not a result. 4.1.1 Parsing is obsolete in WCAG 2.2 and is omitted.

| SC | Level | Criterion | Automated evidence in the repo | Manual check (env) | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1.1 | A | Non-text Content | axe `image-alt`, `svg-img-alt` (§6); `a11y/tellings.test.ts` (meters) | SR reads icons and figures meaningfully (E1–E4) | | |
| 1.2.1 | A | Audio-only and Video-only (Prerecorded) | `npm run transcripts` | Each media item has a transcript (E3) | | |
| 1.2.2 | A | Captions (Prerecorded) | `<track kind="captions">` in `Sound.tsx`, `ScanIsbn.tsx` | Captions present and accurate | | |
| 1.2.3 | A | Audio Description or Media Alternative | none | Review each video | | |
| 1.2.4 | AA | Captions (Live) | none | Live calls (`screens/call`) | | |
| 1.2.5 | AA | Audio Description (Prerecorded) | none | Review each video | | |
| 1.3.1 | A | Info and Relationships | `a11y/landmarks.test.ts`, `labels.test.ts`, `fielderror.test.ts`; axe | Headings, lists, tables and form relationships read correctly (E1–E4) | | |
| 1.3.2 | A | Meaningful Sequence | none | Reading order matches visual order (E1, E3) | | |
| 1.3.3 | A | Sensory Characteristics | none | Instructions do not rely on shape or position only | | |
| 1.3.4 | AA | Orientation | no `orientation` lock (checked by search) | Rotate (E4) | | |
| 1.3.5 | AA | Identify Input Purpose | none | `autocomplete` on sign-in and profile fields | | |
| 1.4.1 | A | Use of Color | `FieldMessage` icon + words; `lib/unity.test.ts` (glyph + word per state) | Forced colours / greyscale (E11) | | |
| 1.4.2 | A | Audio Control | none | Nothing auto-plays | | |
| 1.4.3 | AA | Contrast (Minimum) | `lib/contrast.test.ts`, `.github/workflows/contrast.yml` (§6 is **not** evidence) | Spot-check with a colour picker on every ground | | |
| 1.4.4 | AA | Resize Text | `styles/textscale.test.ts`, `a11y/type.test.ts` | 200% text (E9) | | |
| 1.4.5 | AA | Images of Text | none | Review | | |
| 1.4.10 | AA | Reflow | `accessibility-smoke.mjs` (6 journeys @320); §6 (13 screens @320, 0 overflow); `ai/focusbar.test.tsx` | 400% zoom and a real 320px device (E7, E8) | | |
| 1.4.11 | AA | Non-text Contrast | `lib/contrast.test.ts` (hairlines) | Control edges, focus ring, icons (E11) | | |
| 1.4.12 | AA | Text Spacing | none | Text-spacing bookmarklet on each step | | |
| 1.4.13 | AA | Content on Hover or Focus | none | Tooltips and popovers are dismissible, hoverable and persistent | | |
| 2.1.1 | A | Keyboard | `a11y/dragging.test.ts`; §6 Tab walk | Complete every step keyboard-only (E6) | | |
| 2.1.2 | A | No Keyboard Trap | `a11y/modal.test.ts` (traps only in modals, Escape exits) | Editors, maps, canvas (E6) | | |
| 2.1.4 | A | Character Key Shortcuts | `lib/unity.test.ts` (⌘K not while typing); `keysnarrow.test.tsx` | `A` and `?` can be turned off or only act outside fields | | |
| 2.2.1 | A | Timing Adjustable | none | Session timeouts warn and extend | | |
| 2.2.2 | A | Pause, Stop, Hide | `a11y/calm.test.ts`, `motion.test.ts` | Nothing moves for more than 5 s without a control | | |
| 2.3.1 | A | Three Flashes | none | Review | | |
| 2.4.1 | A | Bypass Blocks | skip link, `accessibility-smoke.mjs`; §6 (first stop on every screen) | E1–E3 | | |
| 2.4.2 | A | Page Titled | `a11y/title.test.ts`; §6 titles | Title announced on each navigation | | |
| 2.4.3 | A | Focus Order | §6 Tab walk (order not judged) | Order follows meaning (E6) | | |
| 2.4.4 | A | Link Purpose (In Context) | axe `link-name` | Links make sense in the links list (E1, E3) | | |
| 2.4.5 | AA | Multiple Ways | Search, directory, tab bar | Confirm two ways to reach each screen | | |
| 2.4.6 | AA | Headings and Labels | §6 (one `h1`, no skips on 13 screens); label lint | Headings describe their sections | | |
| 2.4.7 | AA | Focus Visible | `a11y/focus.test.ts`; §6 (0 stops without a ring) | E6, E11 | | |
| 2.4.11 | AA | Focus Not Obscured (Minimum) | `ai/focusbar.test.tsx`, `ai/dock.test.ts`; §6 cover check | Tab through every step at 320px, in Guided and Focused (E8) | | Ask "Latest" button, see §6 |
| 2.5.1 | A | Pointer Gestures | `a11y/dragging.test.ts` | Swipe and pinch have single-pointer alternatives | | |
| 2.5.2 | A | Pointer Cancellation | none | Actions fire on up-event | | |
| 2.5.3 | A | Label in Name | none | Voice control by visible label (E13) | | |
| 2.5.4 | A | Motion Actuation | none | Review | | |
| 2.5.7 | AA | Dragging Movements | `a11y/dragging.test.ts` | Calendar move, reorder (E6) | | |
| 2.5.8 | AA | Target Size (Minimum) | `styles/taps.test.ts`, `reach.test.ts`; axe `target-size` (§6: 0) | Spot-check dense rows | | |
| 3.1.1 | A | Language of Page | `accessibility-smoke.mjs` (`lang` set) | E1 reads in the right voice | | |
| 3.1.2 | AA | Language of Parts | none | Non-English course content | | |
| 3.2.1 | A | On Focus | none | Focus never navigates or submits | | |
| 3.2.2 | A | On Input | none | Changing a select or toggle does not navigate unannounced | | |
| 3.2.3 | AA | Consistent Navigation | `lib/chrome.test.ts` | Review | | |
| 3.2.4 | AA | Consistent Identification | vocabulary rule (`scripts/terms.mjs`) | Review | | |
| 3.2.6 | A | Consistent Help | `unity.test.tsx` ("About this screen" everywhere) | Review | | |
| 3.3.1 | A | Error Identification | `components/FieldMessage.tsx`, `a11y/fielderror.test.ts`, `a11y/tellings.test.ts` | Step 5 with SR (E1–E4) | | |
| 3.3.2 | A | Labels or Instructions | label lint; field hints via `aria-describedby` | Review | | |
| 3.3.3 | AA | Error Suggestion | error texts give the fix ("Try 42.50, or $42.50") | Review each form | | |
| 3.3.4 | AA | Error Prevention (Legal, Financial, Data) | `TypeToConfirm`, `Undone` | Registration submit, data deletion | | |
| 3.3.7 | A | Redundant Entry | none | Multi-step forms | | |
| 3.3.8 | AA | Accessible Authentication (Minimum) | PKCE/SSO (`lib/cloud.ts`) | Paste allowed, no cognitive test | | |
| 4.1.2 | A | Name, Role, Value | label lint; axe `button-name`, `aria-*` rules (§6: 0 violations) | E1–E4 on every custom control | | |
| 4.1.3 | AA | Status Messages | `SaveState`, `Undone`, `LoadingState`, `FieldMessage` (polite) | Hear each status without focus moving (E1–E4) | | |

## 8. Re-running the automated pass

```bash
# scratch directory, once (see .claude/skills/run for why not in app/)
mkdir -p /tmp/pass && cd /tmp/pass
echo '{"name":"pass","private":true,"type":"module"}' > package.json
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright axe-core

# app dev server running on 5173, then from app/:
SMOKE_PLAYWRIGHT=/tmp/pass/node_modules/playwright \
AXE_CORE=/tmp/pass/node_modules/axe-core/axe.min.js \
CONTROL=1 ONLY=Today node scripts/keyboard-pass.mjs   # the control must trip
SMOKE_PLAYWRIGHT=/tmp/pass/node_modules/playwright \
AXE_CORE=/tmp/pass/node_modules/axe-core/axe.min.js \
OUT=/tmp/pass/run.json node scripts/keyboard-pass.mjs
# Focused mode: add WORKSPACE_MODE=focused TABS=80
```

Before recording a "covered" hit as a finding, re-check it after the page
settles. The probe measures at the instant focus lands.
