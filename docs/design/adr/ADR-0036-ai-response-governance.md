# ADR-0036 · Govern AI response presentation with scope, sources, cost and policy disclosure

Status: **Proposed** (2026-10-04, phase D0). Can proceed independently; a new composed component.

## Context

The AI receipt is shown under the last answer only, behind a flag; cost is a monthly count; confidence code is unused by the UI; there is no step status, source drawer or proposal confirmation state.

## Proposed decision

Every AI answer renders inside AIResponse: AI-assisted label, data scope, inline citations opening a source detail panel, confidence or uncertainty (using assistant-confidence.ts), per-request cost, policy note, and for proposals a state of proposed, awaiting confirmation, done. Multi-step work uses StepStatus. High-impact proposals open ActionPreview in Dialog. The answer never uses official wording.

## Consequences

Chat.tsx is 107 KB of a 116 KB route budget; the new component must be shared, not added. A guard fails on AI output without the label.

## Evidence

docs/design/STATUS_AND_PROVENANCE_AUDIT.md §4; app/src/ai/*; app/perf-budgets.json.

## Not decided here

What cost is shown for the shared-key meter versus a student's own key.
