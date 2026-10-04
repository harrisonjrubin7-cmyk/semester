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

- Not mounted: no screen calls it. That is phase 1–3.
- Calendar is read-only; adding an event is the next use case (action name
  `calendar.add` not yet in `PERSONAL_ACTIONS`).
- Policy on the device is advisory; server enforcement of `decide()` per route
  is phase 5.
- Events are in-process (`EventSink`); promotion to the outbox is a gateway
  concern (ADR 0008) and the names already match its pattern.
- Class meetings are not a calendar source yet (`Block` in `lib/types.ts`).
