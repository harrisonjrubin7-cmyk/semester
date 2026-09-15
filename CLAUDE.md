# CLAUDE.md

Notes for an agent working in this repository. Everything here was learned by
getting it wrong first; each section says what the failure looked like, because
a rule without its failure is one somebody talks themselves out of.

## Check main before you start, for the thing itself

**Several sessions work this repository at once, and they converge.** Given the
same audit document and the same app, two agents given unrelated prompts reach
the same finding within minutes of each other. That is not a hypothetical: in
one hour on 15 September, main took sixteen merges, and two pieces of work were
built, validated and opened as pull requests here before their authors
discovered the identical fix had already landed — one by ten minutes, one by
forty-four.

So the first thing any task does, before reading code and long before writing
any:

```bash
git fetch origin main
git log --oneline -30 origin/main
```

**Read it for the defect, not for the titles.** Both duplicates above would have
survived a title scan: the palette fix landed as "The faint rung passed on the
panel it was sampled on", the teardown fix inside a commit named for the CI step
that found it. What catches them is grepping for the thing:

```bash
git log --oneline -40 origin/main | grep -i <the-thing>
git log -p --since="6 hours ago" origin/main -- <the-file-you-are-about-to-edit>
git show origin/main:<path> | grep -n <the-symbol-or-value>
```

If it has landed, **say so and stop** — do not open the pull request to be
thorough, and do not re-tune numbers somebody has already argued for. A merged
decision is a decision. Two things are still worth doing when you find one:
check whether their fix covers every instance yours would have (mine covered six
files, theirs covered seven and added a guard), and check whether they left the
recurrence open. Landing the guard nobody wrote is worth more than landing the
fix twice.

Branches move under you for the same reason. Rebase onto `origin/main` before
pushing rather than after CI tells you.

## The gates, and what each is for

Every command runs from `app/`, not the repository root — the root has no
`package.json` with these scripts, so `npm test` there silently does nothing.
[REGRESSION-CHECKLIST.md](REGRESSION-CHECKLIST.md) says the same thing at more
length, and holds the baseline figures.

```bash
cd app
npx tsc -b            # types
npm run lint          # oxlint, plus the style and label audits
npm test              # the suite, in file order
npm run test:shuffle  # the suite, in an order nobody chose
npm run build         # production build
```

`test:shuffle` is not a duplicate of `test`. Green `test` and red
`test:shuffle` means the tests depend on each other, which is a different fault
from a broken test and almost always wants fixing in the *earlier* file — the
one the failure does not name.

Two failure modes live in there and they are not the same:

- **An ordering failure is reproducible.** Vitest prints its seed, and
  `npm run test:shuffle -- --sequence.seed=N` runs that arrangement again.
- **A timing failure is not.** `ReferenceError: window is not defined` out of
  `react-dom` is a React root left mounted when a file ended, and replaying the
  seed does not bring it back: a seed fixes the order, not the race. Consecutive
  green shuffle runs are therefore weak evidence about this class. Do not report
  them as proof. `src/rootunmount.test.ts` is the real guard.

## Proving a change, in a repository that argues from measurement

The commit messages here carry measured figures, and they are checked. Match
that standard rather than the usual one.

- **A guard that has never failed is not known to be a guard.** Revert the fix
  under the new test and watch it go red, then restore it. Two tests in this
  repository passed against a faithful revert of the bug they were written for,
  and were only found because someone tried.
- **Include a control.** Measuring six suspects and finding six problems is also
  what a broken probe looks like. The first teardown probe written here keyed on
  the presence of `__reactContainer$`, which React leaves behind on unmount and
  only nulls — every file read as leaking, including two that were already
  fixed. The controls caught it; nothing else would have.
- **A clean reading is a claim about the probe too.** The second version of that
  probe scanned `document.body` for live roots, and reported
  `screens/call/leaving.test.tsx` clean. It was not clean. That file's teardown
  called `host.remove()`, so its mounted root sat on a *detached* host where a
  document scan cannot see it — the probe was answering a narrower question than
  the one being asked. Counting its tests against its unmounts had said "leak",
  and the count was right. When a measurement clears a suspect the cheap signal
  convicted, find out which one is lying before believing the measurement.
- **A structural check catches what a runtime probe misses.**
  `src/rootunmount.test.ts` asks only whether a file that calls `createRoot` has
  an `unmount` in an after hook. It cannot be fooled by a detached host, a race
  that did not fire, or a probe with a bug in it, and it found that file.
- **Look at the screenshot.** For anything visual, drive the app — `.claude/skills/run`
  has the browser setup, the adoption prompt, and the seeding. A dark rectangle
  is a failure to launch, not a dark theme.

## Contrast, if you are touching `lib/look.ts`

Thirteen grounds, two faded strengths, and both have now been wrong the same
way: measured against `--app-panel`, which is the surface a fade of the
foreground is *strongest* on. A light ground's void is two steps darker.
`lib/contrast.test.ts` walks the whole ramp for both rungs — keep it that way,
and measure a new ground against every surface it has rather than the one that
flatters it.
