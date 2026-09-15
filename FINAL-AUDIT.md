# Final audit: every gate, every screen, every pairing

A whole-application pass at `698c7de`, on Node 22.22.2, asking the three
questions the request asked: **what is broken, what is unbuilt, and what is
worth upgrading.**

The short answer to the first is *nothing found*, and that sentence is only
worth anything with the evidence under it — so what follows is every
measurement, the command that took it, and, where a measurement came back
clean, what was done to prove the instrument could have said otherwise.

Three of this audit's own probes were wrong before they were right. Each is
written up where it happened, because a clean reading from a dead probe is the
failure mode this repository keeps finding, and an audit that hides its own is
not worth reading.

---

## 0 · The gates

Every command from `app/`. All seven green.

| Gate | Result |
| --- | --- |
| `npx tsc -b` | exit 0 |
| `npm run lint` | exit 0 — **25 warnings against a ceiling of 25** (§3.1) |
| `npm test` | 437 files, **8,703 passed**, 10 skipped, exit 0 — 53.9 s |
| `npm run test:shuffle` | 437 files, 8,703 passed, 10 skipped, exit 0 — 48.1 s |
| `npm run test:zones` | exit 0 in `America/Chicago` **and** `Pacific/Kiritimati` |
| `npm run build` | exit 0 — 12.7 s |
| `npm run check:university` | exit 0 |

The 10 skips are not deferred work: they are `describe.skipIf(!KEY)` in
`src/ai/voice.live.test.ts`, a live-model suite that runs when an API key is
present. `state/contract/adapt.test.ts` carries a note explaining that four
other tests were *deleted* rather than skipped, because the second client they
were written against no longer exists. There is no `.skip` in the tree standing
in for something unfinished.

Census: 673 production files / 221,828 lines; 436 test files / 92,656 lines
(0.42 test lines per production line). 72 screen components against a 74-member
`Screen` union, 153 components, 323 `lib` modules. `TODO`/`FIXME`/`HACK` in
production code: **0**. `@ts-ignore` and `@ts-expect-error`: **0**. Empty
`catch` blocks: **0**.

---

## 1 · What was driven in a real browser

The suite is large, but it is not the app. Everything below is headless
Chromium against `npm run dev`, phone viewport unless stated.

| Sweep | Scale | Result |
| --- | --- | --- |
| Every id-less screen | 62 screens | all render, **0 pageerrors** |
| Every id-bearing screen | 11 routes, with and without an id | all render, 0 pageerrors |
| Every layout × navigation | **18 pairings** (3 shells × 6 navs) | all render, 0 pageerrors |
| Every control, adoption skipped | **602 clicks** | 0 errors |
| Every control, courses adopted | **387 clicks** | 0 errors |
| Every text field, hostile values | **530 values** into 71 fields | 0 errors |
| Keyboard focus | **425 controls tabbed** | every one draws a ring |
| Viewport widths | 9 widths × 20 screens | no horizontal overflow |
| Onboarding → adopt → reload | full path | state survives |
| Contrast, light grounds | 1,607 elements, 48 passes | **0 findings** |
| Contrast, resting + hover | 880 elements, 168 passes | **0 findings** |

989 controls clicked and 530 hostile values typed — empty, `-1`,
`999999999999`, a 2,000-character string, `<script>alert(1)</script>`, a
ZWJ emoji family, a quote-and-comment SQL fragment, whitespace, `NaN` —
produced no thrown error, no unhandled rejection and no console error
anywhere.

### 1.1 · The adoption path end to end

The path every other sweep skips. `Set it up` → `Looks right` → school →
`Next` → `Start the semester` → `#/edit/econ` → `Make these mine` → reload.

Measured in IndexedDB rather than in `localStorage`, which is the correction
described in §2.3: `semester-store.courses` goes **0 → 4** on adoption, is
still 4 after a full page reload, and `#/edit/econ` — which before adoption
draws the "shipped with the app" note and no form — comes back with **33 live
inputs**. Persistence is real and survives restart.

### 1.2 · The six navigations are genuinely six

`useShell` returns plain for any value it does not recognise and the nav reader
does the same, so a retired value comes up working, wrong and silent. Seeding a
deliberately invalid `nav: 'bogusvalue'` renders **byte-identical to
`workspace`** — confirming the fall-through is live — while all six real
navigations produce distinct class sets and distinct copy (`guides` → "Guides",
`feed` → "Everything", `springboard` → `.iconshape` ×11, `shelves` →
`.shelf-nav`, `workspace` → `.deskwork`, `tabs` → `.app-tabs`). No navigation
is a silent duplicate of another.

---

## 2 · Three probes that lied

### 2.1 · The focus-ring probe: 25 false findings

A first pass called `el.focus()` on every control and asked whether a ring was
painted. It reported **25 distinct classes of control across 20 screens with no
focus ring** — which would have been a serious regression against `aa912f5`,
the commit that fixed exactly this.

It was the probe. Chromium does not match `:focus-visible` on programmatic
focus for most elements, so the probe was asking for a ring that only keyboard
focus draws. Re-run with real `page.keyboard.press('Tab')`: **425 in-main
controls, every one with a visible ring, zero findings.** The fix in `aa912f5`
holds.

### 2.2 · The overflow probe: nine clean widths that measured nothing

The responsive sweep used `documentElement.scrollWidth - clientWidth` and
reported no overflow at any of nine widths. Injecting a **900 px box into a
320 px viewport still reported zero** — the app's scroller is `.scrollarea`,
not the document, so the document never overflows whatever happens inside it.

Rebuilt to compare element rects against the viewport and verified against the
same injection (caught it: `right=900, vw=320`). Re-run across 9 widths × 20
screens: the only elements past the viewport edge are `IMG.leaflet-tile` on
`#/maps`, which is how a slippy map works. **No real overflow at 320–1920 px.**

### 2.3 · The persistence probe: looking in the wrong store

The adoption sweep read `localStorage['semester.v1']` after `Make these mine`
and reported `{}` — no courses saved. The store of record is IndexedDB
(`state/persist/db.ts`); `semester.v1` holds only the look and the schema
marker. Measured in the right place, adoption persists (§1.1).

### 2.4 · And one control that passed

Before trusting the 989-click result, a button that throws synchronously and a
button that leaves a promise rejected were injected into a live screen. The
harness caught both. The clean reading is a reading, not a silence.

---

## 3 · What is worth fixing or upgrading

Nothing below is a defect on screen. These are the standing risks the sweeps
turned up.

### 3.1 · The lint gate has zero headroom — the one actionable item

`npm run lint` runs `oxlint --max-warnings=25` and the tree currently holds
**exactly 25**:

| Rule | Count |
| --- | --- |
| `react(set-state-in-effect)` | 12 |
| `react(purity)` | 4 |
| `react(preserve-manual-memoization)` | 4 |
| `react(refs)` | 3 |
| `react-hooks(exhaustive-deps)` | 2 |

Proven rather than inferred — at a ceiling one lower, the gate is already red:

```
npx oxlint --max-warnings=24 src   → exit 1
npx oxlint --max-warnings=25 src   → exit 0
```

So the **next React warning anyone adds anywhere in `src` turns the gate red**,
and because the cap is global it turns red for whoever pushes next rather than
for whoever caused it. The ceiling was argued for deliberately (45 → 25, capped)
and is not something to re-tune on an audit's say-so — but the budget is spent,
and the way to buy headroom is to retire warnings, not to raise the number.

**The 12 `set-state-in-effect` warnings are where the headroom is**, and they
are also the only entries on the list with a user-visible cost: each is a
`setState` called synchronously inside an effect, which starts a second render
pass. They sit in `ai/Panel.tsx`, `components/room/Talk.tsx`,
`components/Drawing.tsx`, `screens/Guide.tsx`, `screens/call/Index.tsx`,
`screens/call/Green.tsx` (×2), `screens/Groupwork.tsx` (×2),
`screens/Import.tsx` and `screens/Classmates.tsx` (×2).

### 3.2 · One of the 25 is a false positive whose fix would be a bug

`react-hooks(exhaustive-deps)` at `lib/folds.hook.ts:165` calls `at` an
unnecessary dependency. It is not: `at` is the `useSyncExternalStore` stamp,
and it is the *only* thing that tells the memo the fold store moved — the
values inside are read fresh from module state the linter cannot see. The line
above it already says so in a comment. **Removing that dependency would freeze
the fold-all button**, and it is worth writing down that the warning is load-
bearing before somebody clears it to buy a slot under §3.1.

(The other one, `Bill.tsx:69`, is genuinely redundant — `state.term` is reached
through `state`, which is already a dependency. Harmless either way.)

### 3.3 · The contrast sweep cannot see gradients

`npm run sweep:contrast` reports its own blind spot and it is large. Across the
two narrowed runs it declined to measure **585 and 328 elements respectively,
"on a gradient"** — between a quarter and a third of everything on screen. Text
on a gradient is never contrast-checked by either instrument: `lib/contrast.test.ts`
audits tokens, and tokens are flat by definition.

Given that CLAUDE.md records the fade rungs having been measured against the
wrong surface *twice*, a gradient-aware sampler — read the composited pixel
under the glyph rather than the declared background — is the highest-value
addition to the instrument, not to the app.

Second, thinner point: with states enabled, the sweep flags `⚠ 40 measured
nothing` of 84 passes per ground, and hover covers only 84 elements across 144
passes. The hover axis is close to unmeasured.

**Not completed here:** the full `sweep:contrast` (6 navs × 13 grounds × 2
viewports × states) ran for over an hour and was still going when the dev
server was stopped under it — it died on `fog`, the thirteenth and last ground,
without printing a summary. This audit does not claim its result. Budget well
over an hour for a full run, and do not stop the server while one is in
flight. Two narrowed runs stand in for it — the four light grounds
(`parchment`, `paper`, `bone`, `fog`), which is the class CLAUDE.md names as
recurrently wrong, and a resting-plus-hover pass on `paper` and `ink`. Both came
back **0 findings**. A full run is still owed.

### 3.4 · An unknown look value fails silently

§1.2 proved `nav: 'bogusvalue'` renders as `workspace` with nothing logged, and
`useShell` does the same for shells. That is a reasonable default and a poor
diagnostic: it is the documented cause of at least one sweep in this repository
reporting seven distinct runs when it had really made six. Normalising unknown
values on read — and saying so once in the console — would close a whole class
of "the seed looked like it took".

### 3.5 · Bundle

First load is **275.6 kB gzipped across 16 files** (140.1 kB `index`, 95.1 kB
`store`, 18.2 kB CSS, the rest under 5 kB each) — consistent with the 274.3 kB
that `IMPROVEMENT-AUDIT.md` measured, with main's work since in it. 282 JS
chunks total.

The build emits exactly one warning, for `chunk-FOHPRMQF` at **647 kB raw /
138.9 kB gzipped**. It is Mermaid's shared diagram core, imported only by the
per-diagram chunks, so it is **not** in the first load and nobody pays for it
until they render a diagram. Worth knowing, not worth splitting.

---

## 4 · Unbuilt features

There are no half-built screens. Every route in the `Screen` union renders,
every registry destination is reachable, and `findable`, `nav.registry`,
`deadends` and `contrast` pass together (44 assertions).

What is genuinely absent is absent by configuration, and every one of those
places says so in plain language rather than failing:

- **The account service.** `lib/cloud.ts` rejects with "No account service is
  configured for this build," and `Classmates`, `Account`, `Onboarding`,
  `Privacy`, `call/Green` and `call/Lobby` each carry their own honest note.
  Sign-in, sharing and multi-party calling are gated on it.
- **The institution gateway.** `server/institution/` is real code — adapters,
  auth, an encrypted action journal — with an empty production adapter
  registry. `University` reports "Preparation only, across 37 areas", which is
  the accurate claim: 37 prepared areas, not 37 live integrations.
- **Everything else** is already catalogued honestly in
  `docs/IMPLEMENTATION_STATUS.md`, which states outright that this build "is
  not yet a complete replacement for a university's LMS, email, registration,
  billing or campus-service systems" and lists, per workflow, what remains for
  official operation. That document is current and this audit found nothing to
  add to it.

---

## 5 · The conclusion

All seven gates green. 8,703 tests passing in file order and in shuffled order,
in two timezones fourteen hours apart. 74 screens, 18 layout-and-navigation
pairings, 989 controls, 530 hostile inputs, 425 keyboard stops and 9 viewport
widths, all in a real browser, with **zero pageerrors, zero unhandled
rejections and zero console errors** — against a harness proven able to catch
all three.

No bug was found. The work worth doing is in §3: retire the
`set-state-in-effect` warnings to buy back the lint budget that is currently
spent to the last unit, teach the contrast sweep to read gradients, and stop an
unrecognised look value from passing for a valid one.
