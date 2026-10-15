# ADR-0032 · Use source-aware provenance as a first-class UI requirement

Status: **Proposed** (2026-10-04, phase D0). Can proceed once the vocabulary table is agreed; independent of the visual decisions.

## Context

Four vocabularies (source.ts, status.ts, where.ts, factprovenance.ts) disagree on words and glyphs; SourceBadge, the dominant renderer, shows no glyph; lib/source is imported by 3 screens.

## Proposed decision

One table keyed by the ten source kinds (official ◆ Institution verified, connected ⇄, imported ↓, personal ○ Student entered, ai ✦, estimated ≈, review ?, stale !, external ↗, sample ◌) owns glyph, label, tone and meaning. source.ts text, status.ts provenance rows, SourceBadge and ProvenanceChips read from it. SOURCE_LABELS (DB-tied, lib/source.test.ts) is unchanged. SourceLine is added for statements that connect a consequence to its source. A guard fails on a hand-rolled badge.

## Consequences

Resolves DD-003 as Institution verified. unity.test.ts and decisionlabels.test.ts change in the same PR. Screens presenting official records, grades, registration, bills, degree progress, AI answers, imports or estimates must show provenance at the right level.

## Evidence

docs/design/STATUS_AND_PROVENANCE_AUDIT.md; app/src/lib/factprovenance.ts:86-114; app/src/components/SourceBadge.tsx.

## Not decided here

Where freshness is shown (badge vs line).
