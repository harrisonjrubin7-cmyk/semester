# ADR-0040 · Enforce token-only visual primitives and design-system CI checks

Status: **Proposed** (2026-10-04, phase D0). Can proceed independently; recommended first.

## Context

The repo already ratchets type, spacing, hex in TSX and durations by per-file ledger (styles/budget.ts, hex.test.ts, motion.test.ts). It does not cover inline borderRadius (319), boxShadow (26), fontFamily (261), pill radii (999px ×32), hand-rolled badges, icon-only tooltips, emoji, exclamation marks, user/learner, or date order. gallery:shots is not in CI.

## Proposed decision

Extend the ledger model to those axes, ratcheting down and failing on increase. Add the content rules in CONTENT_AND_VOICE_AUDIT §4, the glyph/word parity test, an icon-only-tooltip lint, and put gallery:shots in CI behind a baseline PR checklist. Add a PR checklist and component ownership and deprecation rules to docs/design/GOVERNANCE.md.

## Consequences

New literals fail the build; existing debt is ledgered, not hidden. Runner-made screenshot baselines need a fixed environment.

## Evidence

app/src/styles/rules.ts, budget.ts; app/src/styles/hex.test.ts; app/scripts/gallery-shots.mjs; docs/design/GOVERNANCE.md.

## Not decided here

Baseline storage (repo vs artefact).
