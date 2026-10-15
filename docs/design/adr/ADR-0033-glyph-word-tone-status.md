# ADR-0033 · Use glyph plus word plus tone for all status semantics

Status: **Proposed** (2026-10-04, phase D0). Depends on U-4 for tone hues.

## Context

status.ts has glyph, label, tone and a boolean urgent but no announcement text; Pending approval, Approved, Rejected, Verified, Hold on account, Draft, Live and Preview are missing or plain strings; colour dots (32) and .trust-scorecard-row.is-* are colour-only.

## Proposed decision

StatusChip renders glyph, label and tone for every status in the brief's list, plus an announce string in role=status (polite; assertive when urgent). Status colour is text, hairline, small wash and glyph only. Words follow the brief (Conflict needs review, Sync trouble, Pending approval, Rejected).

## Consequences

Renames Conflict/Sync error and Not approved/Pending. Needs a guard in tellings.test.ts style for colour-only status.

## Evidence

app/src/lib/status.ts:33-69; app/src/components/unity/Status.tsx; app/src/styles/app.css:10694-10696.

## Not decided here

Whether alert/assertive is allowed for any status other than offline, conflict and sync trouble.
