# What is still worth improving, and what it is worth

A pass over the whole application asking one question the four audits before it
did not: **where is this app still paying for something, and how much?**

`SIMPLIFY-AUDIT.md` asked whether it does the same job twice (seven times, and
the answer settled at no). `SPEC-AUDIT.md` asked what is missing against the
product vision. `ENGINEERING-AUDIT.md` asked what the code costs to open,
render, test and extend, and closed six of its thirteen items. `APP-AUDIT.md`
and `docs/APPLICATION_AUDIT.md` swept the screens for things that break.

So this one re-measures, closes five of the things left open, finds four that
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
| `npm run lint` | exit 0, 45 warnings | exit 0, 45 warnings, **now capped at 45** |
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

## 2. `isolate: false` is worth 45 seconds a CI run, and this suite is not ready for it · **do not ship yet**

This is `ENGINEERING-AUDIT.md` §3, item 7 on its list, estimated there at "an
afternoon". It is the largest remaining win by wall clock and it is the one
finding in this document that ends in *don't*.

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
   `vi.resetModules()` before the import. Nine files in the suite use
   `vi.mock` on a local module and are all exposed to this.

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

**The route through, in order.** Carving the nine mocking files into their own
Vitest project with `isolate: true` was tried and is not enough on its own —
class 2 and class 3 are not mocking files. Do these first, each on its own and
provable by `--sequence.shuffle` and by the `--maxWorkers` sweep above:

1. ✅ The floating `loadSeed()` (class 3) — done, and see §2a.
2. Run `splash.test.tsx` to ground (class 2).
3. Then turn `isolate: false` on, with the nine mocking files listed as
   exceptions, and re-run the whole `--maxWorkers` sweep before merging. Two of
   the four sweep points were failing on classes 1 and 3; re-run it before
   assuming 2 is all that is left.

The saving does not go anywhere while that happens.

---

## 3. Five test files were passing on the order they ran in · **four fixed**

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
| `components/splash.test.tsx` | not yet found — the first render lands on `onboarding` and the splash correctly declines to cover it. Reproduces on the file alone, so it is inside the file rather than across the suite | **open** |

The `claude.test.ts` fix is the one to copy: its setup now goes through
`saveSettings`, which is the same door the app goes through and clears all
three session flags. Writing the key straight into storage behind the module's
back was what made the tests depend on each other.

Three shuffled runs of the full suite, at `d63507b`: 7,684 passed, one failed,
and it is `splash.test.tsx` all three times. Adding `--sequence.shuffle` to CI
is worth doing **after** that file is fixed, and is worth doing then — it is
the cheapest guard there is against this whole class, and it found four of
these in one afternoon.

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

## 5. The offline media cache has no ceiling and no way out · **new, not fixed**

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

**What it wants** is the pair the rest of this app already builds for its
storage: a number and a control. Downloads listed by course with their size,
one button to clear them, and a cap past which the oldest goes — the same
argument `lib/keep.ts` makes about shedding, and the same rule it holds to:
shedding is reported, never silent.

---

## 6. The lint warnings had no ceiling · **fixed**

`npm run lint` exited 0 at 45 warnings and would have exited 0 at 450.
§6 of the engineering audit took the count from 155 to 41 and read the
remainder as worth keeping visible — but nothing stopped it drifting back up,
one pull request at a time, each warning invisible among the ones already
there. `--max-warnings=45` is the ratchet; the way past it is to fix the
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

**The next thing to do with the number is one hook.** 45 warnings, and 20 of
them are the same idiom:

| Rule | Count | |
| --- | --- | --- |
| `react(refs)` | 22 | 20 are `a11y/modal.ts` — it returns `{ ref, onKeyDown }`, and the compiler reads every `modal.ref` in a render as a ref access, in 10 of the 11 files that use it |
| `react(set-state-in-effect)` | 12 | genuine, spread across 9 files |
| `react(purity)` | 4 | `Date.now()` read once per render, deliberately, so a list and its headings agree about what "now" is |
| `react(preserve-manual-memoization)` | 4 | all in `screens/Sheet.tsx` |
| `react-hooks(exhaustive-deps)` | 3 | |

Changing the hook's return shape clears nearly half the list in one change and
is worth doing on its own rather than as a side effect of something else.

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
| 2 | ✅ **§3** — four order-dependent test files | done | a suite that can be shuffled, which is the precondition for 4 |
| 3 | ✅ **§4**, **§6** — the registry guard and the lint ceiling | done | two things that cannot quietly get worse |
| 4 | ✅ **§2a** — the unawaited, failure-cached `loadSeed()` | done | `npm test` stops being intermittently red on main, and a sample that failed once can load again |
| 5 | **§2 step 2** — run `splash.test.tsx` to ground | half a day | the last known blocker, and §3's last open row |
| 6 | **§2 step 3** — `isolate: false` with the nine exceptions | small, after 5 | ~45 s off every CI run, three runs deep |
| 7 | **§5** — a size, a list and a clear button for downloaded media | medium | an installed app that does not quietly take 200 MB of a phone |
| 8 | **§6 follow-on** — reshape `useModal`'s return | small | 20 of 45 warnings, in one change |
| 9 | **§7** — direct tests for `rtc.ts`, `mic.ts` | medium | the part of the app that is hardest to check by hand |

Items 1–4 are on this branch, one commit each, with `lint`, `tsc`, `test`,
`test:zones`, `build` and `check:university` green after every one.

## 9. What this audit deliberately did not do

- **It did not re-run the duplication hunt or the screen sweep.** Seven passes
  and a route sweep did those, both recently, and the eighth would find the
  same nothing.
- **It did not touch the product roadmap.** `SPEC-AUDIT.md` §"What is worth
  doing next" is the better list and it is about features rather than cost.
  §5 here is the one place the two meet, and it is filed as cost.
- **It did not ship the change it most wanted to.** §2 is the largest number in
  this document and the reasoning for holding it is the most important part of
  the document.
