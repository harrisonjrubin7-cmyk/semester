# 6 · Architecture tests

`app/src/architecture/architecture.test.ts` (43 tests with the inventory's).
Run alone: `cd app && npx vitest run src/architecture`.

## Why a scanner

TypeScript 7 has no JS API to ask for a file's imports, so
`src/architecture/graph.ts` reads them. It strips comments, lifts string
literals out before matching (a string can contain an import statement), and
recognises a regex literal by what precedes its slash (a quote inside `/'/g`
otherwise swallows the rest of the file). Both failure modes were in the first
draft and the scanner's own controls caught them. It was then checked against
an independent regex graph of the real tree: identical, 6,000 edges, 12 cycles.

## Rules

Strict = applies to new code, no allowlist. Ratchet = applies to legacy and may
only improve.

| rule | kind | holds |
|---|---|---|
| kernel-is-a-leaf | strict | `kernel/` imports nothing from the app |
| core-is-pure | strict | `domain/` imports own `domain/`, kernel, `@semester/*`; no ambient state |
| application-depends-inward | strict | `application/` imports domain, kernel, packages, other slices' `index.ts`; no ambient state |
| adapters-are-the-only-door | strict | `adapters/` may import legacy logic; never a screen/component/third-party module |
| slice-doors-stay-shut | strict | outside a slice, only `index.ts` (and `adapters/index.ts` from `composition/`) |
| slices-are-acyclic | strict | slice-to-slice imports form a DAG |
| legacy-does-not-reach-into-composition | strict | only the shell and screens import `composition/` |
| slice-shape | strict | front door, tests, nothing loose, files ≤ 350 lines |
| error-codes-name-their-slice | strict | `fail('…', '<slice>.<reason>')` |
| legacy-imports-do-not-point-up | ratchet | exactly the 70 recorded imports; a new one fails, and so does a recorded one that has gone |
| legacy-cycles-do-not-grow | ratchet | 12 cycles, largest 18; more fails, fewer fails until `legacy.json` is lowered |
| locked-screens-stay-locked | ratchet | a locked screen imports no `lib/`, `state/`, `data/`, `ai/`, … |
| packages-do-not-import-the-app | strict | `packages/*` never import `app/` |

## How each is known to be a rule

Every strict rule has a fixture that starts from one clean slice (which must
pass *every* rule, so a rule that refused everything fails) and changes exactly
one thing. Then, on the real tree, twelve faults were injected one at a time
and each went red (and was restored): core imports legacy; application reads
the wall clock; adapter imports a screen; lib reaches into a slice's insides;
lib gains an upward import; a slice imports another's insides; an error code
names the wrong slice; and five behavioural faults in the slice's parity and
rule tests.

## Adding and tightening

- **Lock a screen:** when it reads only `composition/`, add its path to
  `lockedScreens` in `legacy.json`. This is the last step of its migration.
- **Pay down a legacy import:** remove the import; the test then fails with
  "is gone: delete it from legacy.json"; delete that line. The list is sorted,
  so two sessions removing different lines merge cleanly.
- **A new slice:** it needs `index.ts`, a test, and obeys the rules above with
  no exception mechanism. There is deliberately none.

## What these tests do not catch

- A computed or string-built import path; `import.meta.glob` (the app uses none).
- Coupling through shared storage keys or global events: two slices reading the
  same `localStorage` key is not an import. Phase 6 (state by domain) addresses
  it; a census of storage keys per owner is the next test to write.
- Type-only imports are counted as imports (they are compile-time coupling).
- Runtime behaviour. Parity tests cover what was wrapped; they say nothing
  about what was not.
- Semantic duplication (two lifecycles for one idea). That is a review matter.

## CI

They run in `npm test` and `npm run test:shuffle`; they read only files, with
no timing or shared state, so order does not matter.
