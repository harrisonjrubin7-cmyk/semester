# 3 · Refactoring sequence, repository restructuring, validation

Principles: additive first; one screen at a time; the old path keeps working
until the new one has been compared against it; every step is a small commit
that can be reverted alone; no step moves data.

## Repository restructuring

The earlier audit proposed `apps/` + `services/` + `packages/`, and the CTO
pack's [02](../../target-architecture/02-MONOREPO-STRUCTURE.md) refines it. That
layout is the **destination if and only if** an [extraction trigger](../0011-modular-monolith-before-services.md)
fires. Until then:

```
semester/
  app/src/
    kernel/  domains/  composition/  architecture/     ← new, strict
    lib/ state/ ai/ community/ …                       ← legacy, ratcheted, shrinking
  packages/contract  packages/institution              ← existing, shared with server
  app/server  app/api  supabase/                       ← existing gateway, functions, RLS
  docs/architecture/  docs/decisions/                  ← ADRs and this plan
```

What moves out of `app/src` and when: documentation-as-code (81 files) to ops
tooling in phase 7. A `packages/domains` split is deferred until a second
consumer (the desktop client already shares `packages/contract`) needs a slice.

## Phases

Each phase lists entry, commits, and the proof that it is done. "Gates" always
means the six commands in `CLAUDE.md`, from `app/`.

| # | Phase | Commits (each independently revertible) | Done when |
|---|---|---|---|
| 0 | **Fence** (this PR) | kernel + rules + census; first slice | Gates green; rules fail on 12 injected faults; parity tests green |
| 1 | **Bind** — *done* | `composition/react.ts`: `hostOver` (pure) + `useDomains` (hook) filling `LegacyHost` from `state/store`; writes go through the reducer as `editTask`; not imported by any screen | Gates green; `hostOver` held to the real reducer (`toggleTask`) on five task cases; mounted under the real `StoreProvider`; build unchanged (nothing imports it) |
| 2 | **Shadow Today** — *evidence collected* | `TodayActionCenter` mounts `composition/TodayShadow` when a build sets `VITE_TODAY_SHADOW=on`; it compares the domain's Today with what the component just computed and warns on any unexplained difference; no behaviour change | Zero unexplained differences over real use. `KNOWN_GAPS` is empty. Measured in a real browser on six seeded states (nothing of the student's; overdue, today, soon, someday and done tasks; timed tasks; a repeating task; appointments today and tomorrow; tasks with an appointment): all six agree, and breaking the domain's `dueToday` makes the four states with a task due today each name the missing task. That is the day the component draws, one day; it is not evidence for a ten-day view. Real-use evidence from a build left on for a week has not been collected |
| 3 | **Flip Today** — *blocked on a read model, not on evidence* | read `today.view()` behind `experience-flags`; keep the legacy path one release; then delete it and lock `screens/Today.tsx` in `legacy.json`. Three things stand between the shadow and a flip, found by trying it: (1) `TodayActionCenter` builds its rows over `HORIZON_DAYS = 10` and feeds `planCommitments`, while `today.view()` reads one day (`agenda(on)`), so it would need a multi-day read model; (2) the view's `schedule` is what is *left* (finished deadlines are dropped) where the screen keeps them struck through and counts them, so "Due today" and "Yours today" cannot move until that is decided; (3) the ranking is `lib/actions.rank` borrowed whole, so reading it from the domain moves where it is computed and nothing a student sees, for an asynchronous first paint | Screenshot compared (`.claude/skills/run`); `lib/` imports in Today = 0; flag removable. Decide (1) and (2) first: [D-1250](../../decisions/D-1250.md) |
| 4 | **Tasks and calendar screens** — *task writes built; calendar not started* | add, tick, move and delete go through `domains/tasks` behind `VITE_DOMAIN_TASKS` (`composition/taskactions.ts`, [D-1149](../../decisions/D-1149.md)); thirteen screens no longer dispatch them; the domains load lazily so a build without the flag pays nothing at first load. Mine's edit form and `lib/tools.ts` stay on `dispatch` by decision ([D-1250](../../decisions/D-1250.md)). Then `Calendar.tsx` (3,006 lines: split views first, then bind) | Flag at `production` for a dogfood week with no fallback logged; calendar locked |
| 5 | **Policy everywhere** | route `forRole` callers (App, nav, tabbar, springboard…) through the authorizer; on the server, call `decide()` in the gateway per route (ADR 0007's incremental adoption) | No caller of `forRole` outside `policy/` and `lib/role.ts`; gateway refusal suite green |
| 6 | **State by domain** | each slice gets its own repository over its own store key; `state/shape.ts` stops importing a feature's shapes (fan-out 62 → target < 20) | `shape.ts` fan-out measured by census; storage keys unchanged (invariant 4) |
| 7 | **Retire** | archive set out of the client; verified deletes; see [05](05-legacy-retirement.md) | Bundle smaller; no test lost except those of deleted code |
| 8 | **Next domains** | academic → learning → productivity …, ordered by value × risk, each with the same four steps | Per-domain locked screens |

Phases 1–4 are the vertical proof. Phase 5 is the one with institutional
value (a single, testable authorization path). Phase 6 is the large one and
should not start until 3–4 have shown the pattern holds.

## Validation criteria for any step

1. **Gates:** `npx tsc -b`, `npm run lint`, `npm run check:university`,
   `npm test`, `npm run test:shuffle`, `npm run build`.
2. **Rules:** `npm test -- src/architecture` green; `legacy.json` only ever
   shrinks (the test fails if an entry is stale, and if a new violation
   appears).
3. **Parity:** for anything replacing a legacy function, a test holds the new
   output to the old on the same input, and has been seen to go red on a
   deliberately wrong adapter.
4. **Guard proof:** each new guard is shown to fire by reverting the fix or
   injecting the fault, then restored (`CLAUDE.md`).
5. **Visual:** for a screen, drive it (`.claude/skills/run`) and look.
6. **Time zones:** `npm run test:zones` for anything touching dates; tests
   build clocks from a *day* (`fixedClock('2026-10-08')`), not a UTC instant.
7. **Budgets:** `npm run budgets`; a phase that makes the bundle larger says
   why.

## Rollback

Phases 1–2 add code nothing calls: revert the commit. Phases 3–4 are behind a
flag with the legacy path intact for one release: flip the flag. Phase 6 is the
only one that changes stored data shape, and follows ADR invariant 4: a new
shape gets a new key (`.v2`) and the old key is read, not mutated.

## Working with other sessions

`CLAUDE.md` records that concurrent sessions converge on the same fix. Before
each phase: `git fetch origin main`, grep the log for the defect. Hot files
(`Today.tsx`, `state/store.tsx`) change often; keep edits to them to the
smallest diff that moves a screen, and rebase before pushing. Ratchet lists
are sorted so two sessions removing different entries merge cleanly.
