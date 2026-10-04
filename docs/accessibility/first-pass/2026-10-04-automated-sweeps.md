# Automated sweeps, 2026-10-04

**Sweep evidence for one commit. Not a screen-reader pass and not a WCAG evaluation.** Per
[`TESTING-AND-EVIDENCE.md`](../TESTING-AND-EVIDENCE.md) §1, a sweep is regression evidence for a
named commit and may not be cited as conformance. It finds some failures a person would also find, and misses
most of what only assistive technology reveals. Companion to [`MANUAL-PASS-KIT.md`](MANUAL-PASS-KIT.md).

| Field | Value |
| --- | --- |
| Commit | `ff84b99c8e6a65ecd8ce4e44824248da8dea5308` (`main`, 2026-10-04) |
| Run by | Claude Code, for @harrisonjrubin7-cmyk (accessibility lead) |
| Browser | Chromium (the container's `/opt/pw-browsers/chromium`, headless, Playwright; exact version string not recorded) |
| Served | `npm run dev` on :5173 (keyboard-pass, targets and contrast sweeps); `npm run build` then `vite preview` on :4173 (`smoke:a11y`, which tests the production bundle) |
| Data | The app's four sample courses; no account, no network services |

## 1. Results

| Sweep | Result | Cases |
| --- | --- | --- |
| `keyboard-pass.mjs` **control** (`CONTROL=1`) | Detected every planted fault: second `h1`, unnamed button, image with no alt, focus stop with no ring. A clean run is therefore distinguishable from a blind probe | 26 |
| `keyboard-pass.mjs` | **0** headings other than one `h1`; **0** `main`/skip-link/overflow failures; **0** focus stops without a ring; **0** page errors; axe **serious/critical: 1** (target-size, A11Y-0001); 3 overlap candidates (A11Y-0004, -0006 and a timing artefact, see §2) | 13 screens × desktop 1280×800 and 320×640 |
| `smoke:a11y` (production build) | `ok`: 7 critical journeys at desktop and 400% reflow; skip focus, landmarks, titles, names and ARIA references verified | 14 |
| `sweep:targets` | **11 of 2007** phone controls and **13 of 2668** desktop controls under 24×24 CSS px (the AA minimum before the 2.5.8 spacing exception); identical at all three densities. 667 of 2007 phone and 1333 of 2668 desktop under 44px (AAA, an aim) | 63 destinations, phone 420px and desktop, three densities |
| `sweep:contrast` (scope `chrome`) | **Exit 1: 1 distinct failure** (hover, `industry-dark`, 3.96:1; A11Y-0008); 0 in resting and focus states; 5 of 63 destinations opened | 62,151 elements, 13 grounds, 3 layouts × phone and desktop |

## 2. What the sweeps found

Eight ledger rows, `accessibility-issue-ledger.csv`. **None is confirmed by a person.** Two candidates from the
first run were checked by hand against the probe and **withdrawn or reduced**, which is the point of checking:

- *"Two textareas with an empty accessible name on Assignments."* **Withdrawn.** The probe's name is
  `aria-label`, then text content, then title, then placeholder; a textarea named by a wrapping `<label>` reads
  as empty. Re-measured, they have real labels ("Assumptions / what mattered / what needs official
  confirmation"). The real, smaller finding is that four of those fields sit half behind the bottom tab bar when
  focused at 320×640 (A11Y-0004; probably not a 2.4.11 AA failure because part of the field stays visible, but
  worth fixing; 2.4.12 is AAA).
- *"Start" on Timers covered by the Ask Semester button.* Covered at the instant focus lands and clear within
  600ms: a timing artefact the probe's own comment warns about. Recorded under A11Y-0005 (probe accuracy).
- *"Focus on this" on Today covered by the Ask button* (A11Y-0006). Not reproduced after settling.

What remains, in order of what a person should look at first:

1. **A11Y-0002: 11 phone and 13 desktop controls under 24×24 px** (hub entry titles, "Open … ↗" door links, a
   select, "Saved"). The sweep does not apply the 2.5.8 spacing exception, so some may be fine. The header of
   `styles/reach.test.ts` records **0 of 1480** phone and **0 of 2082** desktop controls under 24×24; this run
   reads 11 of 2007 and 13 of 2668. Either the header predates these screens or something regressed; the figures
   differ in screen count, so this is a prompt to check, not a proof of regression.
2. **A11Y-0001:** one axe `target-size` (serious) on Today at 320px.
3. **A11Y-0003:** 15 controls hit-tested under an element with no role; the three tried were reachable by real
   clicks, so this may be clipped gallery items.
4. **A11Y-0007:** `aria-valid-attr-value` needs review on six screens.
5. **A11Y-0008:** the one contrast failure, a hover state on the `industry-dark` ground (§3). It is the only item here that a measurement, not a probe heuristic, shows to be below the threshold.

Not in the ledger because the probe cannot see it: everything that needs a human. Alt-text quality, reading order,
what a screen reader says, whether a custom widget behaves, caption accuracy, and cognitive load.

## 3. Contrast

`npm run sweep:contrast` (`scope: chrome`, the default) finished with **exit 1 and one distinct failure**, reported
three times (once per navigation layout):

| Ratio | Needed | Where | Element | Colours |
| --- | --- | --- | --- | --- |
| **3.96:1** | 4.5:1 (SC 1.4.3) | `industry-dark` ground, desktop, home, **hover** state, in the `tabs`, `feed` and `shelves` layouts | `.journey-reason`, "Available whenever you need it." | `rgb(156,163,178)` on `rgb(66,66,68)` |

Ledger row **A11Y-0008**. Everything else the sweep measured passed: 11,765 passes over 62,151 elements on 13
grounds, with 0 findings in the resting, focus and focus-visible states and the 3 findings all in hover. The
standing token audit `lib/contrast.test.ts` (in CI) did not catch this one because the failing surface is the
hover-state composite, which is what the painted-pixel sweep exists to find.

What this run does **not** measure, and so does not claim:

- **Only 5 of 63 destinations were opened** (`scope: chrome`: the shared frame, not every screen). The
  sweep prints the 58 it did not open; a full-screen walk is `SWEEP_SCOPE` other than `chrome`, and is a separate,
  longer run.
- 14,025 elements on a gradient (not measurable by the script's method) and 6,422 single glyphs the markup marks
  as decoration were excluded; 314 elements per ground "measured nothing".
- Hover and focus states were sampled (962 resting, 10,647 hover, 78 focus passes), not exhaustively.
- Dark, light and the other grounds were each walked; a user-chosen accent colour was not.

So the honest summary is: **no contrast failure was found in the shared frame in resting or focus states, one hover
failure on one dark ground, and nothing is claimed about the 58 unopened destinations.**

## 4. Limits of this run

- One browser (Chromium), headless; no Firefox or Safari.
- No assistive technology of any kind.
- A local dev server for four of the sweeps; the production build only for `smoke:a11y`. A sweep against the
  deployed URL is what an ACR needs.
- Sample data only; no signed-in account, so the sign-in screen's authentication criteria (3.3.8) are not touched.
- jsdom-style axe `incomplete` results (`color-contrast`, `aria-valid-attr-value`) are not violations and are not
  claimed as passes.
- The exact Chromium version string was not recorded; record it in the next run.

## 5. Reproducing

```bash
# once, in a scratch directory outside the repo
mkdir drive && cd drive && echo '{"name":"drive","private":true,"type":"module"}' > package.json
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright axe-core

cd app && npm ci && npm run dev &            # :5173
export SMOKE_PLAYWRIGHT=/path/to/drive/node_modules/playwright SWEEP_PLAYWRIGHT=$SMOKE_PLAYWRIGHT
export AXE_CORE=/path/to/drive/node_modules/axe-core/axe.min.js BASE=http://localhost:5173/
CONTROL=1 OUT=control.json node scripts/keyboard-pass.mjs     # must go red on the planted faults
OUT=pass.json node scripts/keyboard-pass.mjs
SWEEP_URL=http://localhost:5173/ node scripts/targets-sweep.mjs
SWEEP_URL=http://localhost:5173/ node scripts/contrast-sweep.mjs   # long: about 5 min per navigation mode and width
npm run build && npx vite preview --port 4173 &
SMOKE_URL=http://localhost:4173/ node scripts/accessibility-smoke.mjs
```
