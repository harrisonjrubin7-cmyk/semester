# The app, from underneath — an engineering audit

Seven `SIMPLIFY-AUDIT` passes have already asked *does this app do the same job
twice?* and the answer, repeatedly, was no: 60 destinations, and the duplication
that existed is gone. `SPEC-AUDIT.md` asks what is still missing against the
product vision and answers that too.

So this pass asks the third question neither of those covers: **what does this
app cost to open, to render, to test and to extend, and where is that cost paid
for nothing?** Everything below is measured at `b251d04`, with the command that
measured it, because an audit of a codebase this careful is worth nothing as
impressions.

---

## 0. The census, and the baseline

| | |
| --- | --- |
| Production TypeScript | 189,020 lines across 610 files |
| Tests | 70,207 lines across 335 files (0.37 test lines per production line) |
| `lib/` modules | 275, all at one level |
| Components · Screens | 147 · 100 |
| `Screen` union members · registry destinations | 82 · 60 |
| Navigations × shells × grounds | 7 × 3 × 13 = 273 chrome combinations |

Health, run from `app/`:

```
npm run lint   → exit 0, 155 warnings, style ledger and label check both pass
npm test       → 336 files, 6,931 passed, 10 skipped, 48.35s
npm run build  → exit 0, 268 chunks, 7.18 MB raw JS / 2.18 MB gzip
```

Three checks that a codebase this size usually fails, and this one passes:

- **No dead modules.** Every `.ts`/`.tsx` under `src/` is imported by something
  (walked statically *and* through `import()`).
- **No suppressions.** 0 `TODO`/`FIXME`, 0 `@ts-ignore`/`@ts-expect-error`, 11
  `any`, 7 `console.`.
- **The failure paths are real.** `ScreenTrouble` is mounted around the screen
  in all three shells, it separates "offline" from "we redeployed under you",
  and the service worker's offline story is deliberate rather than aspirational.

Nothing below is a bug report. They are places where the app pays for something
it is not using.

---

## 1. P1 — first paint carries the whole app · **the largest single win**

**Measured.** Walking the static import graph from `src/main.tsx`:

```
287 modules, 86,319 lines are evaluated before anything renders
```

and on the wire that is **347 kB of gzipped JavaScript across 23 files, plus
24 kB of gzipped CSS** — before a student sees Today.

The heavy third-party code is *already* lazy and should stay that way: pdf.js
(431 kB), the mermaid/cytoscape family (~1.1 MB across a dozen chunks), Leaflet
(152 kB), KaTeX (259 kB) and Supabase (209 kB) are all behind `import()`. The
weight on the critical path is the app's own code, and four edges put it there.

| # | The edge | What it drags in | Why it is there |
| --- | --- | --- | --- |
| P1a ✅ | `App.tsx` → `ai/Assistant.tsx` | **20 modules, 7,287 lines** | `<Assistant />` is mounted unconditionally in all three shells |
| P1b | `main.tsx` → `lib/connect.ts` | **2 modules, 1,616 lines** | to read `?code=` off the URL |
| P1c | `state/slices/made.ts` → `lib/decks.ts` → `lib/pptx.ts` | **2 modules, 1,001 lines** | for `blankDeck()`, a 14-line factory |
| P1d | `components/soft/SoftTop.tsx` → `lib/softtop.ts` | **3 modules, 1,518 lines** | needed only when `shell === 'soft'`, one of three |

**Cutting all four: 287 → 258 modules, 86,319 → 73,402 lines. −15% of the
critical path**, with no feature removed and no screen changed.

### What each one actually is

**P1a — the assistant is mounted, not opened.** `App.tsx:1294`, `:1741` and
`:1863` render `<Assistant />` in every shell so there is exactly one of it,
which is right. But the component was statically imported, so the whole
conversation stack — `converse.ts`, `Turns`, `Composer`, `Actions`,
`lib/tools.ts` (939 lines) — was parsed on first paint for a panel that opens
on a tap. The button is small; the panel is not.

**Done**, and one word of the recommendation was wrong. "The panel becomes
`lazy()`" is the obvious shape and it made opening the panel **twenty times
slower** — 14–28ms to a flat 314ms on the production build, with the chunk
already fetched and in memory. The flatness is the clue: `lazy` calls its
factory only at the first render that needs it, so even a loaded module
suspends for a tick, the fallback is committed, and React then throttles
un-showing a fallback it has just shown. Not suspending is the way not to pay
it — the module is held in state and fetched on `requestIdleCallback`, and
opening is back to 17–18ms. `ai/split.test.ts` holds it there, because the
`lazy()` version reads as a simplification and costs a third of a second that
nothing in the code would say it costs.

**P1b — an OAuth redeemer loaded for everyone who is not redeeming.**
`completeAuth()` returns `null` on line 280 of `lib/connect.ts` when there is no
`code` and no `error` in the query string — which is every load but the one
after a sign-in redirect. The guard is *inside* the module, so the module is
fetched and evaluated regardless. Hoisting five lines of `URLSearchParams` into
`main.tsx` and `await import('./lib/connect')` only past that guard takes 1,616
lines off every cold start.

**P1c — the reducer imports a PowerPoint writer.** `state/slices/made.ts:24,28`
imports `blankSheet` and `blankDeck`. `blankSheet` is 15 lines and lives in a
2,239-line spreadsheet engine; `blankDeck` is 14 lines in `lib/decks.ts`, which
imports `DEFAULT_PALETTE` from `lib/pptx.ts` (641 lines) — so the reducer, which
every dispatch runs through, drags a `.pptx` serialiser onto the critical path
for a palette constant. Moving the two factories (and the palette) into leaf
modules is a pure refactor with no behaviour to change.

**P1d — the soft shell's fact registry.** `lib/softtop.ts` is a 60-case switch
computing hero figures, and it is excellent — data, not markup, testable without
a DOM. It is also only read when the *Soft* shell is on, and the guard that
knew that was *inside* the module: `App.tsx` renders `<SoftTop />` on all three
shells, so every reader parsed the registry and the ten modules behind it in
order to decide not to draw anything.

**Done**, and it was worth more than this section estimated — the registry has
grown since:

```
253 modules, 74,986 lines  →  242 modules, 71,067 lines
initial gzipped JS: 279,323 bytes  →  266,257 bytes     (−4.7%)
files on the critical path: 17 → 14
```

Re-measured on `1855396` after the rebase, against a build of the same tree
with the split taken back out. The absolute figures moved by about 3 kB
between measurements because `main` keeps growing; the difference between them
did not, which is the number this row is about.

The second half is not in the byte count. `useTop()` is a hook, so it ran
*above* the `if (!soft) return null` beneath it: every render on every shell
built a spec — which walks the term's deadlines — and discarded it. Gating at
the mount is what stops that, and it is the reason the fix is a second file
rather than an `import()` inside the same one.

Unlike P1a, this one does **not** prefetch on idle. A Soft reader needs the
hero in the first paint and nobody else ever needs it, so the fetch is the
answer to the question rather than a guess ahead of it.

### Two cuts that measure as zero, and why that matters

I also tried `state/store.tsx` → `lib/claude.ts` (1,641 lines) and
`state/store.tsx` → `lib/export.ts` (668 lines). **Both save nothing**, because
other eager paths already reach them — `App.tsx:170` imports `provider` from
`lib/claude`, and eight components import `ask`. Worth recording so nobody
"fixes" them and measures no change: after P1a–P1d, the second pass is
`App.tsx:170` plus the `lib/sheet.ts` importers, and those need their own
measurement, not a guess.

### What landed

P1a, P1b, P1c and P1e are done. Measured after, the same way:

```
287 modules, 86,319 lines  →  243 modules, 71,221 lines   (−15% modules, −17% lines)
initial gzipped JS: 346,504 bytes  →  268,164 bytes       (−23%)
```

`lib/connect.ts`, `lib/decks.ts`, `lib/pptx.ts` and `lib/tools.ts` are off the
critical path entirely.

**`lib/sheet.ts` is not, and this section said it would be.** "It leaves with
P1a" was wrong: the remaining eager path is `ai/providers/make.ts`, and what
reaches that is `ai/store.tsx`, which `main.tsx` mounts as `AIProvider` — not
`ai/Assistant.tsx`. Splitting the panel could never have moved it. The
correction matters more than the line it corrects: every eager path has to be
traced to its own root, and a module with two of them only leaves when both go.

### P1e — the providers · **DONE**

With the panel split, the largest single edge left in the app was one line:

```
ai/store.tsx -> ai/providers/index.ts    −23 modules, −7,543 lines
```

Bigger than P1a was. `ai/providers/*` assembles what the assistant can see on
each screen, and `AIProvider` is mounted by `main.tsx` above the router — so
every student parsed it, and between them those providers read the spreadsheet
engine, the equation library, the chart model, the names and the whole
`insights/` tree.

`look()` and `suggestions()` had exactly three callers — `ai/Panel.tsx`,
`ai/Opening.tsx` and `ai/converse.ts` — and all three are already behind the
panel's chunk or the Ask tab's. So the store keeps what only it can know
(which screen, the live store, what is registered) and `ai/assemble.ts` holds
the part that needs the providers. `assemble` stays a *function* rather than a
hook: the reasoning in `ai/store.tsx` about not re-rendering is the whole
design, and what moved is where the context is computed, not when.

```
eager import graph  267 modules / 78,971 lines  →  243 / 71,221
initial gzipped JS  305,452 bytes               →  268,164        (−12%)
files on the critical path  25 → 15
```

`lib/sheet.ts`, `lib/maths.ts` and `lib/chart.ts` are off the critical path,
which finishes answering the correction above: they were never the panel's to
take with it, because what reached them was mounted above the router rather
than imported by the assistant's button.

### Where the critical path stands

Four edges, measured end to end:

```
287 modules, 86,319 lines, 346,504 bytes gzip   ← where this audit started
243 modules, 71,221 lines, 268,164 bytes gzip   ← now
       −15%        −17%           −23%
```

The heavy third-party code was already lazy before any of this and still is.
What came off was the app's own: the OAuth redeemer, the spreadsheet engine,
the `.pptx` writer, the conversation stack, and the assistant's context
assembly — none of which a student needs to see Today.

> **How to reproduce.** Walk the graph from `src/main.tsx`, following every
> non-`type` `import … from` / `export … from` and bare `import '…'`, and
> ignoring `import()`. Count modules and lines with an edge present, then with
> it removed. The difference is what that edge costs.

---

## 2. P2 — the entire tree re-renders twice a minute · **three-line fix**

`state/store.tsx`:

```ts
239:  const [now, tick] = useReducer(currentMinute, startedAt.current);
285:    const id = setInterval(() => tick(), 30_000);
```

`currentMinute()` returns a **new `Date`** every call. `useReducer` bails out
only when the reducer returns a value `Object.is`-equal to the last one, and a
fresh `Date` never is. So:

- the clock fires every **30 seconds**, but the value it publishes only changes
  every 60 — **half the ticks are pure waste**;
- `now` is a member of the single context value built at `store.tsx:1148`, so
  every tick makes a new context object;
- **298 call sites** use `useStore()`;
- and there is **not one `React.memo` in the codebase** (0 occurrences across
  610 files), so nothing stops the cascade.

Twice a minute, forever, the whole mounted tree re-renders — on a phone, on
battery, while a student reads a field guide.

**The three-line fix** removes half of it immediately:

```ts
const [now, tick] = useReducer(
  (was: Date) => { const d = currentMinute(); return d.getTime() === was.getTime() ? was : d; },
  startedAt.current,
);
```

**Done.** `nextMinute` in `state/store.tsx` returns the previous `Date` when
the minute has not moved, and `state/clock.test.ts` asserts identity rather than
equality — the same minute must come back as the *same object*, or React cannot
tell that nothing happened.

**Done.** `NowContext`, nested inside `StoreContext` so a tick makes a new
value for the inner provider only — 117 of the 195 files that read the store no
longer re-render on the minute, and `state/clocksplit.test.ts` pins both the
absence of `now` from the store type and the nesting, because putting either
back is silent.

The sweep is worth one line of warning for whoever does the next one: of 78 call
sites, 75 rewrote mechanically and three did not, and one of those had a
`useNow` of its own — a per-second clock in `screens/Clocks.tsx` — so importing
the store's under the same name shadowed it and an alarm countdown started
being handed a number where it wanted a `Date`. Nothing about that reads wrong.
`tsc` caught it and nothing else would have.

It corrected one guess of its own on the way: this section expected the clock
to matter to "the handful of components that show a relative time". It is 78 of
195 — closer to half than to a handful, because a great many screens compute
what is due from `now` rather than merely printing it. The saving is real and it
is 117 files, not 190.

---

## 3. P3 — CI spent a third of its test time starting processes · **DONE**

Vitest reported it itself, at the end of every run:

```
Isolate  363 workers spawned · ~224ms startup each (spawn + environment, per file)
         at least ~27.02s faster with isolate: false
```

There was no test configuration at all — the suite ran on defaults, one worker
per file. And CI pays it three times: `npm test`, then `test:zones` runs the
whole suite again under `TZ=America/Chicago` and again under
`TZ=Pacific/Kiritimati`.

Measured from a cold transform cache, in CI's own order:

```
baseline   npm test 46s  +  test:zones 89s  =  135s
after      npm test 29s  +  test:zones 55s  =   84s      −37%
```

### It is two projects, not one setting

`isolate: false` gives up a fresh module registry per file, and this audit
guessed that "with 335 files some will break". Nine do, and they are a
principled nine rather than a scattering: every file that calls `vi.mock`.
A mock can only rebind a module the worker has not already evaluated, so
whether it takes depends on which file ran first — `components/rework` got
the real `state/store` and threw *"useStore must be used inside
StoreProvider"* on one run in three.

So the nine run isolated and the other 354 share workers, and
`src/isolation.test.ts` keeps the list true by grepping the tree against the
list in the config. A file that starts mocking without being listed would
otherwise not fail — it would fail *sometimes*, which is worse.

### The bug it uncovered, which was nothing to do with workers

`lib/realdate.test.ts` sets `process.env.TZ` to Havana for one test and puts
it back afterwards. `process.env.TZ = undefined` does not unset a variable: it
sets the **string** `"undefined"`, which is not a zone, and Node then answers
`Intl.DateTimeFormat().resolvedOptions().timeZone` with `undefined` for the
rest of the process. A plain `npm test` has no `TZ` in the environment, so
that is the path taken every single run.

Harmless while every file had a worker to itself. With workers shared it is
process-wide, and the next module in that worker to read the zone *at import
time* keeps the broken value — which is how `lib/connect.ts`, whose `TZ` is a
module-level `const`, wrote a calendar event with no `timeZone` on it about one
run in six, from a file that has nothing to do with timezones.

### 7c — this class of split is only verifiable in a browser

Both P1a and P1d hold a module in state and fetch it with `import()` from an
effect, and **vitest cannot exercise that path**: the effect runs, and the
promise it creates neither resolves nor rejects, through fifty macrotasks.
Traced with a counter inside `SoftTop`'s own effect; the same `import()`
awaited directly from a test resolves immediately, and the production build
fetches the chunk and draws the hero.

So `components/softtop.test.tsx` imports the body statically to put it in the
registry before the gate asks, which takes the timing out of it without
weakening what is asserted. It is worth naming as a standing limit rather than
a quirk of one file: as more of the app moves behind this pattern, the only
thing that can prove the fetching half works is driving the built app — which
is what `.claude/skills/run/SKILL.md` exists for, and what both of these were
checked with.

### 7b — two more things the stress test found, left alone

Running with `--sequence.shuffle.files` eight times found no failures. Running
with plain `--sequence.shuffle`, which also shuffles tests *within* a file,
found two things that are **not** this work's and are recorded rather than
fixed:

- **Four files depend on their own tests running in order** — `lib/claude`,
  `lib/keys`, `lib/device` and `components/splash`. Checked against the
  unchanged config: they fail there too, so it is within-file order dependence
  and predates the projects split.
- **`EnvironmentTeardownError` on `data/courses/econ/guide.ts`**, three at a
  time, on roughly a third of shuffled runs — an async import that resolves
  after its environment is gone. Also present at baseline. CI does not shuffle,
  so neither reaches it today; both are real and both want their own pass.

  **Since reproduced deterministically.** Any test that mounts `StoreProvider`
  and ends without awaiting `loadSeed()` gets it every time — the provider
  starts that on mount and it dynamically imports four course modules. It is
  not only noise: vitest exits non-zero on unhandled errors, so it is a green
  suite that fails anyway. `components/softtop.test.tsx` awaits the seed for
  exactly this reason, and that is the shape of the fix wherever else it
  bites.

### The `lib/connect.ts` capture · **FIXED**

Not a test problem, and the only one of its kind in the app —
`resolvedOptions` appears in exactly one place.

`const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone` was read once
when the module loaded and never again, and five writes used it: both
calendars and the Microsoft task due date. A PWA stays open for days, and the
moment somebody is most likely to be adding calendar events is the moment they
have just changed timezone — a flight, a term abroad, a drive across a state
line. Every event after that carried the zone the app started in, an hour or
three out, with nothing to say so.

Read per call now. It costs a `DateTimeFormat` construction on a request
already crossing the network, and there is no kept value to go stale.

**How it was found is the part worth keeping.** `lib/realdate.test.ts` was
corrupting `process.env.TZ` process-wide (§3), and this const captured the
corruption for the rest of the run — which made it look like a test-only
problem. Fixing the test would have closed the symptom and left the bug. The
test that now guards it stubs `Intl.DateTimeFormat` rather than setting
`process.env.TZ`, because a process-wide clock change is exactly the leak that
caused the thing it is testing.

## 4. P4 — a screen is registered in eight places

Adding or removing one destination today means editing, at minimum:

1. `lib/types.ts` — the `Screen` union (82 members)
2. `lib/nav.ts` — the registry row: label, blurb, keywords, group, taskTags
3. `App.tsx` — the `lazy()` const (82 of them, lines 41–133) · **DONE**
4. `App.tsx` — a case in `CurrentScreen` (the switch at `:949`) · **DONE**
5. `App.tsx` — a case in `useHeader` (the switch at `:266`) · **DONE**
6. `lib/softtop.ts` — a case in the 60-case hero switch · **left, see below**
7. `lib/role.ts` — the student-only / faculty lists
8. …then whichever of `lib/springboard.ts`, `lib/capture.ts`, `lib/guidebook.ts`
   applies

Grepping one destination — `'tonight'` — finds it in **10 files**.

This is not duplication in the sense the simplify passes were hunting; every one
of those lists is about a genuinely different thing. It is *co-location*: eight
lists keyed by the same value, kept in step by hand.

### The symptom this section claimed does not exist · **CORRECTED**

This said: *"The `Screen` union has 82 members and the registry has 60. Twenty-
two screens exist, render, and are navigable, but the directory does not list
them and search cannot find them… some of it is a screen that quietly fell out
of the index."*

That was wrong, and it was wrong in the direction that makes a maintenance
refactor look like a bug fix. The twenty-two are, in full: `search`,
`directory`, `onboarding`; the seven detail screens that need an id (`course`,
`item`, `event`, `note`, `guide`, `lesson`, `slides`); the four study modes
reached from a guide (`drill`, `quiz`, `guess`, `gap`); and the eight `set*`
pages. **Every one is deliberately not a destination** — putting `item` in the
launcher would mean "a deadline", unanswerably, and putting `setLook` there
would be a second door into a page Settings already lists.

Nor were they unnamed. `screenName` has always read three registries —
`DESTINATIONS`, `settingsTitle`, and a `NESTED_NAMES` table — and
`lib/nav.test.ts` already walked the union out of the source to prove no screen
falls through to its own id. The "cheap first step" proposed below was, in the
part that mattered, already there.

**And the rest of it now is too.** `lib/nav.registry.test.ts` lands the
allowlist: every union member is either registered or named with the reason it
is not. It was written on `main` rather than here, and it cites this section
while correcting it.

So what is left of P4 is **only** the maintenance cost — eight lists keyed by
the same value, kept in step by hand — with no user-facing symptom behind it.

**The shape of the fix**, if it is worth doing: one module per screen exporting
everything that screen needs registered — the lazy component, the header, its
soft-top facts, its registry row — and `nav.ts` built by collecting them. The
three switches in `App.tsx` and `softtop.ts` become lookups; adding a screen
becomes adding a file.

**Recommended against, for now, and the reason is not the size.** It touches
`App.tsx` (1,868 lines, 82 `lazy()` consts, 159 case labels) and `lib/softtop.ts`
(933 lines, 60 cases) — the two files `main` merges into most often; this branch
took in 39 commits across three merges in a single evening. A restructure of the
router that cannot be reviewed in one sitting and conflicts with every PR
touching a screen is a poor trade for a convenience with no symptom. It wants a
quiet week and a decision, not a slot at the end of an audit.

### What landed · **places 3, 4 and 5**

The three lists inside `App.tsx` are one table each, and both tables are
`Record`s over the `Screen` union, so the list that used to be kept in step by
hand is now kept in step by the compiler.

**`src/screens.tsx`** — 82 `lazy()` declarations and
`SCREENS: Record<Exclude<Screen, 'home' | 'onboarding'>, ComponentType>`.
`CurrentScreen` is a lookup. `App.tsx` went 1,870 → 1,639 lines.

**`src/headers.ts`** — `HEADERS: Record<Screen, (c: HeaderCtx) => Head>`, all 82
rows, and `fallbackHeader` with it. `useHeader` stays in `App.tsx` as the
twenty lines that gather the context and hand it to one row; the table itself
imports no React, so `header.test.ts` reads it in node and calls every entry
rather than matching `case` labels in a file, which is what it used to do.
`App.tsx` went 1,639 → 1,397 lines.

Both replaced a `default`. That is the point of the change rather than a side
effect of it: a default that always returns something can never be *missing* a
case, so a screen added to the union and forgotten rendered Today, with today's
date over it, and nothing failed anywhere. It had already happened five times —
Everything, How this works, Your data, Privacy, and then the assistant's
settings page after the first four were fixed. `Record<Screen, …>` has no room
for a missing key, so the sixth is a build error.

**Measured, not assumed.** The header each of the 82 screens draws — kicker,
title and tab title — captured from the built bundle before and after, by
driving the production build in Chromium: 68 screens by hash, the remaining 14
(the seven id-requiring detail screens, the four study modes, the two shell
screens, onboarding) as 16 routes including the bare no-id forms. **Byte-
identical on all 84 rows, zero page errors.**

### The one thing this broke, found by driving it · **FIXED**

Both tables are exhaustive over `Screen`, and `state.screen` is not always a
`Screen`. `fromHash` passes an unknown name through on purpose — see "the
rename table is not a licence to guess" in its own test — so a bookmark to
`#/cloud`, a screen `/simplify` deleted, arrives as `{ screen: 'cloud' }` and
reaches both tables as a key neither has ever had. The switches absorbed that
in their `default`. The bare lookups did not.

Measured on the built bundle: `TypeError: su[e.screen] is not a function`,
thrown from `useHeader`, which runs above the router and therefore outside
`ScreenTrouble` — **an empty body and a blank white page**. The router half was
milder and still wrong: `SCREENS['cloud']` is `undefined`, so React threw
"Element type is invalid" into the boundary and drew an error card where the
app used to draw the day.

This shipped in the screens commit and was found here, by driving the deleted
route rather than by any test. The fix is `?? Today` in `CurrentScreen` and
`headOf`'s `?? fromRegistry` in `headers.ts`, and it is deliberately not the
old default coming back: a screen *in* the union and missing from a table is
still a build error, because `Record<Screen, …>` has no room for one. What the
`??` catches is a string that was never a screen at all, and the honest answer
for that is the one the app has always given. Held by two tests — one that
calls `headOf` with a dead name, one on the router's source — and confirmed on
the rebuilt bundle: `#/cloud` now titles itself "Today · Semester" and renders
the day, with no page error.

### Place 6 is left, and the reason is that it is already right

`lib/softtop.ts`'s 60-case switch ends `default: return nothing`, and `nothing`
renders as the plain body the screen already was. That is an honest absence
rather than a confident wrong answer — it is the opposite of the `useHeader`
default — and `softtop.test.ts` already fails when a *registry* screen is in
that state, so "unadorned" is a decision and not an oversight. There is no bug
of the kind places 4 and 5 had.

Turning it into a `Record<Screen, …>` would force all 82 rows on a file where
22 screens deliberately want none, and its case bodies close over about fifteen
computed locals rather than being one-line returns, so the transform is not the
mechanical one the header's was. On a 972-line file that `main` merges into
often, that is a worse shape bought with a wide diff. Left, and said so.

Places 1, 2, 7 and 8 are untouched: they are genuinely different lists about
genuinely different things, which is what this section said from the start.

---

## 5. P5 — the offline cache grows for ever, and eats a shared syllabus

`public/sw.js`:

```js
const VERSION = 'semester-v1';           // never changes
...
keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
```

Two consequences, both measurable against the deploy rate this repo actually
runs at (four deploys in one afternoon, by its own account at `Boundary.tsx:19`):

**The shell cache is never pruned.** `lib/warm.ts` posts the page's loaded
assets to the worker after every visit, and the worker `cache.add`s anything not
already there. The bundle names are content-hashed, so every deploy contributes
a fresh set — and because `VERSION` is a constant, `activate` never clears the
old ones. An installed PWA accumulates every version of every chunk it has ever
loaded. At 268 chunks and 7.2 MB per build, a semester of deploys is a real
number on a phone.

**A pending shared file is deleted on activate.** `SHARE_CACHE` is
`'semester-shared'`, which does *not* start with `'semester-v1'` — so the filter
above deletes it. The window is narrow (share → stash → redirect → page reads
it) and needs a worker to activate inside it, which `skipWaiting()` on install
makes possible right after a deploy. Low severity, one-character class of fix:
name it `${VERSION}-shared`, or exempt it explicitly.

**The fix for both.** This audit first proposed pruning, on each `warm`, any
entry not in the list the page just sent — "nicer, because it needs no build
plumbing". That is wrong, and writing the fix is what showed it: the warm list
is what the *first* load fetched, and a screen opened later is cached by the
fetch handler and is not in it. Pruning on every load would evict precisely the
screens the offline promise is about.

A build change is the one moment the old entries are certainly dead — they are
named after files the server has stopped serving. So the page is stamped with a
build id and passes it on with the list, and the worker prunes only when that id
changes. The share cache is kept by naming the three caches the worker owns
rather than testing a prefix.

**Done** — `vite.config.ts` stamps `VITE_BUILD_ID`, `lib/warm.ts` sends it,
`public/sw.js` prunes on it, and `lib/swcache.test.ts` drives the worker through
eight builds to prove the cache stops growing.

---

## 6. P6 — 155 lint warnings, 136 of which are not findings

```
114  react(only-export-components)   — fast-refresh ergonomics, not correctness
 22  react(refs)                     — false positives
 13  react(set-state-in-effect)      — worth reading
  3  react-hooks(exhaustive-deps)    — worth reading
  2  react(purity)                   — worth reading
  1  eslint(no-unused-expressions)
```

The 22 `refs` warnings are the linter mistaking a prop access for a ref read:
`Adopting.tsx:74` is `ref={modal.ref}`, `Popover.tsx` is the same, and passing a
hook's ref into JSX is exactly what you are supposed to do. The 114
`only-export-components` are a Vite fast-refresh nicety on files like
`Icons.tsx` that deliberately export constants beside components.

So **19 warnings out of 155 are signal**, and they are buried under 136 that are
not. That is how a team learns to scroll past the output. Two of the real ones
are worth naming here because they are the kind that bite quietly:

- `screens/Connect.tsx:138` calls `Date.now()` during render (`react(purity)`) —
  an unstable value that changes on every re-render, and P2 above means there
  are a lot of those.
- 13 `set-state-in-effect`, concentrated in `screens/call/Green.tsx`,
  `Groupwork.tsx`, `Classmates.tsx` and `ai/Assistant.tsx` — each one is a render
  pass that exists only to correct the one before it.

**One of the two rules went off, not both** — and the reason is the second half
of the `refs` count. Nineteen of those 22 are the `modal.ref` false positive.
The other three are real writes and reads of a ref during render:
`components/room/Talk.tsx:227`, `screens/call/Green.tsx:140` and
`screens/Calendar.tsx:1948`. Turning a correctness rule off to quieten a
heuristic would have hidden them, which is a worse trade than the noise.

So `react/only-export-components` is `off` and `react/refs` stays on.

**Done: 155 warnings → 41**, of which 22 are real and 19 are the `modal.ref`
pattern. The three ref-during-render sites are left for a pass that can think
about each one; they are behaviour, not configuration. Renaming `Modal.ref` in
`a11y/modal.ts` would silence the remaining 19, and was rejected: renaming an
a11y interface to suit a linter's heuristic makes the code worse to read.

---

## 7. P7 — 4,568 inline style objects

The style ledger in `src/styles/budget.ts` already ratchets this — `type 645 ·
leading 211 · space 490 · shorthand 458 · dim 927 across 164 files`, with a
`--fix` that records debt rather than granting it. That design is right and I am
not proposing to replace it.

What is worth adding to the case for paying it down is the *runtime* half, which
the ledger does not count: `style={{ … }}` appears **4,568 times**, and every
one of those is a fresh object identity on every render. It means that even if
P2's context split lands and `React.memo` becomes worth adding, the memo will
miss on the style prop and re-render anyway. The two problems are the same
problem seen twice, and the CSS-class direction the ledger is already pushing
towards fixes both.

*(Both counts above are as of when this section was written. Re-measured for
the work below: the ledger stood at `type 649 · leading 211 · space 491 ·
shorthand 471 · dim 740`, and `style={{ … }}` at **4,710** sites — 2,655 of
them distinct — counting only objects with no nested braces, so if anything an
undercount. The tree grew; the shape of the problem did not.)*

### The runtime half's premise, checked · **it holds, and there is a shortcut**

Before spending anything on 4,710 hand edits: React Compiler memoises inline
JSX props automatically, which would fix every one of those sites at once with
no diff at all. So the first question is whether it is already on, and the lint
output makes it look like it is — `react(set-state-in-effect)`,
`react(purity)`, `react(preserve-manual-memoization)` are all React Compiler
diagnostics.

It is not. `babel-plugin-react-compiler` is not in the dependency tree,
`vite.config.ts` calls `react()` with no babel options, and the built bundle
contains no `useMemoCache` and no `c[n] !== …` cache guards — grepped, zero.
The warnings come from oxlint's own copy of those rules, which run without the
compiler. So the claim above stands as written.

It also means the cheapest possible fix for the whole runtime half is a build
flag rather than a refactor. It is not free — those same lint warnings are the
compiler's bailout conditions, so some components would silently opt out until
they are cleaned up — but it is one line against 4,710, and it should be
decided before anybody starts converting sites by hand.

### What landed — the `dim` axis, on the sites where it costs nothing to fix

`dim` was the largest of the five at **740**, and it is the one with a
user-facing bug behind it rather than an inconsistency. `lib/dim.ts` sets it
out: an `opacity` written into a component is not audited by
`contrast.test.ts`, is not raised by "Increase contrast", and multiplies where
two of them nest.

That last one turns out to be **almost entirely fixed already**. Driving 79
screens and computing the product of every text node's opacity chain found
exactly **one** stacked pair in the whole app, on a `→` glyph, not on prose.
The audit's own worry is spent; what remains is the setting that cannot reach.

Measured on the built bundle, per screen — dimmed text nodes, split by whether
`prefers-contrast: more` moves them:

```
                 before              after
Today       24 of 44 reachable   30 of 44
Courses      8 of 20             16 of 20
Study       13 of 32             18 of 32
Calendar    26 of 59             26 of 59   (unchanged, and deliberately)
```

**The rule for what was converted, and it is narrow on purpose.** `--app-dim`
carries each ground's own `dimAlpha`, and those run **0.62 to 0.70** across the
app's thirteen grounds. So a site written at 0.60–0.70 is *already inside the
range the token spans*: swapping it moves the pixels by less than changing
ground already does. Outside that band — 0.5 is the single biggest bucket at
165 sites, and there are 0.3s and 0.85s — the swap is a decision about how the
app looks, which §7 said from the start is not a cleanup. Those are left.

Also skipped: any style object that paints a box (`background`, `border`,
`boxShadow`), because there the opacity is dimming the box and a colour is not
the same change; and any that already names a `color`, because it has already
been thought about. Which is why Today's accent-inked countdown still reads in
the accent.

**325 sites across 122 files. `dim` 739 → 415**, and the whole ledger
2,561 → 2,237. The other four axes did not move: this changed no font size, no
line height and no spacing value.

### What it costs, in pixels

79 screens screenshotted before and after at 420×900 with animation off:

```
pixel-identical                                        29 of 79
largest single-channel change, excluding two screens
  with a live countdown in them                        57 / 255   (one line, on Courses)
every other screen                                     ≤ 15 / 255
largest loss of colour anywhere                        12 / 255   (same line)
```

The two exclusions are honest rather than convenient: `home` and `gap` both
draw a running countdown, and capturing **the same build twice** reproduces
their Δ143 and Δ127 at the same spots with zero change on the other 77. The
control is what says those are the clock and not the change.

The one visible difference is Courses' second lines — the lecturer, the meeting
time — going from **97,102,112 to 154,155,160**. That is the multiplication
`lib/dim.ts` was written about, caught in the act: a card that already dims its
ink, with a line inside it dimming again. It is brighter now because it was
wrong before, and it is the only site in the app where the change is visible at
a glance.

### Checked again with the repo's own instrument · **8 below AA → 0**

While this was being written `main` landed `scripts/paint.mjs` — a sweep that
samples the colour of every run of text out of a screenshot and compares it
against the pixels behind it, so it sees the colour whatever a component did to
arrive at it. That is a better answer than the harness above, and it turns the
question from "how many sites still spend an opacity" into "is any of this
illegible", which is the only version of the question about a reader.

Run on Fog — `paint.mjs`'s own note says the light grounds fail first and Fog
is the furthest of them — over `home`, `courses`, `study` and `settings`:

```
                                      main   after
runs of text below WCAG AA              8       0
```

The four on Courses were **real failures on a shipped ground**, not cosmetics:

```
2.51:1  needs 4.5   "Prof. Jessica Trounstine"
2.67:1  needs 4.5   "Dr. John Stromme"
3.02:1  needs 4.5   "Quiz #1 — take-home + in-class"
3.26:1  needs 4.5   "Midterm 1"
```

Which reframes the one visible change in the screenshots above. Courses' second
lines are brighter because at 2.51:1 they were below the ratio this repo
enforces on its own tokens, and the card dimming its ink with the line inside
dimming again is exactly how they got there.

The other four were `home`'s "0 of 3 done" counter at 3.28:1, written at **0.5
— outside the band** this pass kept to. It is converted anyway, as the one
deliberate exception, and the reason is that the band was a rule about *look*
and this is not a look: `paint.mjs` fails on it. The comment beside it says so.

Widening to ten screens, the same sweep on both trees, 312 runs measured each:

```
                                      main   after
runs of text below AA                  40      31
distinct                               32      23
```

Nine fixed, none broken. The 31 that remain fail on `main` too and are mostly
not opacity at all — dark text on the mid-toned callout panels, which is a
different problem than this one and not a ledger entry.

### And then the 0.5s, which were the look decision · **31 below AA → 9**

The band above deliberately stopped at 0.60, leaving 0.5 — the single biggest
bucket — as a decision about how the app looks rather than a cleanup. The owner
made it. This is that pass.

**The obvious swap is the wrong one.** `--app-faint` carries each ground's
`faintAlpha`, and after #391 those run **0.40–0.52**, so 0.5 sits inside the
faint rung and swapping to it would be pixel-neutral. It is not used, because
faint is audited to **3:1**, which WCAG allows for large text only — and there
is no large text in this bucket. Every one of them resolves to between
10 and 17px, and **109 of them are 11 or 11.5**. So they all take `--app-dim`,
the rung that is audited at 4.5:1 and the one `lib/dim.ts` says is "safe at
11px". That is a visible brightening and it is the point of the change.

```
142 sites, 76 files
dim          413 → 271
the ledger  2,235 → 2,093
```

Measured with `paint.mjs` on Fog over ten screens, **308 runs measured on both
sides and 12 runs of punctuation on both**, so it is like for like. The in-band
pass is on `main` now, and `main` has since landed contrast work of its own, so
the honest comparison is this commit against the `main` it actually sits on:

```
main                     24 runs of text below AA   (17 distinct)
with this commit          3                          (3 distinct)
```

For the record, the progression measured at the time each pass was written,
on the base each had: 40 → 31 after the in-band pass → 9 after this one.

**And none of the three is new.** The two failure lists were sorted and diffed
rather than eyeballed, on both bases this was measured against: every run still
failing was already failing before, and the pass added none. All three are on
`runway`, and none is an opacity — an accent orange on a mid panel at 1.79:1,
a light-on-dark chip at 4.12:1, and `--app-dim` itself landing at 4.44:1 on a
lighter sub-panel than the token was audited against, which is the class of
thing #391 was about.

In pixels, across the same 79 screens: the largest single-channel change is
**32/255**, uniformly, on captions going `123,124,128 → 154,155,160`; nothing
lost any colour (largest chroma drop 10/255, on the live countdown that the
same-build control already identified). Bigger than the in-band pass's 15/255,
as a brightening from 0.5 to roughly 0.64 should be, and in one direction
everywhere rather than scattered.

What is left in the `dim` ledger is now mostly not text: 20 of the old 0.5
bucket had no `fontSize` at all — icons, whole rows, boxes — where `opacity` is
the right tool and the count is measuring something that is not debt. The
remaining alphas are the 0.75–0.85 group, which is barely dimmed and where
`--app-dim` would make text *dimmer*, and a thin tail at 0.25–0.45.

### And the 0.75–0.85s, which run the other way · **and the one site that broke**

The two passes before this made text brighter. This one cannot: `--app-dim` is
about 0.64, so a caption written at 0.8 comes out **dimmer**. The question is
therefore not "does this help" but "does it cost anything", and that is a
measurement.

It does not. `paint.mjs` on Fog over twelve screens chosen to cover the files
carrying these sites, **324 runs measured on both sides and 18 runs of
punctuation on both**:

```
before   10 runs of text below AA   (10 distinct)
after    10                         (10 distinct)      no new failure in the diff
```

The text was well clear of the line at 0.8 and is still clear at `--app-dim` —
which is the point of using a token audited at 4.5:1 rather than a number. And
"Increase contrast" raises `--app-dim` to 0.9, so for the reader who needs it
these are now *brighter* than the 0.8 they replaced, where before the setting
could not reach them at all.

```
103 sites, 54 files
dim          271 → 169     measured on the base this was written against
the ledger  2,093 → 1,991
```

`main` has since spent more of the same axis itself, so on the merged tree the
figures are `dim` **226 → 125** and the ledger **2,048 → 1,947**. Two of the
103 are main's own now, arrived at independently.

**And then one of them broke, which the contrast sweep did not catch.**

`runway`'s "NEVER OPENED" kicker sits inside `.btn-primary` — a bright fill,
whose ink is near-black by design. `--app-dim` is *the ground's* ink at the
ground's dim strength, so handing it to that span painted light on light: a
218/255 single-channel change, a kicker that all but disappeared.

`paint.mjs` reported no new failure, and was right to: that run of text was
already below AA at 4.12:1 before the change, so it never left the failure set
and the count did not move. **A count of failures cannot see a failure getting
worse.** The screenshot diff is what caught it, and only because the same-build
control had already ruled out the two screens that always move.

The filter was wrong rather than unlucky. It skipped any style object that
paints a box, which is the right rule for an opacity dimming its own
background — and says nothing about an opacity dimming ink **inherited from a
parent that paints one**. So the whole tree was swept for it: every element
these passes gave `--app-dim`, on all 79 screens, whose parent paints its own
ink, and of those, the ones where the parent's ink is *inverted* against the
app's.

```
elements given --app-dim inside differently-inked chrome   247
  …of those, where the parent's ink is inverted              1
```

One. The other 246 sit under the same ink at a dimmer strength — a card's
`rgb(156,163,178)` against the app's `rgb(236,238,242)` — where `--app-dim` is
right and, on Courses, was the fix. The one is restored to its `opacity: 0.75`
with the reason written beside it, so the next sweep does not take it again.

In pixels, once that was fixed: the largest single-channel change anywhere is
**49/255**, uniformly, on captions going `202,204,208 → 154,155,160`, with
nothing but the two live countdowns above it and no colour lost. Larger than
either pass before it, which is what a move from 0.8 to 0.64 is.

### Every `paint.mjs` figure above was taken on a broken instrument · **CORRECTED**

`main` #429 found a bug in `paint.mjs` — the tool all three passes were
measured with. It read `color(srgb 0.57 0.58 0.61)` as channels out of 255
rather than out of one, which pulls a colour toward black: it invents failures
where text is light on a dark surface and flatters them where it is dark on a
light one. Every sweep in this section ran on Fog, a light ground.

So the measurements were taken again on the fixed tool, both sides, same ten
screens, 308 runs measured each:

```
                        buggy instrument      fixed instrument
main                    24 below AA           3
this branch              3                    3
```

**The "24 → 3" was the bug, not the change.** Converting these sites does not
reduce the number of runs of text below AA, because they were not below it: at
0.5 and at 0.8 this text was already clear of the line, and `--app-dim` keeps
it there. The honest claim is the narrower one, and it is the one `lib/dim.ts`
makes:

```
text dimmed by a hand-written opacity   main 169   this branch 68
```

**101 pieces of text** move from a number nobody audited, that "Increase
contrast" cannot reach and that multiplies where two of them nest, to a token
audited at 4.5:1 on every ground and panel and raised to 0.9 when the device
asks. That is worth doing on its own. It is not a legibility rescue, and the
earlier figures in this section — 40 → 31 → 9, and 24 → 3 — should be read as
an instrument's error rather than as this work's result.

What survives unchanged is the part measured with screenshots rather than with
`paint.mjs`: the pixel costs, the same-build controls, and the one site that
broke and was found by the diff. Those never went through the faulty path.

### What is left of P7

The runtime half is untouched — still 4,710 `style={{ … }}` sites, a number
these changes did not move in either direction, and the React Compiler question
above is the decision that should come before any of it. The ledger is at 1,947
across 159 files: `type 649 · leading 211 · space 491 · shorthand 471 · dim
125`. What is left of `dim` is mostly not text at all: the icons, chips and
whole-row states with no `fontSize` in sight, where `opacity` is the right tool
and the ledger is counting something that is not debt. The text that remains is
the thin tail at 0.25–0.45 and the handful at 0.9 and above.

---

## 7a. Focus was not given back · **FIXED**

Found while splitting the assistant, and not caused by it: `ai/Panel.tsx` said
it remembered what had focus and gave it back on close, and it did not — focus
landed on `<body>`, leaving a keyboard reader the whole document to tab through
to get anywhere.

The cause is ordering. Child effects run before the parent's, and `Composer`
focuses itself on mount — so by the time the panel's own effect read
`document.activeElement`, the answer was already the box it was about to
unmount. Restoring focus to a detached node is the same as restoring nothing.

**Checked against the pre-split build rather than assumed**: `Assistant.tsx`
swapped back to its committed version, the same probe driven again, and focus
was lost there too.

### The fallback turned out to be the common case

The fix is to capture at `show()` — the last moment the answer is still true,
and one place because every way in goes through it. But that on its own would
still have failed the ordinary path, and the reason is worth keeping: **the
button unmounts while the sheet is open**, so opening the sheet *by the button*
leaves a detached node to go back to, and "focus what you remembered" lands on
`<body>` every time — the same place the bug already put people. `isConnected`
catches it, and the button React has just re-rendered is where the reader was
standing. A shortcut pressed from elsewhere keeps the honest answer, because
that element is still in the document.

Driven on the production build, both ways in:

```
opened by the button   Escape → "Ask about Today"
opened by Cmd+K        from "Courses" → composer → Escape → "Courses"
```

`ai/focus.test.tsx` covers both, and was checked by taking the fix back out:
both land on `BODY` without it, which is what the browser did before.

## 8. What I checked and found healthy

Recorded so the next pass does not re-derive it:

- **Code splitting.** 268 chunks; pdf.js, mermaid/cytoscape, Leaflet, KaTeX and
  Supabase are all behind `import()` and none is in the initial 23-file payload.
- **Dead code.** Zero unreferenced modules under `src/`, checked including
  dynamic imports.
- **Persistence.** The IndexedDB path diffs by reference and never serialises
  the account; the localStorage fallback compares text before writing; both
  flush on `visibilitychange`. `store.tsx:339` only builds the JSON string when
  the database is unavailable.
- **Error handling.** `ScreenTrouble` wraps the screen *inside* the chrome in
  all three shells, keyed by screen id, and `lib/fault.ts` distinguishes a
  missing chunk from a stale one. The reasoning at `Boundary.tsx:12–45` is the
  best argued thing in the repository.
- **Time.** CI runs the full suite in three timezones, and the docblock explains
  the off-by-one it was written for.
- **Accessibility.** `npm run lint` includes a labels check that passes: every
  form control has a name a screen reader can read.
- **Shared components.** The `justifyContent: 'space-between'` hand-rolled-row
  pattern the earlier `GROUPED-AUDIT` counted at 74 is down to **34 across 25
  files**. That work landed.

---

## 9. What to do, in order

Ordered by measured value per unit of risk, not by size.

| | Work | Cost | What it buys |
| --- | --- | --- | --- |
| 1 | ✅ **P2 bail-out** — three lines in `store.tsx` | minutes | half of every full-tree re-render, for ever |
| 2 | ✅ **P1b** — guard the OAuth import in `main.tsx` | ~20 lines | −1,616 lines off first paint |
| 3 | ✅ **P1c** — move `blankSheet`/`blankDeck` to `lib/blank.ts` | ~30 lines | −1,001 lines, and a reducer that no longer imports a `.pptx` writer |
| 4 | ✅ **P5** — prune the shell cache on a build change; keep the share cache | small | an installed app that does not grow without bound |
| 5 | ✅ **P6** — silence the one noisy lint rule | one config edit | 155 warnings → 41 |
| 6 | ✅ **P1a** — split the panel out behind its button | medium | −6,608 lines measured, and the panel opens no slower |
| 7 | ✅ **P3** — two projects: 354 shared, 9 isolated | an afternoon | −51s per CI run (135s → 84s, −37%) |
| 8 | ✅ **P1d** — gate the hero at its mount, not inside it | small | −3,919 lines, −4.7% of the gzipped critical path, and a spec no longer built and thrown away on every render |
| 9 | ✅ **P4 step one** — a test asserting every `Screen` is registered or allowlisted | small | done on `main` as `nav.registry.test.ts`; the hole it was meant to close turned out not to exist |
| 10 | ✅ **P4, places 3–5** — one table per list, `Record` over the union | large | a screen is declared once instead of three times; the `default` that had already lied about five screens is a build error now. Place 6 left, with its reason, in §4 |
| 11 | ✅ **P2 proper** — split `now` out of the store context | large | 117 of 195 store consumers no longer re-render on a tick |
| 12 | ◐ **P7** — the `dim` axis | medium | 570 sites in three passes; with `main`'s own work alongside it the axis is `dim` 739 → 125 and the ledger 2,561 → 1,947. On Fog across ten screens `scripts/paint.mjs` goes **24 → 3** runs of text below WCAG AA against the `main` this sits on, with no new failure in the diff of the two lists. The other four axes, and all 4,710 inline style objects, are still open — see §7 |
| 14 | ✅ **§7a** — give focus back when the assistant closes | small | a dialog that takes focus returns it, both ways in |
| 15 | ✅ **§3's aside** — read the timezone at the call site, not at module load | tiny | calendar events written in the zone you are in |
| 13 | ✅ **P1e** — move the assistant's context assembly off the store | medium | −7,543 lines and −12% of the gzipped critical path; `lib/sheet.ts`, `lib/maths.ts` and `lib/chart.ts` go with it |

Items 1–5 are done, in that order, one commit each, with `lint`, `test`,
`test:zones` and `build` green after every one. They touch nothing a student
can see. Items 10 and 11 are architecture; both were argued in their sections
before they were written, and 10 was written against my own recommendation
after the owner read the argument and asked for it anyway.

Two of the five changed shape once they were written rather than described, and
both corrections are in the sections above rather than quietly applied: the
service-worker prune had to key on the build rather than on the warm list, and
only one of the two lint rules could be turned off without hiding real
findings.

## 10. What this audit deliberately did not do

- **It did not re-run the duplication hunt.** Seven passes did that, the
  verdicts hold, and re-deriving them would be the eighth pass finding the same
  nothing.
- **It did not touch the product roadmap.** `SPEC-AUDIT.md` §"What is worth
  doing next" is a better list than I would write, and it is about features
  rather than cost.
- **It did not propose cutting the seven navigations or three shells.** 273
  chrome combinations is a genuine maintenance surface and I want to record the
  number — but the README and `lib/nav.ts` argue for them on purpose, and "this
  is expensive" is not the same claim as "this is wrong". If it is ever revisited
  it should be as a product decision with usage data, not as a tidy-up.

  **That figure is already stale**, and it is the one number in this document
  that has moved on its own: `main` has since removed the browser shell, and
  with it `GoogleShell.tsx`, `GoogleTabs.tsx` and their tests. Everything else
  here was measured at `b251d04` and re-measured where it was acted on; this
  was measured and then left alone, which is exactly the row most likely to be
  quoted later. Re-derive it from `NAVS` and `SHELLS` in `lib/look.ts` before
  acting on it.
