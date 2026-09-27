# Adaptive device experience

**The rule:** a student can do the same things on a phone, a tablet or a
computer. The width of the window changes *how* a thing is reached — where the
navigation sits, how many panes are visible, how dense the rows are — and never
*whether* it can be reached.

This document records how Semester implements that today, where it departs
from the five-class spec in the "Adaptive Device Experience" command, and what
is still open. It describes the code on `main` as of 27 September 2026 plus the
change that introduced it. The companion documents:

| Document | Covers |
| --- | --- |
| [CAPABILITY-PARITY-MATRIX.md](CAPABILITY-PARITY-MATRIX.md) | Every width check in the app and what the narrow window gets instead |
| [RESPONSIVE-COMPONENT-SPEC.md](RESPONSIVE-COMPONENT-SPEC.md) | The shell, the navigations, and the design tokens that move with width |
| [MASTER-DETAIL-PATTERNS.md](MASTER-DETAIL-PATTERNS.md) | List/detail at each width, screen by screen |
| [DEVICE-INPUT-MODE-SPEC.md](DEVICE-INPUT-MODE-SPEC.md) | Touch, pointer, keyboard, and what each is allowed to gate |
| [FOLDABLE-AND-RESIZABLE-WINDOWS.md](FOLDABLE-AND-RESIZABLE-WINDOWS.md) | Rotation, Split View, a window dragged narrow |
| [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md) | Sync, merge, status and the gaps in it |
| [RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md](RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md) | What is tested automatically, and what has to be checked by hand |

## What stays the same at every width

There is no device branch in the data or permission layers. The store
(`app/src/state/store.tsx`), the capability and role checks
(`lib/role.ts`, `lib/rollout-capabilities.ts`) and the Supabase row
policies take no width input, so one account sees the same courses,
deadlines, drafts, sources and permissions on every device. Width is read only
by presentation code, and [every place that reads it](CAPABILITY-PARITY-MATRIX.md)
is listed in `app/src/widthgate.test.ts`.

## The layouts as built

The layouts follow the spec's five window classes, decided in one place
(`app/src/lib/media.ts`, `windowClassFor`) and repeated in `styles/app.css`,
with `tiers.test.ts` checking the two agree:

| Window class | Width | Semester tier | What it draws |
| --- | --- | --- | --- |
| compact | < 600px | phone | Tab bar at the foot; in a desktop window, the 402px column the app was drawn at; full width on a touch device |
| medium | 600–839px | phone | The rail collapsed to icons (72px) in the tab bar's place, opening out over the content with labels and the quieter rows; standalone column 560px, 20px gutters |
| expanded | 840–1199px | tablet | Rail beside the column; touch sizes kept; reading measure capped at 760px |
| large | 1200–1599px | desktop | Wide rail, 880px measure, 1240px canvas for grids |
| extra-large | ≥ 1600px | desktop | Same layout, measure 960px, canvas 1440px, rail 272px |

A phone on its side — any window under 600px tall with a coarse pointer — is
the phone tier at any width (`HANDHELD`).

The workspace navigation (`nav: 'desk'`) is a fourth frame drawn at every
width, with a tab strip at the top and a sidebar that appears where there is
room. `lib/chrome.ts` guarantees that no two navigations are drawn at once.

### The move from 760/1180

Until this change the boundaries were 760 and 1180, measured against
devices: 760 was the narrowest iPad held upright, so every portrait iPad got
the rail. The spec asks for the window, not the device, and the product
decision was to adopt its classes. What moved:

- **An iPad held upright (744–834px) is medium**: the rail collapsed to its
  icons, opening out on demand. On its side (1024–1194px) it is expanded and
  has the full rail.
- **A 13-inch iPad in landscape (1194px) is now the tablet layout**, not the
  desktop one; the desktop layout starts at 1200.
- **A desktop window between 600 and 839px** now draws the collapsed rail,
  rather than a 402px phone column with a tab bar (below 760) or the full
  rail (760–839).
- Nothing changed below 600px or at 1200px and up.

The same argument covers the **height** rule. The spec says to use width and
not device labels. Semester uses width, plus one exception: a window under
600px tall with a finger on it. Width alone put a phone lying on its side into
the tablet layout, with a ten-row rail in 430px of height. That exception asks
about the window and its input, not the device model, so it stays within the
spirit of the spec.

## What this change fixed

The audit read every file that reads the window width (fourteen of them) and
asked of each: does the narrow window lose anything? Two did:

1. **Mail paging.** The list is fifty conversations a page at every width, but
   the Newer/Older arrows were drawn only in the wide toolbar. On a phone the
   fifty-first conversation in a folder could be searched for but not browsed
   to. The pager now also appears as a row under the phone toolbar whenever
   there is a second page. Guarded by `screens/mailpaging.test.tsx`, which
   was checked by turning the fix off and watching the test fail.
2. **Keyboard shortcuts.** `Keys` listened only on a wide window, and the
   phone frame did not mount it at all. So a laptop browser dragged to 640px,
   or an iPad in Split View with a Magic Keyboard, had no `?`, `/`, `n` or
   `Esc`. It now listens wherever the window is wide *or* any pointer is fine
   (`FINE` in `lib/media.ts`), and it is mounted in the phone frame. A phone
   still answers no to both. Guarded by `components/keysnarrow.test.tsx`,
   again checked red without the fix.

And one structural guard so the next one is caught when it is written:
`src/widthgate.test.ts` fails for any file that reads `WIDE`, `DESKTOP`,
`HANDHELD` or `useTier()` without a row saying what the narrow window gets
instead.

## What is still open

These are listed so that they are not mistaken for done. Each is larger than
this change.

- **Cross-device conflicts: partly fixed.** A push is now a compare-and-swap
  on each row's `updated_at`, so it cannot overwrite a copy it has not read;
  it pulls, merges and retries instead. One record edited on both devices
  still keeps the later edit. See [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md).
- **Offline, Queued, Conflict and Conflict-needs-review states: done.** A
  record, setting or ticked box edited on two devices before either synced
  is put to the student to choose. Adding the states also uncovered that on IndexedDB an edit never
  triggered a push; that is fixed too. See
  [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md).
- **Return context after sign-in: done** for sign-ins that leave the page
  (Google, Microsoft, Apple, institutional SSO). Email confirmation and
  password reset links are not covered. See
  [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md).
- **Layout preferences: per device.** `nav`, `shell`, `mailPane`, `tabs`
  and `directory` no longer follow the last device to change them; each
  device keeps its own. Arrangements and taste still sync. See
  [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md).
- **The spec's institutional consoles** (tenant admin, integrations,
  moderation, analytics, support) are in the institutional preview, which this
  audit did not cover.
- **Named workspaces that do not exist as screens.** There is no Code Studio or
  Research Studio screen yet. The matrix marks them as absent rather than
  inventing a layout for them.

## Delivery

The spec asks for five feature branches with a draft PR each. This session was
limited to a single development branch, so the work is one draft PR. The
remaining phases in the "still open" list are each sized to be a branch of its
own.
