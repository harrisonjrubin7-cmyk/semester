# ADR-0039 · Require consequence previews for high-impact student and institution actions

Status: **Proposed** (2026-10-04, phase D0). Can proceed independently.

## Context

ConfirmDialog takes a free-form preview. ActionPreview has no real call site and no who-can-help field. Five window.confirm calls remain. No confirmation was found in Bill.tsx or Grades.tsx. Institution actions (approvals, publish, integration pause/replay, ledger, money) each write their own confirmation.

## Proposed decision

Dialog requires an ActionPreview: what happens, exactly what changes, what does not change, reversibility, who can help. High-impact is a list in code (registration, grade, billing and payment, family sharing, data export or deletion, approvals, publish, break-glass, money). A guard fails on a listed action without it. window.confirm is banned.

## Consequences

Touches Registration, Billing, Grades, Family, Privacy and all institutional write paths; server-side gates are unchanged. Must not make a two-person approval look instant (ModulesPanel).

## Evidence

docs/design/STATUS_AND_PROVENANCE_AUDIT.md §5; app/src/components/unity/ActionPreview.tsx; app/src/components/ConfirmDialog.tsx.

## Not decided here

Whether TypeToConfirm remains for irreversible deletion.
