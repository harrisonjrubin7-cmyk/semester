# What is still worth improving, and what it is worth

A pass over the whole application asking one question the four audits before it
did not: **where is this app still paying for something, and how much?**

`SIMPLIFY-AUDIT.md` asked whether it does the same job twice (seven times, and
the answer settled at no). `SPEC-AUDIT.md` asked what is missing against the
product vision. `ENGINEERING-AUDIT.md` asked what the code costs to open,
render, test and extend, and closed six of its thirteen items. `APP-AUDIT.md`
and `docs/APPLICATION_AUDIT.md` swept the screens for things that break.

So this one re-measures, closes six of the things left open, finds four that
were not on anyone's list — including a live bug that makes `npm test` red on
`main` while reporting that everything passed — and reports one change that
looked like the largest remaining win and **should not be made yet**, with the
evidence for why.

Everything below is measured, with the command that measured it. Measured at
`253d34f` (the baseline) and re-measured at `5f3406f` (this branch), on Node
22.22.2.

`main` moved on under this branch while it was being written — thirty commits,
a spreadsheet function library, document layout, sound — and it has been merged
in. **Every figure below is the pair measured at `253d34f` and `5f3406f`**,
which is what isolates what this branch did; the numbers on the merged head are
different because main's own work is in them. The one that moved most: first
load is 280.3 kB gzipped after the merge, because main added about six of its
own — the −6.6 kB this branch cut is still cut, and neither API client is in an
eager chunk.

---

## 0. The baseline

Run from `app/`, on a clean `npm install`:

| | Baseline `253d34f` | This branch `5f3406f` |
| --- | --- | --- |
| `npx tsc -b` | exit 0 | exit 0 |
| `npm run lint` | exit 0, 45 warnings, no ceiling | exit 0, **25 warnings, capped at 25** |
| `npm test` | 372 files, 7,678 passed, 10 skipped — **exit 1 on some runs**, see §2a | 376 files, 7,687 passed, 10 skipped, exit 0 |
| `npm run test:zones` | exit 0, twice | exit 0, twice |
| `npm run build` | exit 0 | exit 0 |
| `npm run check:university` | exit 0 | exit 0 |
| First load, gzipped | **280.9 kB** | **274.3 kB** |
| Suite wall clock (warm) | ~41.9 s | ~42 s |

The census, for anyone quoting it later:

```
find src -name '*.ts' -o -name '*.tsx' | grep -v '\.test\.' | wc -l
```

| | |
| --- | --- |
| Production TypeScript | 201,502 lines across 630 files |
| Tests | 78,660 lines across 371 files (0.39 test lines per production line) |
| `lib/` modules | 293 · screens 100 · components 145 |
| `Screen` union · registry destinations | 82 · 60 |
| `TODO`/`FIXME`/`HACK` in production code | **0** |
| `console.log`/`warn`/`error` in production code | **1** |
| `any`, `@ts-ignore`, `@ts-expect-error` | 22 |

That last block is the reason this audit had to go looking rather than
skimming. There is no low-hanging fruit here; the findings below are all
things you have to measure to see.

---

## 1. The first paint was carrying an API client · **fixed**

`ENGINEERING-AUDIT.md` §1 took five bites out of the critical path and stopped.
This is the sixth, and it is the last one of that shape.

Two imports did it:

```
src/App.tsx:170        import { provider } from './lib/claude';
src/state/store.tsx:25 import { setSessionToken } from '../lib/claude';
```

`provider()` is six words deciding whether a heading says *Claude* or *GPT*.
`setSessionToken` is six lines setting a variable. `lib/claude.ts` is 1,641
lines, and brings `lib/figure.ts`, `lib/study.ts`, `lib/controls.ts` and the
OpenAI transport with it. `App.tsx` is the entry and `store.tsx` is mounted
above every screen, so both of those imports are eager: what they pull in,
every student downloads and parses before anything paints.

Measured in the built bundle rather than argued:

```bash
npm run build && grep -c 'api.anthropic.com' dist/assets/index-*.js dist/assets/store-*.js
```

Before: `api.anthropic.com`, `anthropic-version` and `x-api-key` all present in
the eager chunks. After: neither client is, and `api.openai.com` is gone too —
four labels and a default model sat in the OpenAI transport, so *reading a
setting* pulled the request builder that acts on it.

**The line drawn is reading against asking.** `lib/assistant.ts` answers from
`localStorage` and `import.meta.env` and returns: which provider, which model,
which of the four routes, and the three session-long degradations a route can
report. `lib/token.ts` holds the signed-in token and nothing else.
`lib/claude.ts` imports from both and is the half that opens a connection.

```
first load   280.9 kB → 274.3 kB gzipped   (−6.6 kB, −2.3%)
```

**It also fixed a small thing that was not a build concern.** `saveSettings`
clears two session-scoped degradations — a proxy that answered 404 and has been
stood down, and a model that refused the strict tool promise — on the stated
grounds that somebody who has just been to that screen may have fixed it. The
third, `structuredRefused`, was left set. So a student who hit one gateway that
strips `output_config`, then switched provider or typed a different proxy, kept
the constrained reply shape switched off for the rest of the session against a
route that had never refused it. It moves with the other two and is cleared
with them.

`lib/assistant.split.test.ts` guards the shape, because none of it is visible
from inside any of the files: they all compile either way, every test passes
either way, and one convenience import — a type, a constant, a helper that
happens to live next door — silently puts it all back.

---

## 2. `isolate: false` is worth 45 seconds a CI run · **shipped, by somebody else, and the objection below is answered**

This is `ENGINEERING-AUDIT.md` §3, item 7 on its list, estimated there at "an
afternoon". It is the largest remaining win by wall clock, and this section was
written as the one finding in this document that ended in *don't*.

**It was then shipped while this was being written, by another session** —
#311, "Half the test suite's time was spent starting processes", with a
`vite.config.ts` that splits the run into two Vitest projects and a
`src/isolation.test.ts` that reads the config and the tree and fails when a new
`vi.mock` appears in a file the config has not listed. It is on `main` now.

**The section is kept as written, and the objection re-tested rather than
withdrawn on sight.** What it said was not "this is wrong" but "the same commit
passes at three, four, six and eight workers and fails at one and two, and a
runner with a different core count is a different packing". That is a
falsifiable claim and it is now false. Re-run on the merged head:

```
npx vitest run --maxWorkers=1 → 8,081 passed    --maxWorkers=4 → 8,081 passed
              --maxWorkers=2 → 8,081 passed                  8 → 8,081 passed
              --maxWorkers=3 → 8,081 passed
```

The suite runs in 29.5 s where it took 42, at every packing this objected to.
The guard test is what makes it stay true, and it earned its place immediately:
the component test added in §5 mocks the store, and the guard failed until it
was listed. What follows is what the objection was, and it is worth reading as
the shape of the problem rather than as a verdict that still stands.

**The prize is real and bigger than recorded.** Vitest spawns one worker per
test file. It reports the cost itself at the end of every run:

```
Isolate  372 workers spawned · ~238ms startup each (spawn + environment, per file)
         at least ~29.26s faster with isolate: false
```

Measured both ways on this machine: **41.9 s → 26.8 s**, a 36% cut. CI runs the
suite three times — `npm test`, then `npm run test:zones` under two more
timezones — so that is about **45 seconds off every push**.

**The setting in §3 is stale.** It names `poolOptions.threads.isolate`, which
Vitest 4 removed; on Vitest 5 that key is silently accepted, warns about a
migration guide, and changes nothing — the run still spawned 372 workers and
still took 41 seconds. The option is top-level `test.isolate` now. Worth saying
plainly, because the config *looks* applied and the suite still passes.

**Then four separate things break, in three classes.** A shared worker is a
shared module registry, and this suite leans on a fresh one in more places than
the §3 estimate assumed:

1. **A file that replaces a module, and a file that already imported its
   importer.** `state/persist/tell.test.ts` mocks `./db` and imports `./index`
   to get a module bound to the double. Sharing a worker with `db.test.ts`
   handed back the instance that file had already built against the real
   `./db`: `open` unmocked, `load()` failing, `persist` inert, four assertions
   failing on a module that was never given the double. **Fixed** —
   `vi.resetModules()` before the import. Every file that uses `vi.mock` on a
   local module is exposed to this.

2. **Module state that outlives a test.** `components/splash.test.tsx` renders
   an empty tree — the curtain never drawn — depending on what ran before it.
   `forgetSplash()` is called and the flag is false, so it is not the splash's
   own memory; the first render is landing on `onboarding`, which the splash
   correctly declines to cover. This one is not caused by a shared worker: it
   reproduces on the file by itself, with isolation on, which makes it §3's
   last open row as much as it is a blocker here. Not yet run to ground.

   ```bash
   npx vitest run src/components/splash.test.tsx --sequence.shuffle   # ~4 in 5
   ```

3. **A floating dynamic import outliving its environment.** At two workers the
   run ends in `EnvironmentTeardownError: Cannot load
   '/src/data/courses/econ/guide.ts' … after the environment was torn down`,
   and 29 tests in `screens/files.test.tsx` are reported *skipped* rather than
   failed. **Fixed, and it was never only a test problem** — see §2a. Shared
   workers made it fail every run rather than some runs, which is the only
   reason it was found here.

### 2a. The third class was a live bug, and `npm test` is red on main because of it · **fixed**

Chasing where the floating import came from produced the one finding in this
audit that a student would notice.

`state/store.tsx` fetches the sample semester when `state.sample` is on, which
is the default, so any test that mounts a provider starts four dynamic imports
— started with `void loadSeed().then(…)` and no `catch`. A test that finishes
first leaves them rejecting into nobody's hands, and an unhandled rejection
fails the run *after* the summary has already said everything passed. Measured
on the baseline, six runs of one file: three errors, three, one, three, three,
none.

```bash
git stash && for i in 1 2 3 4 5 6; do \
  npx vitest run src/components/splash.test.tsx 2>&1 | grep -c EnvironmentTeardownError; done
```

So **`npm test` exits 1 on `main`, intermittently, while reporting that all
372 files passed.** That is the worst shape a red build can have: nothing to
reproduce, nothing named, and a green summary above the failure.

The production half is the part worth fixing and has nothing to do with tests.
`loadSeed` caches its promise so that flicking the toggle does not refetch
330 kB — but `??=` is satisfied by a promise whatever it settled to, so it
cached failures as readily as successes. These are dynamic imports: they fail
in exactly the two ways `components/Boundary.tsx` is written about, and both
are over by the next attempt. There was no next attempt. The toggle went on,
nothing appeared, off and on again returned the same rejection, and the sample
stayed unavailable for the rest of the session on a device that was by then
perfectly able to fetch it.

A failure is no longer kept, the store catches what it starts, and
`data/seed.test.ts` holds both halves. Three consecutive `npm test` runs now
exit 0.

**Why that adds up to "not yet" rather than "nearly".** Which worker a file
lands in depends on how many files are packed into how many workers, and that
depends on the machine's core count. The same suite, same commit, same fixes:

```
npx vitest run --maxWorkers=1  → 1 failed
              --maxWorkers=2  → 3 errors, 29 tests silently skipped
              --maxWorkers=3  → pass
              --maxWorkers=4  → pass
              --maxWorkers=6  → pass
              --maxWorkers=8  → pass
```

A GitHub runner with a different core count is a different packing. Shipping a
green-on-my-laptop config would buy 45 seconds at the price of a red suite
nobody can reproduce, which is a bad trade at any price.

**The route through, as it was written here and as it actually went.** This
section proposed: fix the floating `loadSeed()`, run `splash.test.tsx` to
ground, then turn the setting on with the mocking files as exceptions and
re-run the sweep. One and three happened — the first in §2a on this branch, the
third in `990fe41`. The second did not, and `splash.test.tsx` is still the one
file that fails under `--sequence.shuffle`; it passes under the isolation split
because the split gives it back a fresh registry, which is a fix for the
symptom this section found and not for the thing wrong in the file.

So the remaining work is smaller than this section claimed and has not gone
away: `--sequence.shuffle` is the guard that would have caught every one of
these, it is one line in CI, and one file stands between here and turning it
on.

---

## 3. Sixteen test files were passing on what ran before them · **all fixed, and guarded**

Nobody had run the suite shuffled. It has never needed to be — one worker per
file hides most of this — which is exactly why it is worth doing before §2 is
attempted, and worth doing anyway.

```bash
npx vitest run --sequence.shuffle
```

| File | What leaked | |
| --- | --- | --- |
| `lib/claude.test.ts` | `proxyDown`, set for the session by the test above and never put back — two assertions about which route a question takes were correct for the wrong reason | fixed |
| `lib/claude.test.ts` | `structuredRefused`, the same shape, one assertion | fixed |
| `lib/device.test.ts` | `badge()` remembers the number it last showed, so clearing is a transition; the test asked for it from a module that believed nothing was shown | fixed |
| `lib/keys.test.ts` | a `role="dialog"` left in `document.body`; every shortcut is correctly stood down under a modal, so the tests after it were told *nothing* and failed | fixed |
| `data/seed.test.ts` | the file added in §2a, caught by its own medicine: `vi.mock`'s factory reads a flag when Vitest chooses to evaluate it, which is once per registry rather than once per test, so the test that set the flag false could evaluate the module for the test that needed it true. A getter, read at every access, is consulted when the test means it to be | fixed |
| `components/splash.test.tsx` | the address bar. `store.tsx` reads `screenFromUrl() ?? firstScreen(nav)` and the URL wins — that is how a deep link opens the screen it names — and it writes the current screen back into the hash. The test that mounts on onboarding left `#/onboarding` behind, so the next test's store started there whatever its storage said, and the splash correctly declined to cover onboarding | fixed |

The `claude.test.ts` fix is the one to copy: its setup now goes through
`saveSettings`, which is the same door the app goes through and clears all
three session flags. Writing the key straight into storage behind the module's
back was what made the tests depend on each other.

Three shuffled runs of the full suite, at `d63507b`: 7,684 passed, one failed,
and it is `splash.test.tsx` all three times. Three more on the merged head:
8,080 passed, one failed, `splash.test.tsx` all three times again — and four on
`924d0ab`, where it is still the only file that fails.

**Fixing it uncovered two more**, which is what a guard does the first time it
is pointed at something. Both are now fixed too, and neither turned out to be
what the first reading of it said.

**`lib/idb.test.ts` — a fake clock left running, and it was this audit's own
doing.** Four of its tests sat until the five-second timeout. Its fake
IndexedDB fires `onsuccess` from a `setTimeout(…, 0)`, and against a clock
nobody is advancing that callback never runs. The clock belonged to
`lib/swmedia.test.ts`, added by §5's cap three commits earlier: it called
`vi.useFakeTimers()` in a `beforeEach` and never put the clock back, and under
`isolate: false` a clock installed in one file is still installed in the next.
Of the seven files in the suite that install fake timers it was the only one
that did not restore. Proved by pairing the two and shuffling: **four failures
in six without the restore, none in eight with it.**

**`screens/Calendar.keyboard.test.tsx` — innocent, and already doing it
right.** The `EnvironmentTeardownError` it died on names the chain
`components/tabsound.test.tsx` → `TabFind.tsx` → `store.tsx` → `seed.ts`: a
store mounted with the sample on starts four dynamic imports and awaits none of
them, and Vitest tears the environment down underneath. The error is reported
against whatever file is *running* when the import lands, which is somebody
else's — `Calendar.keyboard.test.tsx` already awaited `loadSeed`, as six of the
eight store-mounting files did. `tabsound.test.tsx` and `splash.test.tsx` did
not. They do now.

That one is the same root cause as §2a and the same fix `screens/deadends.test.tsx`
had already written up in its own comment — which is the argument for
`src/seedawait.test.ts`, a guard that reads the tree and fails when a file
mounts `StoreProvider` without calling `loadSeed`. Six files had worked the
problem out independently and two had not; the ninth should not have to work it
out at all. Its first version looked for the *name* `loadSeed`, which the
import line satisfies on its own — deleting the await and keeping the import
left the guard green. It looks for a call now, and that was checked by
breaking it.

**Shuffle is in CI now**, as *Test in a different order* beside the timezone
one. It was added twice, from both ends — this branch wrote a step while
another session landed the same thing on `main`, and the duplicate was resolved
in favour of main's. Worth recording, because what either half did is only
worth what the other half found: this half found a tenth thing, and then
seven more.

The tenth was a different class: `ReferenceError: window is not defined`,
thrown by React's scheduler against a tree still mounted when a file ended and
the environment went. About one run in ten — and **replaying its seed never
brought it back**, because a seed fixes the order and not the race. That is the
one caveat on shuffle as a guard, and it is written into the CI comment:
ordering faults are reproducible from the seed it prints, timing faults are
found by running it a dozen times.

Seven files were leaving a tree mounted. Five unmounted the *previous* test's
tree in a `beforeEach`, which is every tree but the last; one never unmounted
at all; one handed the root to the test and only one test gave it back.
`src/rootunmount.test.ts` now fails when a file that calls `createRoot` has no
`unmount` in an after hook — deliberately not counting a `beforeEach`, which is
exactly the shape five of the seven had.

Eighteen shuffled runs at one, two, three, four and six workers, clean. That is
what the step was worth waiting for: a shuffled CI that goes red one push in
ten is not a guard, it is a tax.

---

## 4. Every screen is now either offered or accounted for · **fixed**

82 members in the `Screen` union, 60 destinations in `lib/nav.ts`.
`ENGINEERING-AUDIT.md` §4 recorded the gap and it stayed open, because nothing
tells a missing registration apart from a screen that is deliberately not a
destination.

Reading all 22, they are all the second kind — two are the shell looking at
itself, one is first run, eleven are detail pages opened from a registered
parent, eight are Settings pages that Settings lists. So the fix is not to
register them. It is to say so once, somewhere that fails when the next screen
lands in neither: `lib/nav.registry.test.ts`.

Adding a screen touches several files. Forgetting the registry compiles,
renders, and leaves a screen that exists and cannot be reached from the
launcher, search, the directory or the shortcut row. That is step one of the
two §4 asks for; step two — one module per screen — is architecture and belongs
on its own branch.

---

## 5. The offline media cache had no size, no list, no ceiling and no way out · **fixed**

`ENGINEERING-AUDIT.md` §5 fixed the *shell* cache growing without bound. The
media cache was never in scope and has the same shape and a larger number.

```
public/audio      212 MB   (46 MB of lessons across four courses, 167 MB of podcast editions)
public/decks      952 kB
public/handouts   284 kB
```

`public/sw.js` caches media first-hit and keeps it:

```js
if (isMedia(url)) {
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
    if (res.ok && res.status === 200) caches.open(MEDIA).then((c) => c.put(request, copy));
```

There is no cap, no eviction, no accounting — `grep -n 'estimate\|quota\|MAX\|LIMIT' public/sw.js` returns the one comment saying audio is never *pre*-cached, which is a different promise and one the worker keeps. And nothing on the page can clear it: `grep -rn 'caches\.' src` finds two calls, both in `lib/shared.ts`, both about the share handover.

So a student who works through the term plays their way to a couple of hundred
megabytes on their phone, sees it in the app's own Storage room screen — which
reads `navigator.storage.estimate()`, and therefore counts this — and has
nowhere to act on it. On iOS that matters more than the number suggests: Safari
evicts by origin under pressure, so the media nobody chose to keep can take the
shell and the offline promise with it.

**All four are now built.** `lib/downloads.ts` reads the media caches
— found by the `-media` suffix, so a `VERSION` bump cannot strand a screenful
of files this is the only way to delete, and so the shell and the share
handover are never in reach — measures each entry from its `content-length`,
and groups it by the course every cached path names. `components/Downloads.tsx`
draws it under **Room** on *Your data*, which is the screen whose own blurb
promises "every record the app holds, what it weighs, and how much room is
left" and which had nothing at all to say about the largest thing on the
device. A size, a shelf per course with what is on it, a clear for one course
and a clear for the lot.

No confirmation, on purpose. `TypeToConfirm` states its own rule —
*"everything else that removes something is undoable"* — and this is the
ordinary case: nothing goes that pressing Play does not bring back. What the
sentence beside the button has to be honest about is the one case where that
is not free, which is the case the whole cache exists for, so it says it:
*they download again the next time you play one, which needs a connection*.

**The cap is built too.** `public/sw.js` holds the media cache under
`MEDIA_CAP`, 150 MB — enough for every lesson of every course with room for the
four or five podcast editions somebody actually listens to, against the 212 MB
the site ships. A judgement rather than a measurement, and one line to change.

What goes is the **least recently played**, which is the reason the worker now
keeps a ledger at all. `cache.keys()` is insertion order — *first download*
order — so evicting by it drops the lessons somebody is working through this
week and keeps the edition they played once in the first week of term. That is
the wrong answer and it is the one you get for free. The ledger holds only a
time per file; sizes are read from each cached response's `content-length` when
they are needed, so there is no second number to go stale. A file the ledger
has never heard of sorts as the oldest thing there is, which is the right guess
and the only one that leaves no entry beyond eviction's reach.

And it is **reported, never silent** — `lib/keep.ts`'s rule, and the same
argument: a cache that quietly threw away last month's lessons is the same
betrayal in a smaller coat. The worker writes down what went, the screen says
it: *Room was made on 3 December: 2 lessons and a podcast edition from BUS
went, 41.0 MB in all.*

Two things the tests are worth naming for. `lib/swmedia.test.ts` drives the
real `public/sw.js` through its fetch handler and pins that a file downloaded
first and replayed in December outlives one downloaded second and never touched
— the whole reason the ledger exists, and invisible in the source. And
`downloads.test.ts` reads `public/sw.js` for the cap and the ledger's name: a
service worker is not a module this app can import from, so both are written
twice, and a screen reporting a ceiling the worker is not holding would be
worse than no ceiling, because it would be believed.

**Opening it found the bug the tests could not.** Which clear was running was
held as a string with `''` for none — and `''` is a real shelf, the one
everything uncoursed is grouped under. That row's button therefore read
*Clearing…*, disabled, from the moment the screen drew, on any device with
something uncoursed cached. Nine component tests passed over it; a browser
showed it in the first screenshot.

---

## 6. The lint warnings had no ceiling · **fixed**

`npm run lint` exited 0 at 45 warnings and would have exited 0 at 450.
§6 of the engineering audit took the count from 155 to 41 and read the
remainder as worth keeping visible — but nothing stopped it drifting back up,
one pull request at a time, each warning invisible among the ones already
there. `--max-warnings` is the ratchet — 45 when it went in, 25 once the
`useModal` nineteen were gone; the way past it is to fix the
warning or raise the number in a diff, with a reason.

**It found one on the way in.** Merging main took the count to 48, and the
three new ones were `eslint(no-duplicate-case)` in `lib/sheet.ts`: `AVERAGEIFS`,
`MAXIFS` and `MINIFS` had been implemented twice in one `switch`, and the
second implementation — 25 lines, its own docblock, its own reading of what an
empty match means — was unreachable behind the first. No behaviour was wrong,
because the reachable one is right and the 207 spreadsheet tests pass either
way. What was wrong is that a correction to that engine had a 50% chance of
landing in the copy that does not run. Deleted, which is also why the ceiling
is still 45 rather than 48: the ratchet's whole point is that a warning is
fixed or the number is raised on purpose, and raising it for three true
findings on the first merge would have been the number's first lie.

**The hook that was half the list is done.** The count is **25** now, and the
ceiling with it. `a11y/modal.ts` returns `{ ref, onKeyDown }`, and eleven files
held that object and wrote `modal.ref` in their JSX. The React Compiler tracks
where a ref goes and loses the thread through a property read, so every one of
those was reported as *"Cannot access refs during render"* — which is not what
the code does: it hands the ref to `ref=`, it never reads `.current`. Nineteen
false warnings, sitting in the list where a true one would have to be noticed
among them.

Destructuring at the call site is all it took — the shape React's own hooks
return, and the compiler can then see which binding is the ref. No rule
disabled and no comment suppressing anything. The reasoning is in the hook's
own note so the next caller does not put the object back, and the ceiling is
what catches them if they do.

Verified in a browser rather than only in the suite, because a focus trap is
the kind of thing jsdom will agree with and a user will not: the launcher
dialog still takes focus on open, holds it through fourteen tabs, closes on
Escape and gives focus back to the button that opened it. One of the eleven,
`components/Command.tsx`, could not be opened in either navigation tried and
has no test file of its own — its change is sound by reading and by the type
checker, and is the one not exercised at runtime.

**What the 25 are now:**

| Rule | Count | |
| --- | --- | --- |
| `react(set-state-in-effect)` | 12 | genuine, spread across 9 files |
| `react(purity)` | 4 | `Date.now()` read once per render, deliberately, so a list and its headings agree about what "now" is |
| `react(preserve-manual-memoization)` | 4 | all in `screens/Sheet.tsx` |
| `react(refs)` | 3 | `room/Talk.tsx`, `call/Green.tsx`, `screens/Calendar.tsx` — none of them `useModal`, so three separate readings rather than one idiom |
| `react-hooks(exhaustive-deps)` | 2 | |

The twelve `set-state-in-effect` are the next real block, and unlike the
nineteen they are not false: each is an effect that could be a derivation. They
want reading one at a time rather than a pass.

---

## 7. What else was measured and left alone

**37 of 293 `lib/` modules have no sibling test.** Read rather than counted:
the large ones are `types.ts` (declarations), `university.templates.ts` and
`sheettemplates.ts` (data), `browser.hook.ts` and `draft.hook.ts` (hooks tested
through their screens), and `rtc.ts`, `mic.ts`, `pathway.ts`, `career.ts`,
`family.ts`. The last five are the ones worth a look — `rtc.ts` is 553 lines of
peer connection with no direct test, and a call is the hardest thing in this
app to check by hand.

`lib/assistant.ts`, added by §1, is on that list too and should not be: its
behaviour is covered, but the tests are in `claude.test.ts`, which is now
named after the other half. Moving them is tidy-up, not risk.

**`fsModuleCache: true`** takes the suite from 41.7 s cold to 37.8 s warm, with
transform time falling from 17% to 5%. It is a local convenience rather than a
CI saving — CI starts cold every run unless the cache is restored as a step —
so it is worth turning on with that step, and worth nothing without it.

**The critical path, after §1**, is 274.3 kB gzipped: 145.0 kB of app entry,
91.1 kB of store, 17.3 kB of CSS, 22.0 kB across thirteen small chunks. No library
is in it — mermaid, leaflet, pdf.js, KaTeX, cytoscape, the Supabase client and
both API clients are all behind a dynamic import. What is left is the app's own
code, and `state/shape.ts` at 2,249 lines is most of the store chunk. Splitting
that is architecture, not a tidy-up.

**Checked and found healthy** — no finding, recorded so the next pass can skip
them: error boundaries exist and tell three different failures apart
(`components/Boundary.tsx`); storage failure is distinguished from a full quota
and sheds oldest-first, reporting what went (`lib/keep.ts`); the persistence
layer has moved to IndexedDB with a localStorage fallback that cannot break the
app (`state/persist/`); the service-worker *shell* cache prunes on a build
change; every `dangerouslySetInnerHTML` is either generated markup (KaTeX, a QR
code, a drawing) or guarded; there are no secrets in the repository and the
Anthropic key never reaches the page; accessibility is enforced by tests rather
than asserted (`src/a11y/`, and a label check in `npm run lint`); and reduced
motion, timezones and offline are all covered by tests that exist because
something once went wrong.

---

## 8. What to do next, in order

| | Work | Cost | What it buys |
| --- | --- | --- | --- |
| 1 | ✅ **§1** — split reading from asking in the assistant | done | −6.6 kB gzipped off every first load, and one real bug |
| 2 | ✅ **§3** — sixteen order-dependent test files, in four passes | done | a suite that can be shuffled, eighteen runs clean |
| 3 | ✅ **§4**, **§6** — the registry guard and the lint ceiling | done | two things that cannot quietly get worse |
| 4 | ✅ **§2a** — the unawaited, failure-cached `loadSeed()` | done | `npm test` stops being intermittently red on main, and a sample that failed once can load again |
| 5 | ✅ **§3's last rows** — `splash.test.tsx`, then the two it uncovered, with a guard for the class | done | shuffle is clean at every worker count tried |
| 5a | ✅ **`--sequence.shuffle` in CI** — and the seven mounted trees it found | done | every one of the sixteen would now fail the push that introduced it |
| 6 | ✅ **§2** — `isolate: false`, with the mocking files as exceptions and a test that keeps the list honest | done, by another session | 42 s → 29.5 s a run, three runs deep |
| 7 | ✅ **§5** — a size, a list and a clear button for downloaded media | done | an installed app that does not quietly take 200 MB of a phone with no way to see or stop it |
| 7a | ✅ **§5, the rest** — a cap, least recently played first, and what it took said out loud | done | the same, without anybody having to go and look |
| 8 | ✅ **§6 follow-on** — destructure `useModal` at the call site | done | 19 of 44 warnings, and the ceiling down from 45 to 25 |
| 9 | **§7** — direct tests for `rtc.ts`, `mic.ts` | medium | the part of the app that is hardest to check by hand |

Items 1–4 and 6–7a are on `main`; item 5 finished on this branch. Every one
went in with `lint`, `tsc`, `test`, `test:zones`, `build` and
`check:university` green.
Item 6 arrived from another session, is on `main`, and is re-verified above
rather than taken on trust.

## 9. What this audit deliberately did not do

- **It did not re-run the duplication hunt or the screen sweep.** Seven passes
  and a route sweep did those, both recently, and the eighth would find the
  same nothing.
- **It did not touch the product roadmap.** `SPEC-AUDIT.md` §"What is worth
  doing next" is the better list and it is about features rather than cost.
  §5 here is the one place the two meet, and it is filed as cost.
- **It did not ship the change it most wanted to, and somebody else did.** §2
  is the largest number in this document. The reasoning for holding it is kept
  in full, along with the re-run that shows the objection no longer holds —
  an audit that quietly deletes the call it got wrong is worth less than one
  that leaves it where the next reader can weigh it.
