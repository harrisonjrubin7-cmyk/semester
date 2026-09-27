# Onboarding and contextual help

## Progressive setup: the first-session goal

The brief asks for no long form before value: ask what the student came for,
then take them straight there, and defer everything else until a workflow
needs it.

`FirstGoal` in `app/src/components/unity/CommandCenter.tsx`, with the goals in
`app/src/lib/goals.ts`, is drawn at the top of Today (both feed layouts in
`screens/Today.tsx`):

> **What would help most today?**
> Build my semester · Understand my degree path · Prepare for registration ·
> Study for a course · Find campus support · Explore careers
> You can change this any time.

| Goal id | Label | Goes to | Suggested first step |
| --- | --- | --- | --- |
| `semester` | Build my semester | `import` | Add a syllabus to put its deadlines on your calendar |
| `degree` | Understand my degree path | `pathway` | Review what your degree still needs |
| `registration` | Prepare for registration | `registrar` | Check your registration readiness |
| `study` | Study for a course | `study` | Pick a course and a way to study it |
| `support` | Find campus support | `university` | See the campus services you can reach |
| `career` | Explore careers | `career` | Look at what is due for applications |

- Choosing one stores it as the `goal` look key and navigates at once. Nothing
  is asked first — no account, no profile.
- Once chosen, the block folds to one line: "Your focus · {goal} ·
  {first step} · Change". Change reopens the choice.
- The goal decides what is suggested first; it unlocks and hides nothing.
- The choices are toggle buttons (`aria-pressed`) under a real `h2`.
- It syncs with the account like the rest of the look (`lib/merge.ts`,
  `lib/privacy.ts`) and is described in the export (`lib/export.ts`).
- Hidden in Focused workspace mode (`.hides-in-focus`).
- `lib/unity.test.ts` holds that every goal's screen is a real destination;
  `components/unity/unity.test.tsx` drives choosing, landing and Change.

The brief's "choose institution/context" step is not part of `FirstGoal`; the
existing onboarding handles school and term (below).

## The existing onboarding

These predate this work and were not changed.

- **`app/src/screens/Onboarding.tsx`** — the `onboarding` screen, rendered
  full-device by `App.tsx`. Steps built from what the student has actually
  supplied (not the sample semester), with sign-in where a cloud project is
  configured, a school picker (`SchoolPicker`), a term choice (`TermChoice`),
  credentials, and reminder preferences. `screens/onboardingcounts.test.tsx`
  covers its counts.
- **`app/src/screens/FirstRun.tsx`** — the empty-catalogue screen: "an empty
  app should say what to do next". Routes out: upload a syllabus, switch on the
  sample, or — when there is no AI key — add a course by hand.
  `screens/firstrun.test.ts` covers it.
- **The guidebook** — the `help` screen (`screens/Help.tsx`).

Deferred until needed, as the brief asks: connecting calendars (Connect),
adding courses (Import / FirstRun), accessibility preferences (Settings →
Look, or the Accessibility workspace mode), and sign-in.

## About this screen

The brief's "Explain this screen", and WCAG 2.2 SC 3.2.6 Consistent Help: the
same help, in the same relative place, on every screen.

`ScreenGuide` in `app/src/components/unity/ScreenGuide.tsx`, with its words
from `app/src/lib/explain.ts`.

- **Placement.** `components/shell/ShellBody.tsx`, which every screen passes
  through, renders it as the last thing in the screen's content — on every
  screen, including the full-bleed ones (below). Because it is rendered there
  and not by each screen, it cannot be forgotten on one.
- **Shape.** An `<aside>` named "About this screen" holding a button. On a
  screen that scrolls, the button has `aria-expanded` and `aria-controls` and
  opens the answers in place — progressive disclosure, not a dialog, so it
  never covers what it explains and never moves focus unexpectedly. On a
  screen that fills its box, the button has `aria-haspopup="dialog"` and opens
  the same answers in a sheet (below).
- **Content.** A description list of four answers:
  *What is this? · Why does it matter? · Where does this information come
  from? · What can I do next?* — then "Open the guidebook", except on the
  guidebook itself.
- **Words.** `explain(screen)` returns hand-written answers for the screens
  students land on most (`home`, `courses`, `course`, `item`, `calendar`,
  `study`, `guide`, `me`, `pathway`, and others in `WRITTEN`). Every other
  screen gets an answer built from the navigation registry's one-line blurb —
  the sentence the directory already shows — so no screen is left without
  one. `lib/unity.test.ts` checks every screen in the `Screen` union (more than
  fifty) has all four answers over ten characters.

### On full-bleed screens

Screens in `EXEMPT` (`components/shell/exempt.ts`) draw their body full-bleed
rather than as an inset column: `guide`, `lesson`, `slides`, `update`, `brief`,
`essay`, `work`, `solve`, `analyse`, `ask`, `mail`, `proof`, `classmates`,
`calendar`, `drill`, `quiz`, `guess`, `maps`, `draw`. All nineteen get About
this screen, in one of two ways:

| Kind | Screens | How |
| --- | --- | --- |
| Scrolls | The sixteen not in `FILLS` | `ShellBody` renders `<FullBleed>` then `<ScreenGuide screen={screen} />`: the guide sits after the content and opens in place, exactly as on an ordinary screen |
| Fills its box | `FILLS` = `ask`, `classmates`, `mail` | `ShellBody` wraps both in `.fill-with-guide`, a flex column (`styles/unity.css`) in which the screen takes `flex: 1 1 0` and the guide keeps one compact line (`.screen-guide.is-compact`). The guide is `<ScreenGuide sheet />`: pressing it calls `showExplain(screen)` (`lib/unity.ts`) and `UnityLayer` opens a sheet named "About this screen" showing the same `Answers` |

The sheet exists because opening the answers in place on a chat or a mailbox
would grow the page and push the pinned composer off the bottom edge. It is
still the last thing on the screen and still the same four answers (both
paths render the one `Answers` component), so the help is the same help in
the same relative order that 3.2.6 asks for. The sheet is modal, traps focus
and returns it, like the other shared sheets.

`components/unity/unity.test.tsx` → "About this screen on the full-bleed
screens" holds that it is drawn on every one of them, last, in the same words;
that it opens in place on a screen that scrolls; and that it opens as a sheet
on a screen that fills its box, so the composer stays put.

## Where help lives, in order of reach

| Need | Where |
| --- | --- |
| "What is this screen?" | About this screen (above) |
| "Why am I seeing this suggestion?" | Today's `<details>` disclosures |
| "Where did this come from?" | Source & details |
| "How do I do X?" | The guidebook (`help`) |
| "What keys are there?" | The keyboard sheet (`components/Keys.tsx`), including ⌘K / Ctrl+K |
