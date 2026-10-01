# Progressive disclosure rules

Semester remains deep without demanding that depth all at once.

## Layer 1 - act

The default view answers: where am I, what matters, what should I do next, can
I trust it, and where is more detail? It contains one dominant decision, one
primary action and the minimum source/status context needed to act safely.

## Layer 2 - understand

Opened by a specific trigger such as **Why this?**, **Review conflict** or
**View your week**. It contains rationale, source and freshness, affected
course/term, impact, one recommendation, up to two alternatives and a human or
official fallback.

## Layer 3 - explore

Opened by an explicit advanced route. It contains full schedules and backlogs,
scenario comparison, analytics, policies, history, export, integrations and
advanced settings. Layer 3 is always reachable and never auto-expanded.

## Trigger contract

Use a primary CTA for the needed action, a why link for rationale, a review
link for a known problem, an accordion for related explanation, an object tap
for object detail, a tab for an intentional mode change, and a named route for
complex work. On mobile use a sheet for short contextual detail; on desktop a
drawer may preserve context. Long reading and complex comparison use a full
page or Focus View.

Labels describe what opens: **View source**, **Compare courses**, **See all
deadlines**, **Review conflict**, **Advanced planning options**. Avoid **More**
or **Details** when a specific label fits.

## No-surprise rules

- Never auto-expand advanced detail.
- Never open a modal merely because detail exists.
- Never force completion to return to the prior context.
- Preserve the invoking control and restore focus when an overlay closes.
- Before share, send, export, delete, connect, pay, submit or official handoff,
  show exact scope, recipient, consequence and recovery.
- After an external or irreversible action, show the outcome and receipt.

## Current primitives

Use `app/src/components/Fold.tsx`, `app/src/components/ExplanationSheet.tsx`,
`app/src/components/Popover.tsx`, `app/src/components/unity/UnityLayer.tsx`
and full routed screens. All dialog-like surfaces use
`app/src/a11y/modal.ts`.
