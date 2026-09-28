# Campus Office Action Feed: Phase J

**Flag:** `office_action_feed` (`VITE_OFFICE_ACTION_FEED`). Off by default
(D-012). With it off, Today and Key dates are unchanged; a test holds both.

**Destinations:**

- **Today.**
  - With the Action Center on, office actions are ranked in it with
    everything else.
  - Otherwise the first three show in a card above the briefing.
- **Key dates** (`registrar`). The full feed, what applies to me, and the
  office desk for accounts that may publish.

**Migration:** `supabase/migrations/20260928302000_office_action_feed.sql`
(D-048). It needs the owner's approval before any merge to `main`.

**Builds on:**

- `institution_actions` and the office roles and capabilities from
  `20260926150000_expansion_roles_and_features.sql`.
- BL-1.4's Action Center (`lib/actions.ts`, `components/ActionCenter.tsx`).
- `ConfirmDialog` and `SourceBadge`.

## What a student sees

> **Financial Aid**
> **FAFSA verification documents are due October 15**
> Due Thu, Oct 15
> This may affect aid processing.
> `Institution verified` Updated today
> ▸ Why am I seeing this? — *Financial Aid sent this to every student at your school. Source: Financial Aid verification checklist*
> [Open official page] [Mark done…]

| Command asks for | How |
|---|---|
| InstitutionAction entity | `institution_actions`, finished. `readOfficeAction` is the client adaptor, and refuses any row without an office, an https link, a source or an update time |
| Scope by tenant, cohort, office, program or student-selected eligibility | The audience is the whole school, a cohort (by role grant), a program, or an eligibility. Program and eligibility are the student's own choice, under **What applies to me**. "Office" is the publisher's scope; the student sees which office sent each one |
| Publisher roles restricted to their scoped content | `private.may_publish` asks for a role that is **one of that office's** and carries the capability **over exactly that scope**. A registrar cannot publish as Financial Aid; an officer at one school cannot publish at another; a resident assistant publishes resources and events only |
| Source, date, office, official link required | Required three times: by a check constraint, by `draft_office_action`, and by the client reader |
| Student Action Center conversion | `officeActionToAction` has a stable id (`office:<id>`), "Institution verified" with the office and source, a priority from the type and date only, and an explanation sheet. The official page opens only after a confirmation. It expires a day after its date |
| Privacy-safe aggregate completion only, n ≥ 10 | **Mark done…** writes a row only the student can read. `office_desk_actions` returns a count, or null below ten |
| No unrestricted visibility | No office policy on the audience or progress tables. `officeactions.check.sql` reads both as each office account and gets nothing |
| Moderation/publish workflow scaffold | Draft → submit → approve or return with a note → published → withdrawn. Approval must come from a colleague with the same office and scope; nobody approves their own |

## Related: Notices (#818)

#818 added a Notices inbox, `lib/comms.ts`. Its **Official** channel says
it is not connected, and shows no examples.

This feed is the published, scoped, source-labelled office data that
channel was waiting for. Connecting the two is follow-up work, not part of
this PR: map a `my_office_actions` row to a `comms` message on the
`official` channel. Priority `required` would apply only to an office's own
hold or compliance action, which `admit` already reserves for official
channels.

## What it never does

- **Guess who a student is.** No eligibility or program is inferred. The list
  has nothing about health or disability (D-050).
- **Show an incomplete action as official.** A row without an office, an
  https link, a source or an update time is not shown. Neither is one
  saying "at risk", "failing" or "behind".
- **Tell an office anything about a student.** An office sees a count at ten
  or more, and nothing else.
- **Report the Action Center's Done.** That stays on the device (D-049).
- **Open a link unconfirmed.** The feed uses `ConfirmDialog`, with the
  address shown and focus on Cancel. The Action Center's own hand-off
  confirms through BL-1.4's `window.confirm`.
- **Publish in one step.** A draft reaches no student.

## Data

| Table | Who reads | Who writes |
|---|---|---|
| `institution_actions` | A student reads published rows that reach them; an office reads rows in its own scope | Only through `draft_office_action` and `move_office_action` |
| `institution_action_offices` | Anyone signed in | Migrations |
| `institution_action_audiences` | The student only | The student only, from the fixed list |
| `institution_action_progress` | The student only | The student only, and only for an action that reaches them |

- **Functions:**
  - `my_office_actions` (the feed);
  - `office_action_programs`;
  - `my_action_publish_scopes`;
  - `draft_office_action`;
  - `move_office_action`;
  - `office_desk_actions`, whose count is null below ten.
- **Account deletion.** The student's two tables are in `OWNED_TABLES`, and
  in `NOT_CONTENT` for `lti_account_untouched`, with the reason. They are in
  `RETENTION.md`.

## Files

| New | Purpose |
|---|---|
| `supabase/migrations/20260928302000_office_action_feed.sql` | The above |
| `supabase/officeactions.check.sql` | 79 checks, each refusal tried as the account refused |
| `lib/office-actions.ts` | Reader, `whyYouSee`, `officeActionToAction`, `completionLine`, `deskSteps`, `draftProblems` |
| `lib/office-actions-remote.ts` | The calls |
| `lib/office-actions.hook.ts` | `useOfficeActions`: off, signed-out, loading, error and ready |
| `components/OfficeActionFeed.tsx` | The full feed and what applies to me |
| `components/OfficeActionsToday.tsx` | The first three on the briefing Today |
| `components/OfficeActionDesk.tsx` | The office desk |

| Changed | Change |
|---|---|
| `supabase/expansion.check.sql` | Its institution-action section now goes through the workflow; the direct insert is refused |
| `components/TodayDecisionSurface.tsx` | `officeActions` prop (default: the flag) |
| `components/TodayActionCenter.tsx` | Office actions join the ranked list |
| `screens/Registrar.tsx` | `officeActions` prop; the feed and the desk, lazy-loaded |
| `lib/cloud.ts`, `lib/ltiaccount.test.ts`, `RETENTION.md` | The two student tables |
| `styles/app.css` | `.office-*` |

## Tests

| File | Covers |
|---|---|
| `supabase/officeactions.check.sql` | **Publishing:** who may publish as which office; what a draft must carry; no direct writes. **Workflow:** draft to review to published by two people; return with a note. **Reach:** school, eligibility, program and cohort, and their negatives; choices only from the list, and only for oneself. **Offices:** read no choices and no marks. **Counts:** null at nine, ten at ten, hidden again when a mark is taken back. **Also:** withdrawal; old rows; anonymous callers |
| `lib/office-actions.test.ts` | Incomplete or uncalm rows refused; the reason for each audience; the Action Center conversion (id, source, confirmed hand-off, expiry, priority); no count below ten; the desk never offers self-approval; the draft rules |
| `components/OfficeActionFeed.test.tsx` | Flag off: nothing on Key dates or Today, with a signed-in control. Signed out asks to sign in. The card's office, source, date and reason. Open, mark done and save each wait for a confirmation with focus on Cancel. Empty and error with retry. Ranked in the Action Center, without the ones marked done. Three on the briefing. The desk: absent without a scope, no self-approval, no count below ten, publish after a preview |

**Revert checks.** Each guard was shown red against a revert and green on
restore.

- **SQL:**
  - self-approval;
  - the threshold;
  - eligibility matching;
  - the office-role match;
  - a staff read of audiences;
  - old rows in the feed;
  - the https check.
- **App:**
  - opening, marking done, saving choices and publishing without a
    confirmation;
  - approving your own;
  - the flag ignored on Key dates, and on Today;
  - done actions in the Action Center;
  - a count below ten;
  - an http link accepted;
  - the desk without a scope.

One of these first passed against its revert: the flag-off check on Today,
because the test was signed out, so the card rendered nothing either way. It
now signs in, adds a flag-on control, and goes red against the revert.

## Responsive manual-test checklist

Checked in Chromium, with the flag on and a fake signed-in session whose
Supabase calls were intercepted:

- [x] 390 and 1280px: the feed cards, "Why am I seeing this?", what applies
  to me, the Mark done confirmation, and the desk form and list.
- [x] Today: the office action leads the Action Center, "Institution
  verified · Updated just now", with Open official page.
- [x] No page overflow, and no `pageerror`.
- [ ] A real Supabase preview with seeded grants.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `office_action_opened` | After the confirmation (`office`, `type`); never the student |
| `office_action_marked_done` | After the confirmation (`office`) |
| `office_audiences_saved` | After the confirmation (the count of choices, never which) |
| `office_action_published` | An approval (`office`, `audience_kind`) |

## Rollback

- **The feature.** Leave the flag unset (the default). Today and Key dates
  lose the feed and the desk. Nothing else reads these tables.
- **The migration, before it is applied.** Drop the file; nothing depends on
  it outside this branch.
- **The migration, after it is applied.** Leave it. A later migration can
  restore the direct insert policy if an office tool ever needs it. The
  student tables go with each account.
