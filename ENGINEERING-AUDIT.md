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
| P1a | `App.tsx` → `ai/Assistant.tsx` | **20 modules, 7,287 lines** | `<Assistant />` is mounted unconditionally in all three shells |
| P1b | `main.tsx` → `lib/connect.ts` | **2 modules, 1,616 lines** | to read `?code=` off the URL |
| P1c | `state/slices/made.ts` → `lib/decks.ts` → `lib/pptx.ts` | **2 modules, 1,001 lines** | for `blankDeck()`, a 14-line factory |
| P1d | `components/soft/SoftTop.tsx` → `lib/softtop.ts` | **3 modules, 1,518 lines** | needed only when `shell === 'soft'`, one of three |

**Cutting all four: 287 → 258 modules, 86,319 → 73,402 lines. −15% of the
critical path**, with no feature removed and no screen changed.

### What each one actually is

**P1a — the assistant is mounted, not opened.** `App.tsx:1294`, `:1741` and
`:1863` render `<Assistant />` in every shell so there is exactly one of it,
which is right. But the component is statically imported at `App.tsx:149`, so
the whole conversation stack — `converse.ts`, `Turns`, `Composer`, `Actions`,
`lib/tools.ts` (939 lines), the provider tree — is parsed on first paint for a
panel that opens on a tap. The button is small; the panel is not. Split them:
the floating button stays eager, the panel becomes `lazy()` behind the same
`open` state it already has.

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
a DOM. It is also only read when the *Soft* shell is on. `SoftTop.tsx` can take
it through `import()` behind the same condition that decides to draw it.

### Two cuts that measure as zero, and why that matters

I also tried `state/store.tsx` → `lib/claude.ts` (1,641 lines) and
`state/store.tsx` → `lib/export.ts` (668 lines). **Both save nothing**, because
other eager paths already reach them — `App.tsx:170` imports `provider` from
`lib/claude`, and eight components import `ask`. Worth recording so nobody
"fixes" them and measures no change: after P1a–P1d, the second pass is
`App.tsx:170` plus the `lib/sheet.ts` importers, and those need their own
measurement, not a guess.

### What landed

P1b and P1c are done. Measured after, the same way:

```
287 modules, 86,319 lines  →  285 modules, 83,903 lines
initial gzipped JS: 346,504 bytes  →  335,358 bytes
```

`lib/connect.ts`, `lib/decks.ts` and `lib/pptx.ts` are off the critical path
entirely. `lib/sheet.ts` is still on it, and the trace says why: after the
reducer stopped importing it, `ai/providers/make.ts` is the remaining eager
path — so it leaves with P1a, not before. That is the shape of this work, and
the reason each edge is measured rather than argued.

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

**The real fix** is to take `now` out of the omnibus context — its own provider,
read through a `useNow()` hook by the handful of components that show a relative
time. Then the minute boundary re-renders a countdown and a class rail rather
than sixty screens' worth of tree. That is a larger change and wants its own
pass; the bail-out above is worth taking today regardless, because it is correct
on its own terms even if the context is never split.

---

## 3. P3 — CI spends about two and a half minutes spawning test workers

Vitest reports it itself, at the end of every run:

```
Isolate  336 workers spawned · ~244ms startup each (spawn + environment, per file)
         at least ~27.09s faster with isolate: false
```

Of a 48-second suite, **27 seconds is process startup** — 56%. And CI runs the
suite **three times**: `npm test`, then `npm run test:zones`, which is the same
suite again under `TZ=America/Chicago` and `TZ=Pacific/Kiritimati`. That is
roughly **80 seconds per CI run** spent on worker spawn.

`poolOptions.threads.isolate: false` is the setting. It is not free: it reuses a
worker across files, so any test leaning on a fresh module registry, a clean
`localStorage`, or a global mutated at module scope can start failing. With 335
files some will. The work is: turn it on, see which files break, and either fix
their setup or list them under `poolOptions.threads.isolate` exceptions. A
one-off afternoon against a saving taken on every push, three times.

---

## 4. P4 — a screen is registered in eight places

Adding or removing one destination today means editing, at minimum:

1. `lib/types.ts` — the `Screen` union (82 members)
2. `lib/nav.ts` — the registry row: label, blurb, keywords, group, taskTags
3. `App.tsx` — the `lazy()` const (82 of them, lines 41–133)
4. `App.tsx` — a case in `CurrentScreen` (the switch at `:949`)
5. `App.tsx` — a case in `useHeader` (the switch at `:266`)
6. `lib/softtop.ts` — a case in the 60-case hero switch
7. `lib/role.ts` — the student-only / faculty lists
8. …then whichever of `lib/springboard.ts`, `lib/capture.ts`, `lib/guidebook.ts`
   applies

Grepping one destination — `'tonight'` — finds it in **10 files**.

This is not duplication in the sense the simplify passes were hunting; every one
of those lists is about a genuinely different thing. It is *co-location*: eight
lists keyed by the same value, kept in step by hand.

**The symptom is already visible in the numbers.** The `Screen` union has 82
members and the registry has 60. Twenty-two screens exist, render, and are
navigable, but carry no `blurb`, no `keywords` and no `taskTags` — so the
directory does not list them and search cannot find them. Some of that is
correct by design (`search` and `directory` are the shell looking at itself, and
`lib/types.ts:481` says so). Some of it is a screen that quietly fell out of the
index.

**The shape of the fix**, if it is worth doing: one module per screen exporting
everything that screen needs registered — the lazy component, the header, its
soft-top facts, its registry row — and `nav.ts` built by collecting them. The
registry stays the one list it already is; the three switches in `App.tsx` and
`softtop.ts` become lookups; adding a screen becomes adding a file.

That is a large refactor of a working app, so it belongs on a branch of its own
and probably behind a cheaper first step: **a test that asserts every `Screen`
union member either appears in `DESTINATIONS` or is on an explicit
shell-screens allowlist.** That closes the findability hole this week, and turns
the eight-place registration from an invisible cost into a named one.

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

---

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
| 6 | **P1a** — lazy the assistant panel behind its button | medium | −7,287 lines, the single largest cut |
| 7 | **P3** — `isolate: false`, then fix what breaks | an afternoon | ~80s per CI run, three runs deep |
| 8 | **P1d** — lazy `softtop.ts` behind the soft shell | small | −1,518 lines |
| 9 | **P4 step one** — a test asserting every `Screen` is registered or allowlisted | small | closes the 82-vs-60 findability hole |
| 10 | **P4 proper** — one module per screen | large, own branch | adding a screen becomes adding a file |
| 11 | **P2 proper** — split `now` out of the store context | large | the minute boundary stops being an app-wide event |
| 12 | **P7** — keep paying the style ledger down | ongoing | the memoisation in 11 becomes worth having |

Items 1–5 are done, in that order, one commit each, with `lint`, `test`,
`test:zones` and `build` green after every one. They touch nothing a student
can see. Items 10–11 are architecture and should be argued before they are
written.

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
