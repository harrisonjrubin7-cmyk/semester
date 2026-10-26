# Accessibility and inclusive design program

**Status: proposal, 2026-10-04. Nothing here is a conformance claim.** Semester has automated accessibility
guards and no human evaluation. There is no ACR, no published accessibility statement, no public contact and no
screen-reader pass on record. This page is the program that gets from the first state to the second, and says
what each step would prove. Where a sentence says "is", it names a file you can open. Where it says "must", it is a
requirement nobody has met yet.

Target: **WCAG 2.2 Level AA** for every surface a student, guardian, staff member, faculty member, advisor,
administrator, applicant or alumnus uses, plus the Section 508 and EN 301 549 mappings an ACR needs. Which laws
bind which customer, and what any of this means legally, is for qualified counsel.

## The pack

| Page | What it settles |
| --- | --- |
| **This page** | The principles, the lifecycle gates, the WCAG 2.2 AA program, component requirements, the standards by modality, the roadmap, owners and measures |
| [ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md) | The criteria every story carries, and the criteria each role's critical journeys add |
| [TESTING-AND-EVIDENCE.md](TESTING-AND-EVIDENCE.md) | Automated and manual testing, the assistive-technology matrix, conformance evidence, the ACR process, institutional review artifacts |
| [ISSUE-PROCESS.md](ISSUE-PROCESS.md) | Reporting, triage, severity and fix times, accessibility incidents, alternate-format requests, remediation |
| [INCLUSIVE-CONTENT-STANDARD.md](INCLUSIVE-CONTENT-STANDARD.md) | Plain language, structure, alt text, links, dates and numbers, AI output, translation |
| [ACCESSIBILITY-STATEMENT-DRAFT.md](ACCESSIBILITY-STATEMENT-DRAFT.md) | The public statement, drafted, **not published**, and the conditions for publishing it |

It extends, and does not replace:
[AT-PASS-PROTOCOL.md](AT-PASS-PROTOCOL.md) (the manual script and the WCAG checklist for the ACR),
[../ACCESSIBILITY-POLISH-CHECKLIST.md](../ACCESSIBILITY-POLISH-CHECKLIST.md) (what the code guards today),
[../WCAG-UI-AUDIT-SCORECARD.md](../WCAG-UI-AUDIT-SCORECARD.md) (the per-component scale),
[../RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md](../RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md),
[../operating-model/ACCESSIBILITY-GOVERNANCE.md](../operating-model/ACCESSIBILITY-GOVERNANCE.md) (champions, backlog, panel),
[../trust/HECVAT-VPAT-PLAN.md](../trust/HECVAT-VPAT-PLAN.md) and
[../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md](../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md).

## 1. Where Semester stands

Read from the tree on 2026-10-04.

| Held, and by what | Not held |
| --- | --- |
| Every control has a name: `npm run lint` runs `scripts/labels.mjs`; `a11y/labels.test.ts` | Any manual screen-reader pass (HECVAT A11Y-3, `NOT_STARTED`) |
| One `main`, one `h1`, named landmarks, window titles: `a11y/landmarks.test.ts`, `a11y/title.test.ts` | An ACR (A11Y-2, `NOT_STARTED`) |
| Focus ring, dialogs trap and release focus: `a11y/focus.test.ts`, `a11y/modal.test.ts` | A published accessibility statement and a public report route with fix times (A11Y-4, `NOT_STARTED`) |
| Field errors beside the field, `aria-invalid`, focus to the first error: `a11y/fielderror.test.ts` | Keyboard and screen-reader audit of rich-text editors, data tables, charts and media controls (`ACCESSIBILITY-POLISH-CHECKLIST.md`, open items 3) |
| Drag has a non-drag path: `a11y/dragging.test.ts` | Captions audited on every player; audio description; live captions on calls (`screens/call`) |
| Reduced motion, Less motion and Low stimulation: `a11y/motion.test.ts`, `a11y/calm.test.ts` | Text-spacing (1.4.12), hover/focus content (1.4.13), reading order (1.3.2) and `autocomplete` (1.3.5) have no automated guard |
| Contrast on every ground and accent, in CI: `lib/contrast.test.ts`, `.github/workflows/contrast.yml` | Native iOS and Android clients: none exist, so the matrix below covers the web app on phones |
| axe-core over the rendered app, zero serious or critical, in `npm test`: `a11y/axe.test.tsx` (jsdom: contrast and layout rules cannot answer) | Any of: `smoke:a11y`, `sweep:contrast`, `sweep:targets`, `keyboard-pass` in CI beyond the one run noted in `ACCESSIBILITY_READINESS.md` |
| Text size, line spacing and density answer settings: `styles/textscale.test.ts`, `styles/density.test.ts` | A message catalogue, locale choice for the interface, plain-language mode (see the localization page) |
| Skip link keeps the route: `a11y/skiplink.test.tsx` | A named accessibility owner. Held since 2026-10-04 by @harrisonjrubin7-cmyk; no champions, panel or mailbox yet |

The two columns decide the program. Automated guards are strong and stay. The gap is the human half: people
using assistive technology, in the real journeys, with the results written down.

## 2. Principles

1. **Embedded, not final.** Accessibility is a requirement at design, a rule in code, a test in CI and a gate at
   promotion. A defect found at the end is a failure of an earlier gate, and the earlier gate gets the fix (a lint
   rule or a shared component), not only the defect.
2. **Fix it once, in the shared piece.** `components/ui.tsx`, `FieldMessage`, the dialog, the tokens. A screen
   that hand-rolls what a shared piece does is a finding. Recurrence is the measure (§9).
3. **Native means accessible.** A capability is live only when it has accessibility coverage; this is already
   question 4 of [../DEFINITION-OF-DONE.md](../DEFINITION-OF-DONE.md) and row "Accessibility coverage" of the launch
   acceptance rule. This program makes "coverage" mean the criteria in ACCEPTANCE-CRITERIA.md.
4. **No claim past the evidence.** Automated results are regression evidence. A manual pass is evaluation
   evidence. Neither is a certification. The statement, the ACR, the site and sales material say exactly what the
   evidence supports, and `app/src/lib/ops/claims.test.ts` already refuses site labels the claims register does not know (`ops/claims/README.md`).
5. **People who use the barrier decide.** Paid disabled users sit in the loop (§8), and their findings outrank a
   tool's clean report.
6. **Settings are adaptations, not a ghetto.** Larger text, calmer motion, plain language and higher contrast are
   available to everyone, from Settings, on every device, without a diagnosis or a request. No feature is
   withheld from someone using them.
7. **Time is an access barrier.** Registration windows, payment deadlines, exam sessions and timed forms are the
   places inaccessible design costs people the most. They get the strictest criteria (§4, SC 2.2.1, 3.3.4).
8. **AI is held to the same bar.** Chat, generated study material and suggestions meet the same criteria, plus the
   ones in §6.10.

## 3. Lifecycle gates

Accessibility has an input at every stage. Each gate names who signs and what blocks.

| Gate | When | What must be true | Evidence | Blocks |
| --- | --- | --- | --- | --- |
| **G0 Design** | Before a screen or flow is built | The design states: heading outline, landmark map, focus order, keyboard model, every state (empty, loading, error, offline, success), reflow at 320px, what changes under Less motion, plain-language copy reviewed against the content standard. A drag, a gesture, a timer, a chart or a map names its alternative. Colour comes from tokens | Design note in the story; component picked from the shared set or a new-component spec (§5) | Starting the build |
| **G1 Build** | Pull request | Acceptance criteria met (the universal set plus the role set); automated guards green; the story's manual keyboard check recorded; no new inline colour, size or hand-written error state; a new control has a name | PR checklist (below); `npm run lint`, `npm test`, `npm run test:shuffle` | Merge |
| **G2 Integrate** | Merge to `main` | `a11y/axe.test.tsx` zero serious/critical across the screen list; contrast ramp green; any new screen added to the axe list and `accessibility-smoke.mjs` journeys | CI run | The next ring |
| **G3 Ring promotion** | Moving a capability to the next tenant ring (rings 0 to 4, D-1144) | Manual keyboard and one screen-reader pass on the changed journeys, in the required matrix rows for that ring; browser sweeps run against the build under test; every open finding has a severity and an owner; no Critical or Serious open on the journey | Results rows in the pass record (TESTING-AND-EVIDENCE §4); sweep outputs for the exact commit | Promotion |
| **G4 Launch to an institution** | Before an institution's go-live | Current ACR for the build, or a written statement of what is evaluated and what is not; accessibility statement published with contact and fix times; alternate-format workflow staffed on the institution's side; institution's accessibility coordinator has had the review packet | ACR, statement, review packet, signed go/no-go | Go-live |
| **G5 Claim** | Before any public or sales sentence about accessibility | The sentence matches the evidence table in TESTING-AND-EVIDENCE §6 | Claims register entry | Publishing the sentence |

### The pull-request checklist (G1)

Copy into the PR body for any change that renders UI. A change with no UI says "no UI change".

```text
Accessibility
- [ ] Heading outline and landmarks unchanged, or described
- [ ] Every new control has a visible label or a name; icon-only controls have a name
- [ ] Keyboard: reached, operated and left with the keyboard alone; focus visible and not hidden (SC 2.4.7, 2.4.11)
- [ ] Focus lands somewhere sensible after open, close, route change, delete and error
- [ ] Reflow: 320 CSS px, no two-way scroll for ordinary content
- [ ] Target size at least 24x24 (44 for primary touch controls)
- [ ] Colour from tokens; state is word plus glyph, never colour alone
- [ ] Motion honours the device query and the app's Less motion / Low stimulation
- [ ] Every drag, swipe, hover or long-press has a single-pointer, no-drag alternative
- [ ] Errors beside the cause, in words, with a way to fix; entered data kept
- [ ] Status changes announced without stealing focus; no live-region spam
- [ ] Copy follows INCLUSIVE-CONTENT-STANDARD.md; no jargon without a definition
- [ ] Added to axe.test.tsx's screen list and the smoke journeys if it is a new screen
- [ ] Manual check done and by whom: keyboard / screen reader / zoom (delete what was not done, do not tick it)
```

The last line matters. A box ticked for a check nobody ran is the failure this repository's other gates were
written against.

## 4. WCAG 2.2 AA: the implementation program

`AT-PASS-PROTOCOL.md` §7 already lists every Level A and AA criterion with the automated evidence and the manual
check. This section says how each group is *built in*, and names the six criteria that are new or changed in 2.2
and so the most likely to be missed. 4.1.1 Parsing is obsolete in 2.2 and is not tracked.

### New in 2.2 (AA and A)

| SC | What it asks | How Semester meets it | Guard today |
| --- | --- | --- | --- |
| 2.4.11 Focus Not Obscured (Minimum) AA | A focused control is not entirely hidden by sticky UI | `scroll-margin-top: var(--focus-clear-top)` (96px) and `--focus-clear-bottom` (84px) on every focused element, clear of the header, tab bar, Focus bar and assistant button | `styles/tokens.test.ts` holds the values; **not measured per component**. G3 measures it by Tab walk (`keyboard-pass.mjs` records whether each stop's centre is covered) |
| 2.5.7 Dragging Movements AA | Every drag has a single-pointer alternative | Calendar, reorder lists, file drop and sliders each carry a button or typed path | `a11y/dragging.test.ts` |
| 2.5.8 Target Size (Minimum) AA | 24x24 CSS px, with spacing exceptions | `.tap`, `.tap-x`, `.tap-y` to 44px; `.btn` floor 44px | `styles/taps.test.ts`, `styles/reach.test.ts`; `sweep:targets` measures (not CI) |
| 3.2.6 Consistent Help A | Help in the same relative place on every screen | "About this screen" is last in every screen's content; full-bleed screens open it in a sheet | `components/unity/unity.test.tsx` |
| 3.3.7 Redundant Entry A | Do not ask again for what was entered in the same process | Rule for forms (§6.6): carry values forward, autofill from the profile, never re-ask for a course, date or ID already given in the flow | **No guard.** Needs a review item at G0 |
| 3.3.8 Accessible Authentication (Minimum) AA | No cognitive-function test to sign in, unless an alternative exists | Allow paste and password managers; `autocomplete` on credentials; passkeys and magic links as the alternative; no CAPTCHA that needs recognition without an alternative; no "retype characters from memory"; MFA codes pasteable, and one-tap approval offered | **No guard.** `Credentials.tsx` is Step 1 of the manual script |

### The rest of AA, by how it is built in

| Group | Criteria | Built in as | Gap to close |
| --- | --- | --- | --- |
| Text alternatives and media | 1.1.1, 1.2.1 to 1.2.5 | Alt policy in the content standard; every figure and chart has a text or table alternative; every audio or video has captions and a transcript; prerecorded video has audio description or a described alternative; live calls have captions | Captions "not audited for every player"; no audio description; no live captions on calls |
| Structure | 1.3.1 to 1.3.5 | Semantic HTML first, ARIA only to fill a gap; one `h1`, no skipped levels; tables with headers; reading order equals DOM order; `autocomplete` tokens on profile and credential fields; no orientation lock | 1.3.2, 1.3.3 and 1.3.5 unguarded |
| Colour and appearance | 1.4.1, 1.4.3, 1.4.11, 1.4.12, 1.4.13 | Tokens only; every ground measured; word plus glyph for state; text spacing overrides must not clip or overlap; hover and focus popovers are dismissible, hoverable, persistent | 1.4.12 and 1.4.13 unguarded. Add a text-spacing run to `keyboard-pass.mjs` (§7) |
| Resize and reflow | 1.4.4, 1.4.10 | Sizes from the type scale; no fixed pixel text; layouts stack at 320px | Smoke covers six journeys; the rest is `·` in the scorecard |
| Audio and motion | 1.4.2, 2.2.2, 2.3.1 | Nothing autoplays; anything that moves for over five seconds can be paused; no flashing | No guard on flashing; review item at G0 |
| Keyboard | 2.1.1, 2.1.2, 2.1.4 | Every action by keyboard; the only traps are modals, with Escape; single-key shortcuts act outside fields only and can be turned off | Rich-text editors, charts, maps, media: unaudited |
| Time | 2.2.1 | Registration and timed flows show the limit, let the user extend, and never expire while the user is typing (§6.9) | No guard |
| Navigation | 2.4.1 to 2.4.7, 2.4.11 | Skip link, titles, focus order, link purpose, multiple ways to find a page (nav, search ⌘K, help), headings and labels that describe | Skip link and titles guarded; link purpose and multiple ways are manual |
| Input modalities | 2.5.1 to 2.5.8 | Complex gestures have a simple path; pointer up-event cancel; label in name; no motion actuation required | 2.5.3 Label in Name: **no guard**. Voice-control rows in the matrix exist to catch it |
| Language | 3.1.1, 3.1.2 | `lang` on the document; `lang` on passages in another language | Interface is English only today. When a catalogue lands, `lang` follows it |
| Predictable | 3.2.1 to 3.2.4, 3.2.6 | No context change on focus or on input; consistent nav and identification; consistent help | Manual |
| Input assistance | 3.3.1 to 3.3.4, 3.3.7, 3.3.8 | Errors identified in text; labels or instructions; suggestions; **reversal, check or confirm for legal, financial and data-changing submissions** (registration, payment, deletion): `TypeToConfirm`, `Undone`, review step | Guarded for fields; the review step on registration and payment is a G0 requirement |
| Robust | 4.1.2, 4.1.3 | Name, role, value; status messages announced without focus | Labels and live regions guarded |

## 5. Component-level requirements

A component is "done" when its row holds. The shared set in `components/ui.tsx` and `components/unity/*` is the
only place these are implemented; a screen that needs a variation extends the shared piece. The scale and the
scored first pass are in [../WCAG-UI-AUDIT-SCORECARD.md](../WCAG-UI-AUDIT-SCORECARD.md).

| Component | Name, role, state | Keyboard | Visible and sized | Also |
| --- | --- | --- | --- | --- |
| Button, icon button | Native `<button>`. Icon-only has an accessible name that is not a tooltip alone. Toggles expose `aria-pressed`; disclosure exposes `aria-expanded` | Enter and Space. Disabled that matters to a user is `aria-disabled` and explains why, not silently removed | 44px floor; focus ring offset 2px; label text contained in the name (2.5.3) | No colour-only state |
| Link | Native `<a>` with a destination. Link text makes sense alone; "here" and "read more" are findings. External and file-download links say so | Enter | Underlined or otherwise not colour-alone; 24px target | `.link-quiet` for text buttons |
| Text field, textarea | Visible `<label>`; placeholder is never the name; hint and error through `aria-describedby`; `required` and `aria-invalid` set; `autocomplete` and `inputmode` set | Native | 16px minimum on touch (`styles/fields.test.ts`) | Errors through `FieldMessage`, never hand-written; paste allowed everywhere, including password and code fields |
| Select, combobox, autocomplete | Native `<select>` where it will do. A custom combobox follows the ARIA APG pattern: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, results count announced politely | Arrow keys, Home, End, Escape, type-ahead | Option rows 44px on touch | Selection never fires an action on focus (3.2.2) |
| Checkbox, radio, switch | Native inputs or `role="switch"` with `aria-checked`. Group has `fieldset` and `legend` | Space; arrows in a radio group | Hit area includes the label | Switch states say "On" and "Off" in words |
| Date and time picker | A typed alternative always exists. The grid, if present, is a labelled grid with arrow-key navigation and a visible selected date. Format is shown, not implied | Full keyboard; Escape returns focus to the trigger | 44px cells on touch | Read the date in words ("Tuesday 14 October") |
| Dialog, sheet, drawer, popover | `role="dialog"` or `alertdialog`, `aria-modal`, named by its heading, described when it has a message. `a11y/modal.ts` is the one implementation | Focus moves in, is trapped, Escape closes, focus returns to the opener. A popover that is not modal does not trap | Scrim contrast; content scrolls inside at 320px | Background is `inert` while a modal is open |
| Tabs, accordion, disclosure, menu | ARIA APG patterns, selected state announced, `aria-current` on the current destination | Roving focus for tabs and menus; Tab leaves the widget | 44px | Do not use `role="menu"` for navigation; use a list of links |
| Tab bar and rail, global navigation | Named `navigation` landmark; current destination is `aria-current="page"` | Tab order equals visual order | Counts and badges are read in words ("3 unread") | Same destinations on every device (parity) |
| Data table | Real `<table>` with `<th scope>`; a caption naming it; sortable headers expose `aria-sort`; row actions are named for the row | Cell focus only where a grid is truly needed | Reflows to a labelled list at 320px, or scrolls inside a labelled, focusable region with a visible scroll hint | Row selection announced as a count |
| Calendar | Week and month grids are labelled; **Agenda is the equal alternative** and is reachable in one step; each event is read with date, time, course and status | Arrow keys across days; Enter opens; move and resize by keys and by a Move dialog (2.5.7) | Colour is never the course identity alone | Time zone stated |
| Chart, meter, graph | Every figure has a text equivalent: the number in words (`Meter`, `a11y/tellings.test.ts`), plus a data table behind a disclosure for charts. The dataviz skill's palette rules apply | Focusable series only if interactive, with a keyboard-reachable tooltip | 3:1 for marks, pattern or label in addition to colour | Trend in a sentence |
| Rich-text and code editor | Labelled; toolbar buttons named with pressed state; formatting commands have keys; mode changes announced | Tab leaves the editor (no trap); a documented key moves to the toolbar | Honours text size and spacing | **Unaudited today** |
| File upload and drop zone | A real `<input type="file">` behind the drop zone; progress, success and failure announced | Enter opens the picker | Drop target also has a button | Alternatives for drag |
| Toast, banner, status | `role="status"` (polite) for success and progress; `role="alert"` only for errors that block; never the only place a message lives | Not focusable unless it has an action; actions reachable | Stays long enough to read, with a way to re-read; dismissible; not hidden behind the Focus bar | `SaveState`, `Undone`, `LoadingState` already follow this |
| Loading, skeleton | Announces once (`LoadingState`); skeleton regions are `aria-hidden` and the container is `aria-busy` | Focus is kept, not reset, when content arrives | No shimmer under Less motion | Time-outs say what happens next |
| Error and empty states | Words, a glyph, and one recovery action. Empty states say why and what to do | `ErrorState` is announced and carries focus only for page-level failure | | Plain language |
| Media player | Native controls or a fully keyboard and screen-reader operable custom set; captions on by default where the user set them on; transcript adjacent; speed control; no autoplay | Space, arrows, `m`, `c` documented | Controls 44px | Audio description track or described version |
| AI chat and generated content | Message list is a `log` or list; streaming does not announce every token. A completed answer is announced once, politely; **Stop** is keyboard reachable during streaming; sources are real links; the composer keeps its place | Enter sends, Shift+Enter newline, both stated; Escape does not discard a draft | Code and maths are readable by a screen reader (§6.10) | "Why am I seeing this" opens a dialog |
| Search and command palette | `role="dialog"` with a labelled combobox; result count announced; ⌘K/Ctrl+K not while typing or under a modal | Full | | `lib/unity.test.ts` guards the trigger |
| Timers and countdowns | Shown in text; extend or turn off where the task allows; never auto-submit; announce at thresholds, not every second | | | SC 2.2.1 |
| Map and location | Equivalent list of the same places with directions in text; pan and zoom by keys and buttons | | | Step-free, quiet-space and captioned fields as data (§6.8) |
| Export, PDF, email and notification | Tagged PDF with title, language, headings, table headers and alt; emails with semantic HTML and plain-text part; notification text readable alone | | Contrast in dark and light | Alternate formats on request (ISSUE-PROCESS §6) |

A **new** component ships with: the row above filled in for it, a test that fails if its name, state or focus
behaviour regresses, an entry in the scorecard, and its alternative for drag, hover or gesture. If it cannot meet
a row, it does not ship; it does not ship with an exception.

## 6. Standards by modality

These are the requirements the criteria and component rows serve. Each ends with the check that proves it.

### 6.1 Keyboard

- Everything a pointer does, a keyboard does, in a predictable order that matches the visual one. No keyboard
  trap other than a modal, which Escape leaves.
- Focus is always visible (the app ring, not suppressed) and never wholly hidden (§4, 2.4.11).
- Focus moves on purpose: into a dialog on open and back to the opener on close; to the first invalid field on
  failed submit; to the new screen's heading on route change; to the next item (not the page top) after a delete.
- Shortcuts: single-character shortcuts act outside text fields only, are listed, and can be turned off (2.1.4).
- **Prove it:** `keyboard-pass.mjs` Tab walk (first 40 stops, ring present, not covered), then a person completes
  each journey keyboard-only (environment E6).

### 6.2 Screen reader

- Name, role, state and value for every control; headings and landmarks give the page a map; live regions are
  used sparingly (status polite; alert for blocking errors; never per-keystroke).
- Every number, time and status has a spoken form: "Now, 3:11"; "12 of 120 credits"; "From the registrar, updated
  2 hours ago".
- Decorative graphics are hidden; informative ones have alt; icon plus text is not announced twice.
- **Prove it:** the AT pass (TESTING-AND-EVIDENCE §4) with the words actually spoken recorded, not a tick.

### 6.3 Touch and pointer

- 24px minimum targets everywhere and 44px for primary touch controls; spacing between adjacent targets.
- No path-based or multi-finger gesture is required; swipe actions have a button; drag has a menu (2.5.1, 2.5.7).
- Press cancels on move-off before release; no action on touch-down (2.5.2).
- Works in portrait and landscape; no orientation lock (1.3.4). Works with a stylus, a switch and a mouse.
- **Prove it:** `sweep:targets`, `styles/reach.test.ts`, and the touch rows in the matrix (E4, E5, E14).

### 6.4 Zoom, reflow and magnification

- 200% browser zoom and 200% text-only zoom lose no content or function; at 320 CSS px (400% of 1280) ordinary
  content has no two-way scroll. Data tables, calendars and maps are the permitted two-dimensional exceptions and
  each has a linear alternative (Agenda, list).
- Text scale and line spacing move everything, including the tab bar (`styles/textscale.test.ts`).
- Text-spacing overrides (line height 1.5, paragraph 2x, letter 0.12em, word 0.16em) clip nothing (1.4.12).
- Screen magnifiers: content that appears on focus or hover appears near it; nothing needs a pointer to a far edge.
- **Prove it:** E7, E8, E9 and a text-spacing run.

### 6.5 Voice control and speech

- Every control's accessible name contains its visible text (2.5.3), so "click Save" works. Controls named by an
  icon only have a name a person would say.
- No target is reachable only by hover. Numbered overlays (Voice Control, Dragon) must reach every control, so
  custom widgets expose real roles.
- Dictation into every text field works: no field strips composed input, and no per-key handler eats it.
- **Prove it:** E13 and E16 are required rows for the ACR (they were optional in the first protocol; the label
  rule makes failures cheap to find and the audience is large).

### 6.6 Forms and authentication

- Visible labels, hints before the field, errors after the cause, in words, never colour alone; focus to the
  first invalid field; the entered data kept (`Trouble` retries without re-entry).
- Redundant entry (3.3.7): a flow never asks twice for something already given in it; the profile pre-fills what
  it knows.
- Accessible authentication (3.3.8): paste allowed, `autocomplete` correct, passkeys and links offered, and no
  step that needs memorising a string, transcribing characters or solving a puzzle without an alternative.
- Registration, payment, deletion and grade-affecting submissions have a **review step** or an undo (3.3.4).
- **Prove it:** the manual step 1 and 5 rows; a form checklist at G0.

### 6.7 Reduced motion, calm and sensory

- `prefers-reduced-motion` is honoured; the app's own **Less motion** and **Low stimulation** settings (`data-calm`)
  change every animation, parallax, auto-scrolling and transition, including script-driven scrolling
  (`scrollKindly`).
- No flashing above the three-per-second threshold; nothing moves for over five seconds without a pause.
- Sound is never the only signal and never starts on its own.
- Glass and translucency go opaque under reduced transparency, more contrast, forced colours and Low stimulation
  (`styles/glass.test.ts`).
- **Prove it:** E10, E11 and `a11y/calm.test.ts`.

### 6.8 Contrast, colour and appearance

- 4.5:1 text (3:1 large), 3:1 for non-text marks and focus rings, **on every ground a surface can sit on**, not
  the one that flatters it; measured by `lib/contrast.test.ts`, which walks the whole ramp.
- Colour is never the only carrier: every state is a word plus a glyph (`lib/unity.test.ts`); series in charts
  differ by label or pattern.
- Light, dark, high contrast and Windows forced colours each work; forced colours keep edges and focus (`Highlight`).
- A user-chosen accent shows its contrast verdict before it can be saved (`screens/settings/Look.tsx`).
- **Prove it:** CI (`contrast.yml`), `sweep:contrast` on painted pixels, and E11.

### 6.9 Time

- Every time limit is disclosed at the start, adjustable, extendable or turn-off-able, with a warning and at least
  twenty seconds to extend, except where essential (an exam clock, a real-time auction); in that case the
  institution's accommodation workflow (extra time) is a first-class, tested path, not an email.
- Sessions never time out while a form with unsaved input is open without first saving a draft.
- Registration windows and deadlines show the time zone and the wall clock; the order of a queue is explained.

### 6.10 Captions, transcripts, audio description, and AI output

- **Prerecorded:** captions that are accurate (corrected, not raw auto-caption), speaker-identified, with sound
  cues; a transcript on the same page; audio description, or a described alternative, for anything where visuals
  carry meaning. Lecture recordings and imported media inherit these requirements: a recording with no captions is
  marked "Captions missing" and requestable (ISSUE-PROCESS §6), not hidden.
- **Live:** meeting and call surfaces offer live captions and a transcript; a human-captioning (CART) request
  path exists for scheduled events.
- **Audio features** (the app's own audio and read-aloud): every audio has a transcript; speed, pause and
  skip; no auto-play.
- **AI output:** headings, lists and tables are real markup; maths in MathML or with a spoken form; code in code
  blocks with a language label; sources are links with names; confidence and provenance are text; streaming never
  moves focus or floods announcements; the **Stop** control is the first thing after the composer in tab order;
  generated study material is checked against the content standard; images carry alt text generated *and* editable.
  The AI must not be the only route to any capability (existing rule: AI is optional, `aioptional.test.ts`).

### 6.11 Dyslexia-aware, reading and language support

- Reading settings, all of them in Settings → Appearance and reachable from any screen: text size, line spacing,
  letter and word spacing, reading width, a dyslexia-friendly typeface option, a reading ruler or line focus,
  tinted backgrounds, left-aligned text only (no justified), and a no-italics-for-long-text rule in generated
  content.
- Content layout: short paragraphs, sentence-case headings, bullet lists for steps, no text in images, no
  all-capitals for sentences, numerals and units consistent.
- Read-aloud with synchronised highlighting is available for any body of text, and works with text size.
- Plain-language mode (a second message per key, see the localization page) and glossary hover/tap definitions
  ("hold", "audit", "bursar").
- Spell-check and autosuggest are never disabled in text fields unless they would leak a secret.
- Translation: the interface and, where policy allows, generated content can be read in another language; the
  `lang` attribute follows; each translated string records its provenance
  (`official_translation · machine_translated · student_entered`, per the localization page); right-to-left layouts
  are tested (`lib/locale.ts` already isolates mixed-direction values).
- Dyslexia fonts are an option, not a finding: evidence for their benefit is mixed, which is why spacing,
  width and tint sit beside them and why none is the default.

### 6.12 Cognitive accessibility

Mapped to the W3C COGA objectives. Each is a G0 design check and a manual review item.

| Objective | Requirement |
| --- | --- |
| Help users understand what things are and how to use them | Every screen has "About this screen" in the same place; labels are nouns and verbs a student uses; icons have words |
| Help users find what they need | Search; consistent navigation; five destinations; breadcrumbs for deep records; "where am I" in the title and heading |
| Use clear and understandable content | The content standard: plain language, short sentences, defined terms; no idioms |
| Help users avoid mistakes and easily correct them | Confirm irreversible; Undo; preview what will be sent or submitted; drafts kept |
| Ensure processes do not rely on memory | Show what the user entered before the next step; don't make them remember a code across screens; progress is visible ("Step 2 of 4") |
| Provide help and support | Plain-language help beside the task; a human route (office hours, support) on every dead end; no timed help |
| Limit interruptions and distractions | Low stimulation mode; no pop-ups on arrival; notifications are the user's to tune; no countdown pressure |
| Ensure good-faith, non-manipulative design | No dark patterns, no urgency theatre, no guilt copy; consent choices equal in weight (matches the platform design laws) |
| Support adaptation and personalization | Settings travel with the account (Appearance, Reading, Motion); symbols and simple-language variants where available |

### 6.13 Mobile and native

Today the product is a React/Vite web app, used on phones in the browser. Everything above holds there, and
TalkBack and VoiceOver on iOS are required rows. When native clients exist (D-1144 leaves that open), they carry
the same criteria through the platform's own APIs: accessibility labels, traits and actions; Dynamic Type and
font scaling; Switch Control and Switch Access; Voice Control; reduce motion; larger and bold text; and platform
captions. A native client does not ship without its own pass in the matrix.

## 7. Roadmap

Ordered by what moves the evidence, not by size. Dates are for the owner to set; "unassigned" is honest.

| # | Work | Closes | Owner | Depends on |
| --- | --- | --- | --- | --- |
| 1 | ~~Name the accessibility lead~~ **done 2026-10-04** (@harrisonjrubin7-cmyk). Still to name: three champions (engineering, product, content) | Governance rows with no holder | Accessibility lead | None |
| 2 | **Run the manual AT pass** on the eight golden-path steps, rows E1 to E8, E10, E11 | A11Y-3; feeds A11Y-2 | Accessibility lead, with a paid AT user | 1; a seeded account |
| 3 | **Publish the accessibility contact and the severity-to-fix-time table** (the one in ISSUE-PROCESS §3) | A11Y-4 | Accessibility lead | 1; a mailbox that someone reads |
| 4 | **Publish the statement** (the draft here) only after 2 and 3, edited to what was found | Public trust, procurement question | Accessibility lead and counsel | 2, 3 |
| 5 | **Partly done 2026-10-04:** `keyboard-pass.mjs` now has 1.4.12 text-spacing and 2.5.3 label-in-name checks, reads the browser's computed accessible name, separates transient from persistent focus overlap, and its `CONTROL=1` run fails (exit 3) unless every planted fault is reported. Still open: 1.4.13 hover/focus content and 3.3.8 / `autocomplete` checks, each with its own plant | Unguarded criteria (§4) | Engineering champion | None |
| 5b | Add the G1 accessibility checklist (§3) to `.github/pull_request_template.md`. That template's scope questions are held verbatim by `operatingsystem.test.ts`, so this is its own small change | G1 | Engineering champion | None |
| 6 | **Run `smoke:a11y`, `sweep:contrast` and `sweep:targets` as a nightly CI job** against the staging build, failing on any finding | G2; they are not CI steps today | Engineering champion | CI minutes |
| 7 | Keyboard and screen-reader audit of rich-text editors, data tables, charts and media; add the missing guards | Open item 3, scorecard `·` cells | Engineering champion | 2 |
| 8 | Captions audit of every player; audio description decision; live-caption approach for `screens/call` | SC 1.2.x | Content champion | Vendor decision |
| 9 | Reading settings completed (§6.11): reading ruler, tint, letter and word spacing, read-aloud highlight | COGA, dyslexia requirements | Product champion | Appearance page |
| 10 | Guardian, alumni, staff and applicant surfaces get the role criteria and a pass of their own | Roles beyond the student | Accessibility lead | 2 |
| 11 | **Independent WCAG 2.2 AA audit** by an external firm with disabled testers; remediate Critical and Serious | A11Y-2 | Accessibility lead | 2 |
| 12 | **Publish the ACR** on VPAT 2.x, with version, date and known limitations | A11Y-2 | Accessibility lead and counsel | 11 |
| 13 | Annual re-audit and a regression-driven re-test after any major redesign | Currency | Accessibility lead | 12 |

Items 1 to 4 need no engineering and are the fastest honest movement. Item 2 before item 11: an auditor's time is
wasted on defects a person with NVDA would have found in an afternoon.

## 8. Roles and ownership

| Seat | Owns | Today |
| --- | --- | --- |
| Accessibility lead | This program, the backlog, the ACR, the statement, the audit contract, the panel | **@harrisonjrubin7-cmyk, from 2026-10-04** |
| Engineering champion | Shared components, the lint and test guards, CI sweeps, the component rows | Unassigned |
| Product champion | G0 design review, acceptance criteria in stories, the reading and calm settings | Unassigned |
| Content champion | The content standard, caption and transcript pipeline, alt-text, translation provenance | Unassigned |
| Assistive-technology panel | Paid screen-reader, switch, voice, magnification, low-vision, deaf and hard-of-hearing, dyslexic and ADHD, autistic and cognitive-disability users; monthly sessions and G3 spot-checks | Not recruited |
| Institution accessibility office | The institution's own alternate-format and accommodation decisions; receives the review packet | Per institution |
| Counsel | Which laws and standards bind which customer; the wording of the statement and ACR; safe-harbour language | Qualified counsel must approve; none engaged by this pack |

The panel is paid. Unpaid disabled users are not a testing strategy.

## 9. Measures

Reported monthly to the launch readiness council. Recurrence is the one that shows whether the program works: a
defect class that returns belongs in a shared component or a lint rule.

| Measure | Definition | Target proposed |
| --- | --- | --- |
| Open findings by severity | Count of Critical, Serious, Moderate, Minor, with age | Zero Critical; Serious inside SLA |
| Time to fix | Report to verified fix, per severity | Meets ISSUE-PROCESS §3 |
| **Recurrence** | Findings in a class already closed once | Falling; any recurrence yields a guard |
| Journey coverage | Critical journeys with a manual pass recorded on the current ring's build ÷ all critical journeys | 100% before ring 3 |
| Role coverage | Roles with their criteria and a pass ÷ roles in `app_roles` plus guardian | 100% before institutional launch |
| Guard coverage | Criteria with an automated guard ÷ criteria applicable; unguarded list published | Rising; each unguarded one has a plan |
| Escape rate | Findings reported by a user that the pipeline should have caught | Falling |
| Panel sessions | Held per month; findings from them | At least one a month |
| Report responsiveness | Reports acknowledged inside the stated time | 100% |
| Content findings | Missing alt, captions, heading and link errors found by the content checks per release | Falling |

## 10. What this program does not do

- It does not claim conformance. No claim is possible until item 12.
- It does not decide legal obligation, the wording of the statement or the ACR, or contract language: that is for
  qualified counsel.
- It does not replace an institution's accommodation process; it makes the product work with it.
- It does not add a feature, a flag or a migration. It adds documents, and names the tests and CI steps to be
  written, which each ship in a pull request of their own.
