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

The spec asks for five window classes. Semester has three tiers plus a stepped
large-monitor measure, decided in one place (`app/src/lib/media.ts`) and
repeated in `styles/app.css`, with `tiers.test.ts` checking the two agree:

| Semester tier | Width | What it draws |
| --- | --- | --- |
| phone | < 760px, **or** any window under 600px tall with a coarse pointer (a phone on its side) | One column, tab bar at the foot, sheets and full-screen detail |
| tablet | 760–1179px | Rail beside the column; touch sizes kept; reading measure capped at 760px |
| desktop | ≥ 1180px | Wide rail, 880px measure, 1240px canvas for grids |
| (desktop, large monitor) | ≥ 1600px | Same layout, measure 960px, canvas 1440px, rail 272px |

The workspace navigation (`nav: 'desk'`) is a fourth frame drawn at every
width, with a tab strip at the top and a sidebar that appears where there is
room. `lib/chrome.ts` guarantees that no two navigations are drawn at once.

### How that maps onto the spec's five classes

| Spec class | Width | Semester today |
| --- | --- | --- |
| compact | < 600 | phone |
| medium | 600–839 | phone below 760, tablet from 760 |
| expanded | 840–1199 | tablet below 1180, desktop from 1180 |
| large | 1200–1599 | desktop |
| extra_large | ≥ 1600 | desktop with the large-monitor measure |

**A decision for the product owner, not taken in this change:** the spec's
600/840/1200 boundaries do not match Semester's 760/1180. The existing figures
come from measurements recorded in `lib/media.ts`. 760 is the narrowest iPad
held upright (the 9.7-inch at 768), so every portrait iPad gets the rail.
1180 is where a laptop browser window fits the rail, a full reading measure and
a second column. Moving to 600/840 would put the rail on an iPad mini
held upright (744) and on phone-sized Split View panes. That can be done, but it
is a change to `media.ts`, `app.css` and `tiers.test.ts` together, and it
should be decided on with screenshots at those widths rather than slipped in
with documentation.

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
  record edited on two devices before either synced is put to the student
  to choose. Adding the states also uncovered that on IndexedDB an edit never
  triggered a push; that is fixed too. See
  [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md).
- **Return context after sign-in: done** for sign-ins that leave the page
  (Google, Microsoft, Apple, institutional SSO). Email confirmation and
  password reset links are not covered. See
  [CROSS-DEVICE-CONTINUITY.md](CROSS-DEVICE-CONTINUITY.md).
- **Layout preferences sync across devices.** `nav`, `shell` and `mailPane` use
  the incoming value, so choosing a navigation on a laptop changes it on the
  phone. `chromeFor` still draws a usable navigation at every width, so this
  does not break the other device. It does go against the spec's "do not store
  a device-specific layout preference in a way that affects another device".
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
