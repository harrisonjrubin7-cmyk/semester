# Do not build

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The anti-patterns that may not enter Semester, whoever asks and however small
the feature. Each rule says **how it is held**: by a test that fails the build,
or by review against this page. A rule held only by review is a rule somebody
talks themselves out of on a Friday, so the ones that can be mechanical are.

Changing a rule is allowed. It is a decision, made in a pull request that edits
this page and says why — not a side effect of a feature that needed the
exception. `app/src/donotbuild.test.ts` reads this file, so the enforced rules
cannot be relaxed in code without the page changing in the same diff.

| # | Rule | Held by |
|---|---|---|
| 1 | **No new top-level navigation item without portfolio approval.** The roots are listed below; the test compares them with `ROOTS` in `state/shape.ts`. | `donotbuild.test.ts` |
| 2 | **No custom button, card, modal, tab system or colour palette.** Use `components/ui.tsx`, `useModal`, `ExplanationSheet`'s sheet/drawer shell, `Segmented`, and the tokens in `lib/look.ts`. | `npm run lint` style audit (`styles/rules.ts`), `lib/contrast.test.ts`, review |
| 3 | **No unexplained score, risk label or recommendation.** Anything ranked or suggested carries its reason, its inputs and its limits — the `Action.explanation` shape in `lib/actions.ts`, shown by `ExplanationSheet`. | `lib/actions.test.ts`, review |
| 4 | **No notification without an owner, a preference, a frequency cap and a way out.** Every rule has a Settings switch (`NOTIF_DEFS`), a tier (`TIER` in `lib/notify.ts`), is capped per tier (`IMPORTANT_CAP`, `HELPFUL_CAP`) unless critical, and says why it was sent. Only the allow-listed files may create a notification. | `donotbuild.test.ts`, `lib/notify.test.ts` |
| 5 | **No asking for information the app already has in the current context.** A screen opened from a course arrives with that course; a help request opened from a deadline arrives with that deadline. (WCAG 2.2 SC 3.3.7, Redundant Entry.) | Review |
| 6 | **No help or support that lives only in one unique place.** Help is reached from the same place on every screen. (WCAG 2.2 SC 3.2.6, Consistent Help.) | Review |
| 7 | **No AI output presented as official institutional information.** Only facts confirmed by the school's own system carry the `institution_verified` source label from `lib/source.ts`; nothing the assistant writes may. | `lib/source.test.ts`, review |
| 8 | **No feature ships without its loading, empty, error, permission and narrow-screen states.** | `screens/deadends.test.tsx` (a screen opened cold always has a way on), review |
| 9 | **No copy that bypasses content standards and terminology.** | `npm run lint` label audit, review |
| 10 | **No student data used for advertising or sponsorship targeting.** No ad or tracking SDK is loaded, and sponsorship is a separate opt-in that reads nothing about the student. | `donotbuild.test.ts` (no ad/tracking hosts in the source), review |
| 11 | **No irreversible action without confirmation, and no removal without undo or a restore path.** (WCAG 2.2 SC 3.3.4, Error Prevention.) Use `TypeToConfirm` for the consequential, `Undone` for the reversible. | Review |
| 12 | **No "Continue" card for work that is not actually unfinished.** `lib/opened.ts` drops finished deadlines; anything similar must too. | `lib/opened.test.ts` |
| 13 | **No Core module without row-level security tests, an immutable history and a kill switch.** A module the site calls anything above *planned* has its tables in `supabase/migrations`, a `supabase/<module>.check.sql` suite with positive and negative cases, a history row for every consequential change, and a flag in `lib/flags.ts` (D-151). | `site/modules.test.ts`, review |

## The top-level navigation

Rule 1 compares this list, in this order, with `ROOTS`:

```roots
home, courses, study, calendar, support, mine, me
```

`support` was added by #848 (one workspace: navigation areas), which merged
while this page was in review — the first change this rule caught.

## Who may create a notification

Rule 4 allows `new Notification(` and `showNotification(` only in these files:

```notifiers
src/lib/notify.ts
src/components/Ringing.tsx
public/sw.js
```

- `lib/notify.ts` is the reminder engine: tiers, the cap, and the "why" line.
- `components/Ringing.tsx` rings an alarm or timer the student set themselves,
  at the moment they asked for it. That is their own alarm clock, not the app
  deciding to interrupt, so it is outside the cap.
- `public/sw.js` displays a push that `lib/notify.ts#planAhead` already
  planned, capped and explained on the device.

## Why these and not more

The list in the continuity brief this page came from had ten rules; 11 and 12
were added because the same brief asks for them elsewhere (undo and receipts,
"Continue" only for real work), and a rule stated in one document and missing
from this one is a rule that is not held. See
[EXPERIENCE-CONTINUITY.md](EXPERIENCE-CONTINUITY.md) for where each of the
brief's sixteen items stands.
