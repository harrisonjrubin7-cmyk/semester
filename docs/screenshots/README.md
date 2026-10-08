# Screen inventory: every screen, every role

Captured from the running app (Vite dev server, headless Chromium) on
5 Oct 2026 against `origin/main` at a044181.

**Setup:** phone viewport 420×900, tab-bar navigation, Soft shell, Vanderbilt
University, bundled sample data (4 courses), no account service, no AI key.
Every capture ran with `pageerror` at zero.

## What is here

| Folder | What it holds |
|---|---|
| `00-first-run-onboarding/` | A fresh profile: the 5-step adoption carousel (`step-01`…`step-08-end`), where it lands, and the `#/onboarding` screen |
| `contact-sheets/<role>-0N.jpg` | **Start here.** Every screen for a role, labelled, 24 per sheet, 4 sheets per role |
| `role-<role>/<screen>.jpg` | The full-size capture of each screen for that role (86 per role, 10 roles) |
| `role-<role>/_log.txt` | The address visited for each screen |
| `full-length/<role>/` | Taller captures (420×3000) of `home`, `university`, `settings`, `me`, `profile`, `directory`, so nothing is below the fold |

Roles (from `lib/role.ts`): `student`, `faculty` (Teaching),
`teaching_assistant`, `advisor` (Advising), `admin` (Administration),
`staff` (Campus services), `applicant`, `payer` (Parent or payer),
`family` (Authorized family), `alumni`.

## First finding: the nine non-student roles are nearly the same app

I pixel-diffed every screen of every role against the student's. All nine
other roles differ from the student on **the same 13 screens, and are
identical to each other**.

- **What a non-student role changes:** the *My path* tab leaves the tab bar,
  and the student-journey screens (`yes`, `degree`, `costs`, `housing`,
  `meals`, `activities`, `applying`, `behind`, `classmates`, `groupwork`,
  `launchpad`, `runway`) fall back to **Today**.
- **What it does not change:** no role has a screen, home or workspace of its
  own in this build. A faculty member, an advisor, a payer and an alumnus all
  get the same Today, the same University page (37 areas, all "Prepare only"),
  the same Settings.
- **The one place a role is visible** is the "Prepare drafts as" dropdown on
  `university` (`full-length/<role>/university.jpg`). The role workspaces in
  `components/institutional/role-workspace.ts` only appear when the gateway
  returns a verified grant, and this build has none, so none can be shown.

So the faculty, advisor, admin, staff, payer, family and alumni experiences
cannot be reviewed visually until either grants are available in a preview or
each role gets a local landing screen. That is the largest gap.

## What needs work (from the student sheets)

1. **The header block repeats on ~50 screens.** The stat box (a big number
   plus "No X yet") and the Due today / This week / Overdue strip sit above
   the content on almost every screen, often using 35–40% of the phone
   viewport before the screen's own content starts (`career`, `athletics`,
   `costs`, `housing`, `nil`, `family`, `opportunities`, `mine`).
2. **"Overdue 22" appears on every screen**, including `housing`, `nil` and
   `family`, where it has nothing to do with the task. It comes from the
   sample data but reads as the app's own alarm.
3. **The floating assistant button covers content** at bottom right on
   nearly every screen: it sits over "More options" on `home`, the action
   column on `athletics`, `clocks`, `career` and `opportunities`.
4. **Dead-end screens.** Fifteen screens end in "isn't switched on in this
   build" or "needs the account service": `classmates`, `console`,
   `moderation`, `volunteer`, `volunteers`, `agreements`, `groupwork`,
   `community` (partly), `gradebook`, `registration`, `dining`, `mail`,
   `account`, `solve` and `draw` (both ask for an AI key). They are
   reachable by address and by the directory, and each is a screen of
   explanation with no action.
5. **Empty is the default look.** Because the sample term has no personal
   data, most screens show a 0 and a "nothing yet" line. Screens such as
   `deck`, `sheet`, `write`, `essay`, `equations` and `exam` need seeded
   content before they can be judged, and I have not yet captured them
   populated.
6. **Screens that need an id** (`item`, `event`, `note`, `guide`, `drill`,
   `quiz`, `lesson`, `slides`, `edit`) were captured against the first
   sample course only. `note` shows "That note is gone" because no note
   exists.
7. **Dense tab and chip rows are clipped** at 420px: `career`
   (Discover/Fairs/Résumé/Contacts/Abroad/Library), `support`,
   `registrar`, `exam`, `launchpad`, `pathway`.
8. **Unlabelled breadcrumb inconsistency.** `agreements`, `console`,
   `moderation`, `volunteer(s)` show a short breadcrumb and no stat strip,
   unlike every neighbour.

## Not covered

- Other layouts: 17 further shell × navigation pairings
  (`shelves`, `springboard`, `workspace`, `feed`, `guides`) and the desktop
  rail. Only tabs + Soft is here.
- Populated states, dark/light and accent variants, and any screen that is
  a sub-state (a quiz in progress, a modal, an open folder).
- A signed-in state. There is no account service in this build.
- Screens behind a school capability other than Vanderbilt's.
