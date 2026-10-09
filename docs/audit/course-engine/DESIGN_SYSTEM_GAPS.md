# Design system gaps

## Implemented in this pass

- Canonical course-engine CSS tokens for Ink `#090a0e`, Parchment `#f4f1ea`, Semester blue, source-state colors, 2 px/8 px spacing, type roles, density, and 130/180/240/280 ms motion.
- No gradients, stock imagery, decorative AI art, bounce, shimmer, or icon-only mobile destinations.
- Hairline borders before elevation, 66-character reading width, tabular numeric treatment, reduced-motion, forced-colors, and increased-contrast contracts.
- One visible H1 per course route, 44 px primary targets, visible focus, skip link, labeled nav regions, and responsive collapse below 900 px.

## Remaining

| Gap | State |
|---|---|
| Reconcile `course-engine/apps/web/app/tokens.css` with the generated `app/design-tokens/semester.tokens.json` source | documented |
| Load licensed/local Barlow, Barlow Condensed, and Cinzel assets without layout shift | designed |
| Visual regression snapshots at 320, 768, 1024, and 1440 px | documented |
| Full source sheet with highlighted location and focus trap | designed |
| User-controlled reader ground, density, contrast, and low-stimulation preferences in the Next.js app | designed |
| Component examples/Storybook or equivalent for the standalone package | documented |

The frontend UI engineering skill guided the split into focused components, explicit states, semantic tokens, keyboard behavior, and tests instead of a monolithic dashboard surface.
