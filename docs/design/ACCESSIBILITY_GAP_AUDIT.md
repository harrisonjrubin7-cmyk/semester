# Accessibility gap audit (phase D0)

`c170dcd`, 2026-10-04. Static read of tests, CSS and docs. **No assistive
technology was run and no automated test was executed for this audit.** The
brief says automated checks are not proof; this document lists what exists and
what must still be done by a person.

## 1. What exists

| Requirement | Today | Evidence |
|---|---|---|
| Skip link | yes; custom hash handler because routing is in the hash | `App.tsx:160` (`SkipLink`), styled `app.css:~550-563`; `a11y/skiplink.test.tsx` |
| Landmarks | one `<main id="main" tabIndex=-1>`, real `<header>`, `<nav aria-label="Sections">` (tab bar and rail share the label; only one is drawn), `<section aria-label>` context bar, `<aside aria-label="Demo environment">` | `ScrollArea.tsx:123`, `a11y/landmarks.test.ts` |
| One H1 | shell renders it from the registry title; focus moves to it on screen change | `App.tsx:407`; `Page.tsx` takes no title; own H1 only in Search, Directory, Onboarding, TrustRoom, Respond |
| Focus ring | `outline: 2px solid var(--focus-color)`, offset `--focus-ring-offset` (2px); forced-colors uses `Highlight` | `app.css:2776-2790, 2820`; `a11y/focus.test.ts` |
| Targets | `--target-primary 44`, `-icon 40`, `-compact 32`, `-min 24`; `.tap` overlays | `tokens.css:143-148`; `styles/taps.test.ts` |
| Dialog focus return | `useModal` saves `activeElement`, traps Tab, Escape, restores | `a11y/modal.ts:177-240`; 19 of 23 overlays use it |
| Live announcements | `role="status"` ×277, `role="alert"` ×80, `aria-live` ×48 | no central announcer |
| Reduced motion | blanket rule zeroing animation; `--motion-*` tokens zeroed | `app.css:3038, 3207, 3641, 4807`; `a11y/motion.test.ts` |
| Low stimulation | `data-calm='still'\|'calm'`, `lowStimulation()` | `look.ts:532,595`; `a11y/calm.test.ts` |
| Forced colors | 7 `@media (forced-colors: active)` blocks; 0 TSX references | `app.css:2810, 3296, 3718, 3999`, `unity.css:287, 1332` |
| Increased contrast | `usePrefersContrast` raises alphas to a `LOUD` floor; glass goes opaque | `lib/prefers.ts`, `COLOR-AND-DARK-MODE-SPEC.md` |
| Reading controls | text size ×4, density ×3, line height ×4, text spacing, reading width 52/66/82/full, Atkinson Hyperlegible | `look.ts:118,502,747,767`; `styles/textscale.test.ts` |
| Opaque fallback for blur | `@supports not (backdrop-filter)`; off for reduced transparency, contrast, forced colours, calm | `app.css:2108, 3768, 4025`; `unity.css:1216`; `glass.test.ts` |
| Contrast | 143 accent×ground pairings, faint rung on every surface, warn 4.5:1, error 6:1 | `lib/contrast.test.ts` (37 `it`) |
| Axe | axe-core over rendered `<App/>`, zero serious/critical | `a11y/axe.test.tsx` (356 lines); also in 4 unity component tests |
| Labels | lint fails unnamed controls | `scripts/labels.mjs` → `a11y/labels.ts` |
| Colour-only | test | `a11y/tellings.test.ts` |
| Browser passes (not in CI) | `smoke:a11y`, `keyboard-pass.mjs`, `contrast-sweep.mjs` | `app/scripts/` |

## 2. Gaps against the brief

| # | Gap | Evidence | Pri |
|---|---|---|---|
| A-1 | Icon-only controls are checked for a name, **not for a tooltip** | `a11y/labels.ts`; brief: "require an accessible name and tooltip" | P1 |
| A-2 | Status changes have no announcement text | `status.ts:69` boolean `urgent` only; `StatusChip` no live region; VD-003 | P1 |
| A-3 | Source/status shown as word-only or colour-only in places | `SourceBadge` no glyph; `.trust-scorecard-row.is-*`; 32 colour dots | P0 |
| A-4 | Focus ring is not uniformly 2px accent | 3px at `app.css:2638, 11118, 11186`; separate ring `industry.css:150-151,270`; focus colour is `--app-accent-deep` | P1 |
| A-5 | Icon target 40px | `--target-icon` | P2 |
| A-6 | 4 overlays not on `useModal` | `OperatingRhythmWorkspace`, `TabPeek`, `call/Stage`, `calendar/Move` (inferred from import list; verify) | P1 |
| A-7 | Rail and tab bar both `aria-label="Sections"` | only one drawn at a time (`chrome.test.ts`), so acceptable; the system bar is a `<section>` with `QUIET_ON` suppression on six screens | P3 |
| A-8 | No global live-region announcer | 48 hand-placed `aria-live` | P2 |
| A-9 | Hand-rolled `window.confirm` ×5 | VD-006 | P1 |
| A-10 | Forced colours verified by CSS only | no TSX handling, no browser test in CI; manual script E11 not run | P1 |
| A-11 | Browser a11y smoke is not in CI | `package.json` `smoke:a11y` | P1 |
| A-12 | Mobile AT behaviour untested | MANUAL-PASS-KIT says "The pass has NOT been run" | P1 |
| A-13 | `prefers-color-scheme` handled in TSX only (0 in CSS) | `lib/prefers.ts`; `index.html` hard-codes `color-scheme dark` and `theme-color #040507` until `App.tsx` overrides | P3 |
| A-14 | Accessibility is a component and a settings group, not a route | no `#/accessibility`; the target rail lists it | P2 |
| A-15 | Tenant branding cannot be shown not to reach safety UI | policy only; VD-040 | P1 |

## 3. Existing manual material

`docs/ACCESSIBILITY-POLISH-CHECKLIST.md` (156 lines) is a checklist, not step
scripts. `docs/ACCESS-SIMULATOR.md` (118 lines) is a design doc.
`docs/accessibility/AT-PASS-PROTOCOL.md` defines 16 environments (E1 NVDA, E2
JAWS, E3 VoiceOver Safari macOS, E4 VoiceOver iPhone, E5 TalkBack, E6
keyboard-only, E7-E9 zoom/reflow/text size, E10 reduced motion, E11 forced
colours, E13 Voice Control, E14 switch, E15 magnification, E16 Dragon) and a
9-step golden-path script. `docs/accessibility/first-pass/MANUAL-PASS-KIT.md`
states the pass has not been run. `first-pass/2026-10-04-automated-sweeps.md` is
the automated record.

## 4. The seven manual scripts the brief asks for

| Script | Covered by | Gap |
|---|---|---|
| Keyboard-only | E6 + `scripts/keyboard-pass.mjs` | no standalone one-page script |
| Screen reader | E1-E4 | as above |
| Zoom/reflow | E7-E9 | |
| High contrast | E11 | |
| Reduced motion | E10 | |
| Mobile VoiceOver/TalkBack | E4, E5 | |
| **Dyslexia/reading settings** | **none** | no environment; only mentions in `PROGRAM.md`, `TESTING-AND-EVIDENCE.md`, `INCLUSIVE-CONTENT-STANDARD.md` |

D5 should produce seven short runnable scripts that cite the E-numbers instead
of duplicating the protocol, and add the missing reading-settings script
(text size, density, line height, letter spacing, reading width, Hyperlegible).

## 5. What the migration must not regress

`a11y/*` (14 files), `styles/taps|reach|textscale|density|glass|motion`,
`lib/contrast`, `pageframe`, `widthgate`, heading focus on screen change,
`#main` as skip target, one `aria-label="Sections"` nav at a time. Any new hue
(U-4) is measured against every surface of every ground before it ships.
