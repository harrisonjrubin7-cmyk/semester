# Semester accessibility finish line

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin (no accessibility specialist; EXT-008 open) |
| **Method** | Static read of `app/src/a11y/`, `app/scripts/`, workflows and `docs/accessibility/`. The suites were green in this session's `npm test` run; the browser smokes were not run. |

Accessibility is a product capability, not a final audit:

design system → accessible primitives → content rules → automated tests →
assistive-technology testing → issue prioritisation → remediation tracking →
release evidence → public statement → customer feedback path.

## Where each link stands

| Link | State | Evidence | Gap |
| --- | --- | --- | --- |
| Accessible primitives | verified | `a11y/focus`, `modal`, `skiplink`, `landmarks`, `labels`, `title`, `fielderror`, `type`, `motion`, `dragging` tests; `components/unity` tests | — |
| Content rules | partial | lint audits `styles.mjs`, `labels.mjs`, `terms.mjs` run in `npm run lint` (ok on this commit) | no plain-language rule check |
| Automated tests | partial | axe over 15 of 96 routes (12 desktop + 3 phone) in `a11y/axe.test.tsx`; `smoke:a11y` is a blocking CI step over 7 journeys at desktop and 320 px; `lib/contrast.test.ts` | 81 routes outside axe |
| Assistive-technology testing | **absent** | `AT-PASS-PROTOCOL.md` and `MANUAL-PASS-KIT.md` exist; **no human pass recorded** | run it |
| Issue prioritisation | partial | `docs/accessibility/first-pass/accessibility-issue-ledger.csv`, 9 rows, none person-confirmed | confirm and rank |
| Remediation tracking | partial | the ledger | no SLA |
| Release evidence | partial | `2026-10-04-automated-sweeps.md` | not per release |
| Public statement | **draft** | `ACCESSIBILITY-STATEMENT-DRAFT.md`, "DRAFT, NOT PUBLISHED", 4 publish conditions; no in-app page found | publish when conditions met |
| Customer feedback path | **absent** | — | add a route and an address |

## Component and sweep coverage

| Check | Where | In CI? | Result on record |
| --- | --- | --- | --- |
| axe-core, whole app render | `a11y/axe.test.tsx` | yes (`npm test`) | fails on serious/critical; `TRACKED` exclusions empty |
| Browser smoke, 7 journeys, 1280 and 320 px | `scripts/accessibility-smoke.mjs` | **yes**, blocking (`ci.yml:382`) | green per CI design |
| Keyboard, landmarks, names, axe over 13 screens | `scripts/keyboard-pass.mjs` | **no** | open findings A11Y-0001, -0002, -0004 |
| Target size sweep | `scripts/targets-sweep.mjs` | **no** | 11 of 2,007 phone and 13 of 2,668 desktop controls under 24 px |
| Contrast, unit | `lib/contrast.test.ts` | yes | measured against every surface |
| Contrast, pixels | `scripts/contrast-sweep.mjs` | daily `contrast.yml` | 1 open (A11Y-0008, hover on `industry-dark`, 3.96:1) |
| Reduced motion | `a11y/motion`, `calm`, `styles/motion` tests | yes | 14 files reference it |
| Reflow at 320 px, every screen | — | **no** | "Not covered yet" in `RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md` |

## Stale statements to correct

- `docs/WCAG-UI-AUDIT-SCORECARD.md` says `smoke:a11y` is "Not a CI step". It is.
- The header of `a11y/axe.test.tsx` says the same. It is wrong.
- The header of `styles/reach.test.ts` says 0 of 1,480 and 0 of 2,082 controls
  are under 24 px; the 2026-10-04 sweep found 11 and 13 (ledger A11Y-0002).

## Program

Each item names the evidence that closes it.

| # | Item | Evidence that closes it | Owner |
| --- | --- | --- | --- |
| 1 | WCAG 2.2-oriented component library | primitives tests (present) plus an inventory mapping each component to success criteria | HR |
| 2 | Screen-reader testing matrix | a recorded pass on NVDA + Firefox or Chrome, JAWS, VoiceOver iOS and macOS, TalkBack, over the pilot path first | needs a qualified tester |
| 3 | Keyboard-only suite | `keyboard-pass.mjs` as a CI job with its `CONTROL=1` fault mode kept as the control | HR |
| 4 | Mobile, reflow and zoom | reflow at 320 px and 200 % zoom over the pilot path, then all screens | HR |
| 5 | Contrast | present; close A11Y-0008 | HR |
| 6 | Captions and transcripts | audit of audio/video assets (`audio/`, `video/`) | HR |
| 7 | Accessible data visualisations | text alternative and table for each chart | HR |
| 8 | Accessible tables and exports | exports (DOCX, PDF, CSV) checked for structure | HR |
| 9 | Accessible AI interactions | live region behaviour for streamed answers; recorded AT pass on `ask` | HR + tester |
| 10 | Accessible error, empty and loading states | the [coherence](SEMESTER_PRODUCT_COHERENCE_AUDIT.md) state pass | HR |
| 11 | VPAT roadmap | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md` becomes a qualified ACR (EXT-008) | vendor |
| 12 | Bug SLA | stated severities and times in `docs/accessibility/` | HR |
| 13 | Advisory input | named users with disabilities consulted and recorded | needs human evidence |
| 14 | Public feedback process | published route, monitored address, response time | HR |

## Gates

| Gate | Passes when | Today |
| --- | --- | --- |
| A-1 Pilot path automated | axe plus keyboard plus target size plus reflow on every pilot-path screen, in CI | partial |
| A-2 Pilot path human | one recorded AT pass on the pilot path, with defects ledgered | not met |
| A-3 Statement | the draft's 4 publish conditions met and the statement published | not met |
| A-4 Qualified review | independent report filed under `docs/evidence/` | not met (EXT-008) |
| A-5 ACR | a dated ACR issued from A-4 | not met |

A-2 is the first gate a pilot buyer will ask about. It is cheap relative to
A-4 and should precede it.
