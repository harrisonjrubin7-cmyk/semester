# ADR-0030 · Adopt the Semester Design System Reference as the implementation contract

Status: **Proposed** (2026-10-04, phase D0). Needs decision: supply the reference PDF; U-1 to U-6.

## Context

The adoption prompt (and a PDF analysis of it) asks that the live product implement the Semester Design System Reference. The PDF itself was not in the repository or the upload. The repository already has a design programme (DESIGN-SYSTEM-GUIDE.md, docs/design/*, a Phase 0-8 migration plan) whose rules differ from the prompt in six places (adoption audit §3).

## Proposed decision

The reference becomes the contract only for the parts a person has reconciled against the existing guide. Where they conflict, the ADR that resolves the conflict (0031-0033, 0037) is authoritative, and DESIGN-SYSTEM-GUIDE.md is edited in the same change. The contract extends the existing tokens, components and guards; it does not add a parallel theme or kit.

## Consequences

D1 cannot start until the PDF is supplied and U-1..U-6 are decided. Existing guides get amended, not duplicated. Every later ADR cites this one.

## Evidence

docs/design/DESIGN_SYSTEM_ADOPTION_AUDIT.md §0, §3.

## Not decided here

Whether the PDF contains rules beyond the prompt.
