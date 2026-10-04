# 7 · Vertical slice: identity, policy, tasks, calendar, Today

Code: `app/src/domains/{identity,policy,tasks,calendar,today}`,
`app/src/composition/domains.ts`, `app/src/kernel/`. 857 lines of slice code (excluding tests and the composition root)
and its tests. Nothing existing was modified except three additive re-exports
in `packages/institution/src/index.ts`.

## Graph

```
            composition/domains.ts   (LegacyHost, Platform → ports meet adapters)
   ┌────────┬────────┬─────────┬──────────┐
 identity  policy   tasks    calendar     today ──▶ tasks, calendar (types, via index.ts)
   │          │        │         │           │
   └ adapters ┴────────┴─────────┴───────────┘──▶ lib/ (only here)
        guard(action, resource) is a function handed to tasks/calendar/today;
        they do not import policy.
```

## What each does

- **identity**: `Subject` (id|null, role, school, capabilities). Signed out is a
  valid subject (ADR 0001). The legacy adapter keeps only grants over exactly
  the person's school, as `lib/capabilities.forSchool` does.
- **policy**: personal actions get an owner rule (advisory on the device, ADR
  0002). Institutional actions (`POLICY_ACTIONS`) go to `decide()` with facts a
  server resolved; with none they are refused as `tenant_unverified`. This is
  `decide()`'s first caller in the app. `enforce` returns obligations or the
  kernel error shape.
- **tasks**: lifecycle is an ADR 0009 machine. `completeTask` = guard →
  find → decide → apply → publish; a refused request writes and announces
  nothing. The adapter applies via `lib/chores.tick`.
- **calendar**: one `Entry` over appointments (repeats expanded by the legacy
  rule) and deadlines; ordering, conflicts (back-to-back is not a conflict),
  real-day validation; a failing source is named in `unavailable`.
- **today**: read model over `listTasks`, `getAgenda` and the legacy ranking;
  quiet-day detection; tasks unreadable fails, a calendar down degrades.

## Evidence

| claim | held by |
|---|---|
| Domain tick = legacy tick, 6 cases incl. repeat on its last day and steps reset | `tasks.test.ts` parity block; red when the roll day is wrong |
| Today ranking = `actions.rank`, same ids and order; snooze honoured | `today.test.ts`; red when reversed |
| Calendar day = `appointmentsOn` with repeats | `calendar.test.ts` |
| `decide()` allows what it allows, refuses without a capability or enrolment, fails closed without facts, judges expiry by the injected clock | `policy.test.ts` |
| Whole slice end to end, signed in and out, ticking changes the next Today | `composition/domains.test.ts` |
| Architecture rules hold on the real slice | `architecture.test.ts` "the real tree" |

Total: 99 tests across the slice, composition and architecture groups at the
time of the first commit.

## What it deliberately is not

- No screen calls it yet. Phase 1 (done) binds it to the live store in `composition/react.ts`; phases 2–3 shadow and flip Today.
- Today's ranking covers `todayActions` only. `TodayActionCenter` also ranks registration and campus-office actions, so the phase 2 shadow comparison is expected to show those as its first differences.
- Calendar is read-only; adding an event is the next use case (action name
  `calendar.add` not yet in `PERSONAL_ACTIONS`).
- Policy on the device is advisory; server enforcement of `decide()` per route
  is phase 5.
- Events are in-process (`EventSink`); promotion to the outbox is a gateway
  concern (ADR 0008) and the names already match its pattern.
- Class meetings are not a calendar source yet (`Block` in `lib/types.ts`).

## Phase 1: the store binding

`composition/react.ts`. `hostOver(read, dispatch)` is a plain function of "what
the store holds now" and "how to dispatch"; `useDomains()` supplies both from
`useStore`, `useNow`, `useMyCapabilities` and the Today choices library, and
returns one stable object that reads the latest snapshot through a ref.

Writes go through the reducer so persistence, sync and the unpushed-edits flag
see them: the tasks adapter's next list becomes `editTask` patches of only the
changed fields. The reducer's own `toggleTask` is `{ ...t, ...tick(t, !t.done) }`,
so both paths give the same record — `react.test.ts` checks that against the
real reducer for plain, undated, weekly, weekly-on-its-last-day and
daily-with-steps tasks, and for reopening. `react.mount.test.tsx` runs the hook
under the real `StoreProvider`. Three faults injected into `hostOver` (patch
carries the wrong fields; dispatcher ignored; tasks read from a frozen
snapshot) each turned tests red.

`useDeviceLibrary` is called with `TodayActionCenter`'s own key, so the two read
one store; the backup-coverage census (`workspace-backup.coverage.test.ts`)
lists the new call site.

## Phase 2: the shadow

`composition/shadow.ts` (pure) and `composition/TodayShadow.tsx` (the
component). The Action Center already computes the legacy candidate list, the
student's choices and the day's rows; the shadow is handed exactly those, asks
`today.view()` the same questions, reduces both to ids, and diffs them. Off
unless the build sets `VITE_TODAY_SHADOW=on`; loaded lazily, so a build
without it carries none of the code (the budget check is unchanged).

**Known gaps are classified, not hidden.** `KNOWN_GAPS` names three sources the
slice does not have — registration-day actions, campus office actions, class
meetings. A legacy-only id from one of them is `explained`, with the reason;
anything else is `unexplained` and is warned once per distinct finding. The
comparison tolerates the cut-off effect (the legacy list is four long, so each
explained entry lets one more of the domain's tail show) and nothing more.

**It found two real differences before it shipped**, by reading the Action
Center's row logic to build the legacy side: Today leaves done deadlines out
and scopes the sample's deadlines to the student's own courses, and the
calendar source did neither. Both are fixed (`Entry.done`; the host scopes
with the same `ownedScope`), with tests.

Held by: `shadow.test.ts` (comparator rules, including a control for each way
it can disagree), and `TodayActionCenter.shadow.test.tsx`, which mounts the
real Action Center on the sample semester at a pinned time (including a day
with deadlines, with one ticked off) and fails on any unexplained warning. Five
faults injected into the domain side — ticks ignored, ranking reversed, today's
actions dropped, appointments missing, the day off by one — each turned it red.

**Not shown:** that the two agree on real students' data over time. The mounted
test is the sample semester. The flag, and a week of real use with the console
read, is the remaining evidence before phase 3; telemetry for it is not built
(the shadow logs to the console only).

The build input is mapped in `pages.yml` and documented in `.env.example`, as
`deploy.test.ts` requires of every `VITE_` setting; unset means off.
