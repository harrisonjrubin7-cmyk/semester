# Modular monolith: from screens to domains

Baseline `origin/main` `7287ddc` (4 Oct 2026). Decision: [D-1149](../decisions/D-1149.md). Code: [`app/src/domains/`](../../app/src/domains/). Guard: `app/src/domains/architecture.test.ts`. This page is the plan and the audit behind it; the reasoning for each rule is in the files named beside it.

All figures were measured on that commit by reading imports as text (1,412 production files, 395,883 lines under `app/src`). They are a baseline for the ratchets below, not a claim about quality.

> **Two things that landed on `main` while this was built (4 Oct).** The repository became an npm-workspaces monorepo (`app`, `packages/*`; wave C0 of D-1144's conversion plan), so a `packages/domain-*` home now exists, and moving `app/src/domains/` there is a `git mv` the architecture test's path table would follow. And a server-side productivity command service arrived (`app/server/productivity/`, `supabase/productivity-commands.check.sql`): tenant-scoped, versioned tasks and calendar events written only by commands, holding nothing until a client moves onto it. That is the other side of `TaskRepository`: the day a client is moved, the adapter behind that port changes from the legacy reducer to that API and the domain's rules, tests and callers do not. Its policy action is also called `task.read`, in the institution's vocabulary; this slice's `PolicyAction` is a separate, client-side, UX-only set that happens to share the name, and the two should be reconciled when they meet.

> **Relation to D-1144 (target-architecture pack, merged 4 Oct).** That pack is a *proposal* for the whole platform (a container-hosted `core`, a monorepo of `packages/domain-*`, tenant rings) and this page is the in-place client slice that is already built and tested. They agree on the strategy (modular monolith, strangler, extraction only on a written trigger, shadow then switch) and on the identity/productivity split. They differ in four places, none contradictory yet: (1) location: this code is `app/src/domains/`, where D-1144 §09 wants `packages/domain-*`; its own first move is "move nothing, `git mv` later", which this layout permits; (2) `policy` is a *platform* module in D-1144 §04 and a domain here, because the client needs its own UX-only decision point (ADR 0002); (3) D-1144's `productivity` owns tasks, events and Today; here they are three domains because the dependency table (`ALLOWED`) is easier to hold at that grain, and they would be one module's internals if D-1144 is accepted; (4) rollout: D-1144 §05 flags by tenant ring through a control plane that does not exist, while step 3 uses the `VITE_*` `FeatureState` flags that do. When rings exist, the flag read changes and the shadow does not. The error model is also parallel: `Result<AppError>` here, `CommandResult`/`ErrorEnvelope` in D-1144 §07; the adapter that crosses the wire maps one to the other.

## 1. Current-state audit

### Shape

| Area | Files | Lines | What it is |
|---|---|---|---|
| `lib/` | 764 (594 flat + 27 folders) | 201,540 | Everything that is not a screen: rules, selectors, adapters, registers, and record-keeping |
| `components/` | 389 | 77,958 | Shared UI, much of it a screen's private parts |
| `screens/` | 120 | 69,956 | Routes (89 top-level screen files, 100 lazy imports in the registry) |
| `state/` | 18 | 9,537 | One reducer, one store, 11 slices |
| `ai/`, `community/`, `data/`, `site/`, `insights/` | 103 | ~31,000 | Separate trees, no declared boundary |
| Tests | 1,219 files | n/a | 19,838 passing assertions in the last full run |

The server side is healthier than the client: 171 migrations, 106 `*.check.sql` suites that walk a second account, 15 edge functions, and a gateway (`app/server/institution`) that is already prepare-only with a policy decision point, event outbox and workflow machines (`packages/institution`, ADRs 0007 to 0010).

### Coupling

- **God module.** `state/store.tsx` has fan-in 338, `lib/types.ts` 275, `components/ui.tsx` 266. `state/shape.ts` is 2,829 lines and imports 62 modules; its `Action` union has 284 members. 317 files call `useStore()` (111 screens, 190 components): a screen reads the whole state and reduces it itself.
- **Screens are the integration point.** `screens/Today.tsx` imports 65 modules, `App.tsx` 74, `screens.tsx` 94, `Sheet.tsx` is 4,750 lines and `Calendar.tsx` 3,006. A rule that Today and Calendar both need (what is due on a day) is re-derived in `select.ts`, `today-actions.ts`, `today-center.ts`, `weekpage.ts`, `deadline-feed.ts`, `duetime.ts` and the screens.
- **Layers mostly point the right way, and that is worth keeping.** `lib/` imports `components/` or `screens/` zero times; `state/` zero; `components/` imports a screen zero times. Nothing enforced this until `architecture.test.ts`.
- **Where it does not.** 29 `lib/` files import `state/` (hooks that live beside the rules they wrap), 17 screen-to-screen imports cross to a different screen, 59 files sit in 12 import cycles (the largest: 18 files across `lib/` and `ai/`), 12 screens/components touch browser storage directly, 5 call the network or Supabase client directly.

### Duplication

The same concept is written several times because there is no home for it. "What is due on a day" is the example above. Repeat rules are shared between tasks and appointments (`lib/repeat.ts`), which is the counter-example: where one module owns an idea, it stayed single. The vocabulary is policed (`terms.mjs`, ledger of retired words) but the *rules* have no equivalent.

### Client-only logic

Almost all product logic is client-side by design (ADR 0001, 0003): scheduling, study, planning, the AI prompt assembly. That is acceptable when the logic is advisory and the database is the boundary (ADR 0002). It is a risk where a rule is **authoritative but only enforced in the browser**. Review list, from the module names rather than a proof: `gradesheet`/`grades`/`termgpa` (a student-entered GPA is an estimate and must stay labelled so), `registration-*` (registration windows), `bill`/`cost`/`spend` (money), `readonly` (a client flag whose server meaning is only the deployment's), `capabilities` (UX only by its own header).

### State boundaries

One `State` carries persisted data and ephemeral UI state together. Persisted shapes are versioned (`semester.*.vN`), which is a strength: a new shape gets a new key. The weakness is that nothing says *which domain owns which field*, so a screen can write any field through any action, and sync (`lib/cloud.ts`, 1,951 lines, 95 importers) merges field by field with no domain notion either.

### Time, errors, configuration

- 194 files read `Date.now()` or `new Date()`; 99 of them are in `lib/`. A shared `useNow()` exists in the store, and `test:zones` runs the suite twice because of this. Domains take an injected `Clock` instead.
- Errors are a mix: thrown `Error`, `ReadOnly`, `{ok:false, why}` (`lib/actions.ts`), and server `Refusal`. The gateway has an envelope (ADR 0010); the client has no equivalent.
- Configuration is env-driven flags (`experience-flags.ts`, 28 flags, 7 kill switches) read in many places. The flag *model* is sound (`off / preview / sandbox / production`); the *reading* is scattered.

### Risk register

| Risk | Evidence | Mitigation in this plan |
|---|---|---|
| Whole-state coupling makes every change global | fan-in 338, 317 `useStore` callers | Domains own data through ports; screens move to domain hooks |
| Date/zone bugs | 194 clock readers, two-zone test run | Injected `Clock`; purity rule |
| Authoritative logic only in the client | section above | Classify per rule: advisory (stay) or authoritative (server, via port) |
| Concurrent sessions converge | CLAUDE.md, 340 commits on main since 1 September | Small slices, index-only imports, ratchets that shrink |
| Cycles hide ownership | 59 files in 12 cycles | Cycle ratchet; break largest first |
| Document sprawl | 69 root `.md`, 100 `docs/` files | One plan, one ADR; no new root docs |

## 2. Target module graph and dependency rules

```
                        screens/ (routes, composition of hooks)         ← may import: components, domains/composition, domain indexes
                           │
                        components/ (UI)                                ← may import: lib, state, domain indexes. Never screens.
                           │
          ┌────────────────┴───────────────────────────┐
     domains/composition  (the one wiring file)          legacy: lib/, state/, data/ (retire over time)
          │                                                      ▲ imported only by domains/*/acl.ts and composition
   ┌──────┼───────────┬──────────────┐                           │
 today ──► tasks      calendar     policy ──► identity            │  anti-corruption layers
   │         │           │            │          │               │
   └─────────┴───────────┴────────────┴──────────┴──► kernel ─────┘  (Result, Clock, machine, events)
                                                         │
                                                  packages/institution (ADR 0007–0009), wrapped only by kernel
```

Rules, each one a test in `architecture.test.ts` (in brackets), none with an exception:

1. A domain imports only: itself, the kernel, and the domains `ALLOWED` names, **through their `index.ts`** [imports, deep imports].
2. Only an `acl.ts` (and the composition root) may import legacy code [acl rule].
3. A domain has no wall clock, randomness, storage, network, DOM, build-time config or `process.env` [purity]; `kernel/clock.ts` alone may read time.
4. No cycle among domains, declared or actual [cycles]. Every domain has a test beside it [coverage].
5. The kernel imports nothing but `packages/institution`; no other domain does [institution wrap].
6. A test adapter (`memory.ts`) is never on a public surface [leak].
7. Code outside `domains/` uses a domain only through its index or `domains/composition` [outside].
8. `lib/`, `state/`, `data/` never import UI; components never import screens; screens never import the shell [layers, zero today].
9. Five ratchets only shrink (storage in UI, network in UI, `lib`→`state`, screen→screen, cycles) [ratchets].

## 3. Domain boundaries and anti-corruption layers

Domains are named for what a student decides, not for the screen that shows it. The map below places the existing `lib/` modules; "now" marks what exists in `domains/`.

| Domain | Owns | Legacy it absorbs | Status |
|---|---|---|---|
| **identity** | who is asking: account, role, school, device vs signed in | `role`, `membership`, `school`, `session`, `institutional-access` | now |
| **policy** | what to offer: one `decide`, obligations, fail closed | `capabilities`, `readonly`, `rolelaunch`, `modulegate`, `featurepolicy`, `governance/` | now |
| **tasks** | the student's own to-do: rules, lifecycle machine | `chores`, `PersonalTask` + `mine` slice, `repeat` (stays legacy for now) | now |
| **calendar** | one `Entry` shape for a day; clashes; next up | `select`, `monthgrid`, `weekpage`, `calsource`, `band`, `where`, `opencal` | now |
| **today** | a read model composed from the above | `today-*`, `arrive`, `standing`, `atrisk`, `welcomeback` | now |
| coursework | courses, deadlines from syllabi, source labels | `generate`, `course-*`, `term`, `duetime`, `deadline-*`, `source` | next |
| study | decks, spacing, quizzes, mastery | `study`, `fsrs`, `quiz`, `drilldeck`, `exam*`, `learning*` | later |
| planning | degree path, registration, term plan | `degree`, `registration-*`, `graduation`, `pathway`, `plans` | later |
| writing & files | documents, sheets, slides | `document`, `sheet*`, `deck`, `docx*`, `xlsx*`, `pdf*` | later, leave until required |
| assistant | AI sessions, prompts, usage | `ai/`, `claude`, `assistant*`, `intelligence/` | later; boundary is the gateway |
| campus | housing, dining, athletics, clubs, career | `dining/`, `housing`, `athletics`, `career`, `office*` | later, already adapter-shaped |
| institution | tenancy, rollout, integration, trust, governance | `governance/`, `integration/`, `trust/`, `ops/`, `workflow/` | stays server-led; client reads only |
| account & sync | sign-in, backup, export, deletion | `cloud`, `sync/`, `workspace-backup`, `export`, `deletions` | cross-cutting; becomes the repository adapter layer |

**An anti-corruption layer is one file, `acl.ts`, that does three things:** maps legacy shapes into the domain's types, drops what the domain does not model rather than throwing, and writes back through the *narrowest* legacy command. The tasks ACL is the worked example: it reads `PersonalTask` and ignores steps, notes and free-text time, and it writes only `toggleTask` and a one-field `editTask`, so a domain that never saw a task's steps cannot overwrite them. It refuses repeating tasks (`unsupported`) because the legacy repeat engine owns that behaviour; the edge of a domain is stated in an error code, not hidden in a conditional.

## 4. Refactoring sequence that stays deployable

Every step ships alone, is flag-guarded where it changes behaviour, and has a validation criterion that is a command. The legacy path stays the default until the criterion has been green for a release.

| # | Step | Ships | Done when |
|---|---|---|---|
| 0 | **Guard first.** Layer rules and ratchets | `architecture.test.ts`, `legacy-baseline.json` | merged; baseline matches tree *(this PR)* |
| 1 | **Kernel and first slice** | `domains/` with identity, policy, tasks, calendar, Today | `composition.test.ts` drives the real reducer; six mutations red *(this PR)* |
| 2 | **Hooks, not screens.** `useDomains()` builds `LegacyHost` from `useStore()` | `state/domains.ts`, `state/domains.test.tsx` *(done)* | built once; a write resolves only after the store commits it; reads see changes it did not make; no screen changes |
| 3 | **Shadow.** Today computes both ways and reports disagreement | flag `VITE_DOMAIN_TODAY` (`domainToday`, default `off`), `state/todayshadow.tsx`, `domains/today/shadow.ts` *(done)* | zero disagreement on the parity fixtures *(held by test)* and one week of dogfood with the flag on *(not yet run)* |
| 4 | **Cut over Today's data** (not its JSX): the screen reads `TodayView` where the domain answers the same question | `state/todayview.ts`; `Feed_due` in `screens/Today.tsx` *(first list done)*; flag `domainToday=production` | the "Due today" list's membership and order come from the domain *(held by test and by a browser run, below)*; the other Today lists are not cut over, see below; `screens/Today.tsx` import count does **not** fall yet (it rose by two, shadow and view) |
| 5 | **Writes.** Ticking, adding, deleting, and moving a task (to a day, or to a day and an hour) go through `TaskService`; the screens' `toggleTask`, `addTask`, `deleteTask`, `moveTask` and calendar-move `editTask` callers are replaced by `taskActions` | `state/taskactions.ts`; `Mine`, `Today`, `Calendar`, `calendar/Move`, `Work`, `Mail`, `Career`, `Nil`, `QuickAdd`, `BreakItUp`, `UnityLayer`, `AddHere`; flag `VITE_DOMAIN_TASKS` (`domainTasks`, default off) *(done, except the edit form)* | `grep -rE "type: '(toggleTask|addTask|deleteTask|moveTask)'" screens/ components/` is empty; at `production` the result equals the legacy reducer's for the same presses *(held by test and browser run)*; **the Mine edit form and the assistant's tools stay on `dispatch`, see below** |
| 6 | **Calendar reads**, then writes (drag, double-tap add) | `calendar-direct` skill's behaviour, behind domain | `Calendar.tsx` loses `select` imports; clashes come from the domain |
| 7 | **Delete the duplicates** that steps 4 to 6 orphaned | removal PRs | `census:exports` shows the old selectors test-only, then gone; ratchets shrink in the same PR |
| 8 | Next domain (coursework), repeating steps 2 to 7 | | `ALLOWED` gains one row |

**What step 2 taught.** React's `dispatch` only schedules the reducer, so the adapter could not find a task it had just added. `LegacyTaskHost.settled()` lets a write wait for the commit; the hook implements it, and a plain synchronous host omits it. A second write started before the first commits still reads the old list, so callers await one write before the next.

**What step 3 does and does not do.** With `domainToday` at `preview` or `sandbox`, `screens/Today.tsx` mounts a component that draws nothing, asks the domain and the legacy selectors three questions about the same moment (deadlines today, open tasks today, deadlines in the next 14 days) and `console.warn`s each distinct disagreement once. `production` is reserved for step 4 and behaves as `preview` until then. Not compared, on purpose: overdue tasks (the legacy Today has no such notion; its banner counts deadlines) and whether a deadline is done (a separate map the domain does not model). The first run of the comparison already changed the domain: its tie-break was alphabetical where the legacy checklist keeps the order the syllabus listed, which would have been reported on every day with two untimed deadlines. It also found that the domain refuses Today to non-students while the screen still draws it; step 4 has to decide that, and the shadow reports it.

**What step 4 cut over, and what it left.** At `domainToday=production` the "Due today" list (`Feed_due`) takes which deadlines and in what order from the domain, and draws the legacy `DatedItem` for each id, because the domain holds ids and the row needs the course, quote and page. A role the domain refuses (everyone but a student) gets the legacy list, so nothing changes for them; whether the domain should serve them is still open. Left on the legacy selectors, each for a stated reason: "Yours today" (the legacy list shows *finished* tasks struck through; the domain's `dueToday` is open tasks only) and the all-clear line's "next" (`upcomingItems` has no horizon; the domain stops at fourteen days). Each needs a domain change first. **Evidence:** in a real browser on four dates, with the flag at `production` and the sample semester, the whole page text equalled the legacy build's (3 deadlines on 15 Sep, 1 on 30 Sep, none on 9 Sep and 4 Oct); with the domain's order reversed in the source, the 15 Sep page changed and the shadow reported it, then restored to equal. **Not done:** the week of dogfood, the rollout beyond a developer's build, and deleting the selector (step 7).

**What step 5 cut over, and what it left.** At `domainTasks=production`, ticking (the three screens that had `toggleTask`), the calendar's day-shift and **adding** (nine screens each dispatched their own `addTask`) go through the domain. One door, `taskActions`, replaces them. The tick reads its intent from the task as the store holds it now and presses are queued, so two quick presses end where two legacy toggles do. The domain's `add` now carries `time`, `note` and an `origin` (the legacy `from`, what the task was made for), which the callers set. Three safety rules, each held by a test: a task with a repeat rule or steps always takes the legacy reducer (the domain owns neither); a domain *refusal* (a title over 200 characters, a date that is not a day) is said once on the console and the legacy store takes the task anyway, because the screens have no place to show one and losing somebody's task is worse; and a domain *exception* falls back the same way instead of being swallowed by the queue. One visible difference: the domain trims the title. **Deleting and moving to a day and an hour came later**: the domain's `Task` gained a free-text `time`, `reschedule` takes an optional one, and `remove` is a command (the reducer's undo is unchanged because the same `deleteTask` reaches it). Left on `dispatch`, each for a stated reason: the Mine edit form's `editTask` (a general patch of title, time, steps and repeat, two of which the domain does not own), and the assistant's tool calls in `lib/tools.ts` (they build an *action descriptor* that another layer dispatches and undoes by diffing rows). **Evidence:** in a real browser the Mine add form gave the same row, date and time on the flag-on and flag-off builds with no page errors; with the domain's repository broken so `create` throws, the flag-on build still got the row and logged one `[domainTasks]` warning; deleting a plain and a repeating task gave identical pages on both builds, and with the domain's delete broken the flag-on build kept the task where the legacy one deleted it. The first version of that delete probe read tick buttons, and a row stuck in edit mode has none, so it reported "deleted" for a task still in the store; the control caught it. The drag-onto-an-hour gesture is held by the real-store test, not driven in a browser. **Not done:** the dogfood week, and the remaining call sites.

**Safe coexistence.** The domain and the legacy store never hold two copies of a fact: domains read the live legacy state through functions (`LegacyHost` fields are functions for exactly this reason, tested) and write through legacy commands. Only when a capability's screens are all cut over does its storage move behind a repository that is no longer the legacy reducer, and then the key is versioned (`.v2`, the #762 precedent). Rollback at every step is the flag.

## 5. Standards

**Layout.** `domains/<name>/{model.ts, ports.ts, usecases.ts, acl.ts, memory.ts, index.ts, *.test.ts}`. `index.ts` is the public surface and exports no adapter test double.

**Errors.** Expected failure is a value: `Result<T, AppError>`; `code` is one of eight (`validation`, `not_found`, `conflict`, `forbidden`, `invalid_transition`, `unsupported`, `unavailable`, `internal`), `retryable` is a property of the code, `message` is calm and for a person, `details` is for logs. Throwing is for programmer error and ends at `components/Boundary.tsx`. The gateway wire envelope (ADR 0010) adds a correlation id at the adapter that crosses the wire; a domain has none.

**State machines.** A lifecycle is data: `defineMachine({initial, on: {state: {event: target}}})`, evaluated by `send`, which delegates to `packages/institution`'s `transition` so there is one idea of a legal move (ADR 0009). The test enumerates every state against every event. The tasks machine is the example; a second machine means a second table, not a second evaluator.

**Dependency injection.** No container. A use case is `createX({repo, clock, can})`, a plain function over ports. Only `domains/composition.ts` builds adapters. Every dependency the legacy store replaces is passed as a function so it is read live.

**Configuration.** A domain receives configuration as data (`TodayConfig.horizonDays`) and validates it (`validation` error). One reader at the composition root turns `import.meta.env` into that data. Flags stay in `experience-flags.ts` (`off / preview / sandbox / production`); a domain never reads a flag, a hook does and chooses the path.

**Feature lifecycle.** `idea → off → preview → sandbox → production → retired`. Entering `preview` needs the domain's tests and a parity test against the legacy answer; `sandbox` needs a second-account check (`*.check.sql`) if it writes a table; `production` needs the flag's evidence record (`docs/CAPABILITY-ACTIVATION-REGISTER.md` already tracks this); `retired` needs the removal PR that shrinks a ratchet. Skipping a stage is a decision record, not a convenience.

**Time and ids.** Inject a `Clock`; ids are minted by the repository. Dates are `YYYY-MM-DD` strings validated as real days; arithmetic is `kernel` calendar arithmetic, never a `Date` in a rule.

## 6. Repository restructuring and commits

No directory is moved. New code goes to `domains/`; old code is **strangled**, not relocated, because moving 764 files in one change would conflict with every concurrent session (CLAUDE.md records sixteen merges in an hour). Commits are small, each leaves `tsc -b`, `lint`, `check:university`, `test` and `test:shuffle` green, and each states what it measured:

1. guard + baseline; 2. kernel; 3. identity, policy; 4. tasks + ACL; 5. calendar + ACL; 6. Today + parity; 7. composition + integration test (this PR is these, squashed into one commit and then docs); 8. `useDomains` hook; 9. flag + shadow; 10. cutover; 11. deletions.

Validation for every commit: the gates in CLAUDE.md, run from `app/`, plus `npm run test:zones` for anything that touches dates.

## 7. Legacy retirement

| Class | Meaning | Examples (not exhaustive) |
|---|---|---|
| **Reusable** | Keep as is; it is already a domain in shape | `lib/repeat.ts`, `lib/fsrs.ts`, `lib/look.ts` (contrast-tested), `packages/institution`, `supabase/*.check.sql`, the gateway adapters |
| **Migrate** | Move behind a port, behaviour preserved | `select.ts` due/day selectors → calendar/today; `chores.ts` → tasks; `role.ts`/`capabilities.ts` → identity/policy |
| **Replace** | Behaviour is wrong or duplicated; build new, retire old after parity | the five "due on a day" derivations; `toggleTask` as a toggle (the domain refuses a double completion) |
| **Delete** | Orphaned once its replacement is live; census shows test-only | selectors left by steps 4 to 6; per-screen date helpers; `.hook.ts` shims that only wrap the store |
| **Archive** | Evidence, not code; keep out of the build and out of the index | the ~70 root audit documents superseded by the registers (move to `docs/archive/` in a docs-only PR; `FEATURE-INVENTORY`, `EVIDENCE-REGISTER`, and `DECISIONS.md` stay) |

Order is by cost of keeping, not age: the duplicated derivations first, because they are where two answers disagree. Nothing is deleted until the census (`npm run census:exports`) shows it test-only *and* the ratchet that names it is lowered in the same PR.

## 8. Architectural tests

`app/src/domains/architecture.test.ts` (41 tests). It reads imports as text, so there is no new dependency and it runs in the ordinary suite. Three kinds of rule (domain, layer, ratchet) and, for each rule, a synthetic tree that breaks it, because a probe that finds nothing is only evidence when it finds something when there is something to find.

Proof, run on 4 Oct on the real tree and each restored afterwards: a `lib/` file importing a component; a screen deep-importing a domain; a domain calling `Date.now()`; a new screen touching `localStorage`; the repeating-task refusal removed; the ACL comparing the raw date. Each turned a named test red. The first version of the layer rule missed `App` because import targets are extensionless; the synthetic tree caught it before the real tree could say "clean".

Ratchets, today: storage in UI 12, network in UI 5, `lib`→`state` 29, screen→screen 17, cycle members 59. Regenerate after fixing one: `ARCH=write npx vitest run src/domains/architecture.test.ts`. The JSON diff is the review.

## 9. The example slice

Identity, policy, tasks, calendar and Today are implemented and tested in `app/src/domains/`. What it demonstrates:

- `tasks` refuses `complete` twice (`invalid_transition`) where the legacy `toggleTask` silently un-completes; refuses repeating tasks (`unsupported`); preserves steps, notes and the free-text time through the ACL (tested against `state/reducer.ts`).
- `policy` serves Today to exactly the roles `showsTodayDecisionSurface` does (parity test over every role) and turns read-only mode into an obligation, never a denial.
- `calendar` gives "no time" as `null` instead of 1440 and tells back-to-back from a clash.
- `today` is about forty lines of rules over an injected clock; a parity test holds it to `itemsDueToday` on the same catalog.

**Honest limits.** No screen uses it yet (step 2 onward). Calendar writes, repeating tasks, and the day's class blocks (`Block`) are not mapped. The ratchet baseline is a count, so a concurrent PR that fixes one violation and another that adds one can both pass individually and conflict on the JSON, which is a merge conflict rather than a silent drift.
