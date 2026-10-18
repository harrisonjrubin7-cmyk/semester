# Interaction standards

How Semester *behaves* the same way everywhere: which layout a screen uses,
how an object looks wherever it appears, how flows start and end, how status
is shown, how things move and sound, and where preferences live.

The visual foundations — tokens, grounds, spacing, type — are
`app/src/lib/look.ts` and are described in
[../DESIGN-SYSTEM-IMPROVEMENTS.md](../DESIGN-SYSTEM-IMPROVEMENTS.md) §1–2. This
document does not restate or change them. Where the brief this came from
proposed values that differ from what the app has (a 4/8/12/16/24/32/48/64
spacing scale, `prefers-color-scheme` theming), **the app's existing,
tested system wins**: spacing is `--sp-1…7` × the student's density setting,
and dark or light is chosen by ground, never by media query.

Word choices are in [SEMESTER-CONTENT-STANDARDS.md](SEMESTER-CONTENT-STANDARDS.md).

---

## 1. Screen families

Every screen belongs to one family, and a new screen picks one before it is
built. A registration flow and a tutoring booking differ in content, not in
anatomy.

| Family | Used for | Required order | Frame | Today in the app |
|---|---|---|---|---|
| **Dashboard** | Today, course overview, advisor overview | summary → priority actions → timeline → supporting insight | `<Page>` | Today, Launchpad, Hub |
| **List** | Courses, assignments, services, events, people | title → search/filter → rows → empty state | `<Page>` (its search box is the filter) | Courses, Mine, People, Directory, Opportunities, Applying |
| **Detail** | Assignment, course, event, service, person | title → key facts + source → primary action → sections → history | `<Page>` | EditCourse, Guide |
| **Planner** | Calendar, registration, degree plan | title → time/control bar → workspace → conflicts | `<Page wide>` | Calendar, Pathway, Degree, Registrar |
| **Focus** | Study, writing, reading, drilling | minimal header → canvas → contextual tools → finish/exit | **no `<Page>`**, by design | Drill, Gap, Slides, Essay, Write, Exam |
| **Transaction** | Booking, registration request, application | progress → summary → form → review → receipt | `<Page>` | Respond (a form answered outside the app); the Sprint 1 registration request |
| **Settings** | Profile, notifications, privacy, accessibility | grouped categories → rows → save state | `<SettingsPage>` | `screens/settings/*`, Privacy, Account, Profile |
| **Admin** | Integrations, analytics, governance | title → status/metrics → tables → audit history | `<Page>` | `components/institutional/*` (ControlPlane, OperationsStudio, IntegrationDashboard) |
| **Support** | Help, troubleshooting, referral | problem → recommended action → alternatives → contact | `<Page>` | Support, Help |
| **First use** | New user, new module, no data | explanation → value → one starter action → learn more | outside the shell | Onboarding, FirstRun |

Focus screens skip `<Page>` deliberately, and each says why in a comment
beginning "No `<Page>` here, deliberately" — Drill, Field, Gap, Slides,
Springboard, Onboarding. That comment is the required form for an exception.
Screens that skip it *without* one are **DD-004**.

`npm run census:design` reports how many screens use a frame.

## 2. Object contracts

The same kind of thing looks and behaves the same on every screen it appears
on. For each core object — **Action, Course, Assignment, Service, Event,
Person, Place, Source, Plan** — its contract answers:

| Field | Meaning |
|---|---|
| Display name | The canonical noun (content standards §2). |
| Icon | One icon, from `components/Icons.tsx`, never redrawn per screen. |
| Status | From the hierarchy in §4. |
| Source + freshness | A `SourceBadge` when the object could be mistaken for official. |
| Owner | Who can change it: the student, an instructor, the institution. |
| Primary action | One. |
| Secondary actions | In an overflow, same order everywhere. |
| Detail route | Where tapping it goes. |
| Preview | What a long-press/hover shows, if anything. |
| Accessible name | What a screen reader says for the row. |
| Analytics | `object_verb` event names (content standards §8). |
| Empty / error / unavailable | What shows when it cannot load. |

### Example: a service

Wherever a service appears — Today, Help, a course, an AI answer, the Campus
directory — it shows, in this order:

1. Service name
2. Who it is for
3. What it helps with
4. Availability
5. Location or format
6. Source (`SourceBadge`)
7. Primary action: *Book an appointment*, *Contact*, or *Learn more*
8. An alternative path

The first object to be written up in full is the **Action**, because the
Action Center already unifies it (`components/TodayActionCenter.tsx`,
`docs/TODAY-ACTION-CENTER.md`). The others are **DD-005**.

## 3. Flow patterns

A student should recognise the start, middle and end of any flow.

**Create / edit.** Open → say what it is for → sensible defaults → validate
inline → save *either* automatically *or* explicitly, never both without
saying so → confirm (`Said`) → offer Undo (`Undone`) when reversible.

**Important or official action.** Say what will happen → review the details →
confirm (`TypeToConfirm` if irreversible) → send → show a receipt or status →
link the history and a support route. The institutional control plane already
refuses to show "applied" without a gateway receipt; that is the model.

**Leaving Semester (external handoff).** Name the destination → say why the
student is leaving → say what, if anything, is shared → say whether the
destination is official → open it → keep the way back. Label: *Open official
[system]*.

**AI-assisted action.** Say AI is involved → show the sources or context →
state limits where they matter → allow edit or reject → route important
decisions to an official source or a person.

**Recovery.** What happened → what still works → a recovery action → an
alternative path → a support route. No flow ends at a generic error.

## 4. Status hierarchy

One ladder, one treatment per rung. Colour is never the only signal
(`a11y/tellings.test.ts`); every rung has a word.

| Rung | Examples | Treatment today | Token |
|---|---|---|---|
| Success | Completed, saved, confirmed, synced | text + `--app-passing` | `--app-passing` |
| Information | Official, AI-assisted, external, new | `SourceBadge`, neutral line | `--app-line`, `--app-dim` |
| Attention | Due soon, needs review, waiting | word + accent | `--app-accent` |
| Warning | Possible conflict, stale data, needs confirmation | word + warn wash | `--app-warn`, `-warn-line`, `-warn-wash` |
| Error | Failed, source unavailable, permission needed | word + warn wash | *(shares warning — DD-006)* |
| Critical | Immediate deadline, account/security, official action blocked | word + warn wash + placement | *(shares warning — DD-006)* |

Error and critical have no token of their own. Adding one means a
`lib/contrast.test.ts` row across all thirteen grounds, measured against
every surface it sits on (see `CLAUDE.md` §Contrast) — which is why it is
logged as debt rather than guessed at here.

**Where status goes:**

| Scope | Component |
|---|---|
| App-wide (offline, new version, incident) | a banner — `Fresh`, the connection line |
| One action or section | inline — `Notice`, `Trouble` |
| A short confirmation | `Said` (announced, not shown as a toast) |
| A reversible result | `Undone` — 8 seconds, polite, never takes focus |
| Non-urgent updates | Notices |

A toast never carries an error or an irreversible result.

## 5. States

Every screen and reusable flow handles these, with the component that draws
them:

| State | Must say | Must offer | Component |
|---|---|---|---|
| Loading | what is loading | unrelated content stays usable | skeleton, as `App.tsx` `Loading()` |
| Empty | what is absent, why | one next step | `EmptyState` with `action` |
| No results | what was searched | clear filters | `EmptyState inline` |
| Error | what failed, what still works | retry, alternative, help | `Trouble`, `Notice`, `ScreenTrouble` |
| Validation | the field and the fix | focus moves to the field | inline, labelled field |
| Permission | what is restricted, who controls it | request access | `Notice` |
| Integration unavailable | which source, last good time | retry, open official system | `SourceBadge` + `Notice` |
| Offline | connection status, what is local | retry later | connection line |
| Stale | last update, source | refresh, open source | `SourceBadge` freshness |
| Disabled | why, and what enables it | — | visible reason, not only greyed out |
| Success / pending | what completed or is waiting | view result, undo, cancel | `Said`, `Undone` |
| Unsaved changes | what would be lost | save / discard / cancel | — |
| Destructive confirm | consequence and scope | cancel / do it | `TypeToConfirm` |
| AI processing / unavailable | AI label; the manual alternative | stop; do it by hand | `Disclosure` |
| External handoff | destination, reason, what is shared | open / cancel | §3 |
| First use | value, one starter action | begin | `EmptyState`, Onboarding |

The brief's proposed single `SystemState` component is not built: `EmptyState`,
`Notice` and `Trouble` already cover these and are used in 25+ files.
Consolidating them is only worth doing if a screen needs a state none of them
draws; until then a fourth component is a fork.

## 6. Motion, sound and haptics

**Motion**

- One easing curve: `--ease`.
- Standard transitions 150–200 ms; drawers and large panels 200–250 ms.
- Motion only shows cause and effect, hierarchy, or a change of place. Never
  decorate critical information.
- Reduced motion is **a setting and a media query**: honour both
  `prefers-reduced-motion` and `data-calm` (`a11y/motion.test.ts`,
  `a11y/calm.test.ts`).
- Nothing waits on an animation to finish.
- There are no duration tokens yet; durations are literals in `app.css`
  (90 ms to 1.6 s). **DD-007.**

**Sound and haptics**

- No sound for ordinary interactions.
- Sound only for things the student started: timers and alarms
  (`lib/chime.ts` via `Ringing` and Clocks), and media they pressed play on
  (`components/Sound.tsx`).
- Nothing plays automatically — the browser's autoplay rule is treated as
  policy, not an obstacle (`chime.ts`).
- Every audio cue has a visual and a screen-reader equivalent: the alarm
  overlay *is* the alarm; the chime is the nudge.
- No haptics today. If they are added, they are a student setting, off in
  shared-device mode.

## 7. Preferences

One home: **Settings** (`screens/settings/Index.tsx`), which already groups
look, navigation, alerts, the assistant, courses, grading and workload, and
links out to Profile, Privacy and data, and Account.

- A feature's own settings link back to the Settings row they belong to and
  use the same row primitives (`ItemRow`, `NavRow`, `SelectRow` in
  `components/shell/Rows.tsx`).
- Never personalise an institutional fact. A deadline is a deadline whatever
  the student's layout.
- Say why a recommendation is shown, and let the student dismiss, mute or
  adjust it.
- Keep student preferences and institutional policy separate, and say when a
  policy overrides a preference ("Available modes are set by your university's
  policy").
- Every change is reversible.
