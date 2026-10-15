# 1 · Current-state architecture audit

Source: `npm run census:arch`. Production code only unless it says otherwise.
At `main` that is 1,412 files and 394,331 lines (the census prints 1,448 and
398,047 on this branch, because it counts the 36 files this pull request adds).
The scanner is
`app/src/architecture/graph.ts`; it reproduced an independent regex graph
exactly (6,000 edges, 12 cycles) before being trusted.

## Shape

| area | files | lines |
|---|---:|---:|
| `lib/` | 764 | 202,304 |
| `components/` | 389 | 78,346 |
| `screens/` | 120 | 70,076 |
| `data/` (course content) | 24 | 10,790 |
| `ai/` | 29 | 10,017 |
| `state/` | 18 | 9,555 |
| `community/` | 23 | 5,359 |
| everything else | 45 | 7,884 |

`lib/` is 595 files directly in one folder and 169 in subfolders. 48 files
exceed 1,000 lines, 172 exceed 500. The largest are screens and the state
aggregate: `screens/Sheet.tsx` 4,750; `lib/sheet.ts` 3,698; `screens/Calendar.tsx`
3,006; `state/shape.ts` 2,829; `screens/Write.tsx` 2,719; `screens/Today.tsx`
2,124.

## Coupling

**The dependency graph has layers but nothing enforces them.** The order the
code mostly follows is `lib` → `state` → `ai` → `components` → `screens`.
70 imports point the wrong way (`lib` → `state` 32, `lib` → `intelligence` 15,
`lib` → `ai` 8, `lib` → `community` 3, and a few more). 12 import cycles
exist; the largest is 18 files across `ai/` and `lib/`.

**Screens talk to everything.** 118 of 120 screen files import `lib/`
directly — 303 distinct `lib` files between them — and 111 import `state/`.
`screens/Today.tsx` imports 68 modules. There is no layer between a screen and
the business rules it renders; the screen *is* the composition.

**Two files are the centre of gravity.** `state/store.tsx` is imported by 340
files and `lib/types.ts` by 287; `components/ui.tsx` by 270. `state/shape.ts`
(2,829 lines) imports 62 modules, so the single device-state aggregate knows
every feature's data shape. This is the "interface-specific state became the
product model" risk, measured.

## Duplication

No clone detector was run; these are structural duplications found by reading,
not by measurement.

- **Authorization is asked three ways** (ADR 0007): row-level security, the
  gateway adapter's own status/review, and per-function gates in edge
  functions — plus client role gating in `lib/role.ts` (UX only by design).
  The package's one decision point, `decide()` in
  `packages/institution/src/policy.ts`, had **no production caller** before
  this work.
- **Two lifecycle models for "a thing to do":** `lib/actions.ts` (eight
  statuses, history, ranking) and `PersonalTask.done` (a boolean) in
  `lib/types.ts`. Today ranks the first; the Work screen edits the second.
- **Registers kept as code:** 81 files / 26,836 lines of governance, ops,
  trust and register modules exist to generate documents; they sit in the
  client's `lib/`.

## Client-only logic and state boundaries

The app is device-first by decision (ADR 0001): the browser holds the working
copy and Supabase is the second copy, protected by RLS (ADR 0002; 171
migrations, 106 `*.check.sql` suites). That is a sound boundary for personal
data. Findings inside it:

- The backend seam is **narrow**: only 15 files import the Supabase SDK, 14 in
  `lib/` (`cloud.ts`, `membership.ts`, `featurepolicy.ts`, `finance/*`,
  `integration/*`, …) and `state/store.tsx`. That is the most promising fact in
  this audit: ports can be cut there.
- **Storage is not behind one seam.** 59 legacy files touch
  `localStorage`/`sessionStorage`/`indexedDB` directly (40 in `lib/`, 7 in
  screens, 5 in components), although `state/persist` exists.
- **Time is ambient.** 176 legacy files call `Date.now()` or `new Date()`;
  26 are screens. Every one is a test that must fake a global.
- **Environment is read in 26 files** via `import.meta.env`, including 4
  components and 2 screens.
- **Client authorization:** `lib/role.ts` gates screens for UX. It is
  documented as advisory and RLS is the authority; the risk is drift, not a
  hole. `decide()` is the institution-grade path and was unused.
- **Events:** the outbox/envelope (ADR 0008) has no producers (the repository's
  own roadmap audit says so).

## Risk register

| # | Risk | Evidence | Severity |
|---|---|---|---|
| R1 | A screen is the only place a rule is composed, so rules cannot be reused or tested without rendering | 118/120 screens import `lib/`; Today 68 imports | High |
| R2 | One state aggregate knows every feature | `state/shape.ts` fan-out 62; `store.tsx` fan-in 340 | High |
| R3 | Layer inversion and cycles make moving any file expensive | 70 upward imports; 12 cycles (largest 18) | High |
| R4 | The decision point is unused, so authorization stays scattered | no production callers of `decide()` | High for institutional adoption |
| R5 | Ambient time/storage/env defeat deterministic tests | 176 / 59 / 26 files | Medium |
| R6 | Documentation-as-code ships in the client tree | 81 files, 26,836 lines | Medium |
| R7 | Dead code carries its tests | 61 files, 11,883 lines unreachable from any entry | Low |
| R8 | Hot files cause merge collisions between concurrent sessions | CLAUDE.md records two duplicated pull requests in an hour | Medium |

## What is already good, and is reused

A decision point, five workflow machines, an event envelope with outbox, one
error envelope (ADR 0010), a gateway with prepare-only adapters, a narrow
backend seam, RLS with second-account check suites, and an unusually strict
culture of measured claims. The plan keeps all of it.
