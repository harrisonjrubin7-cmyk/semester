# Screen quality and regression checklist

A screen is ready only when every applicable item below is evidenced.

## Calm and clear

- Page purpose and primary action are obvious within five seconds.
- One dominant card/workspace appears first in DOM and visual order.
- Initial viewport stays within the Layer 1 content budget.
- Optional, analytical and historical content is deliberately revealed.
- Cards represent objects, decisions, choices or state; ordinary reading is flat.
- Motion or color never competes with real status.

## Deep and trustworthy

- Every existing capability remains reachable within a deliberate path.
- Source, freshness, uncertainty, assumptions, AI state and privacy boundary
  appear at the point of decision.
- Search, back-to-context and recent work preserve continuity.
- External and irreversible actions preview scope and leave a receipt.

## Recoverable

- Empty, loading, saving, success, stale, offline, permission-denied and error
  states have been exercised.
- Refresh preserves the last usable state.
- Errors name impact, preserved work, recovery, fallback and reference.
- Low-risk local actions offer Undo; high-impact actions confirm.

## Accessible

- Heading and landmark order is logical.
- Route change focuses the page heading; overlays focus their title and return
  focus to the invoker; async status does not steal focus.
- Keyboard reaches the primary action in a predictable path.
- Screen reader identifies context, term, source/freshness, plan state,
  primary action, errors and navigation.
- Status is understandable without color.
- Touch targets, contrast, 200-400% zoom, reduced motion, high contrast and
  forced colors pass.

## Responsive and resilient

- 320px, 390px, 760px, 1180px and a wide desktop have no horizontal overflow.
- Mobile uses a decision flow or agenda instead of a compressed desktop grid.
- Long titles, translations, policy text, tables and source excerpts wrap or
  move to a dedicated reading view.
- Low-bandwidth/offline presentation keeps essential text, cached plan, source
  state and recovery.
- Focus View keeps the task, source, help, save state and exit.

## Evidence

Run, from `app/`: `npm run lint`, focused component tests, `npm run build`,
`npm run sweep:contrast`, `npm run sweep:targets`, and the relevant smoke or
screen audit. Capture representative desktop, tablet, mobile, high-contrast,
reduced-motion, empty, loading, error, permission and long-content states.

Record discovered inconsistency in [DESIGN-DEBT.md](DESIGN-DEBT.md) with a
canonical replacement and priority; do not fix it with another one-off pattern.
