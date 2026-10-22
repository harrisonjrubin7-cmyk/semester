# Accessibility contract

Target WCAG 2.2 AA (a design requirement, not a conformance claim).

## Contrast — measured against every surface of a ground, not the flattering one
| Element | Requirement |
| --- | --- |
| Body / UI text | ≥ 4.5:1 |
| Large text (≥24px or ≥18.66px bold) | ≥ 3:1 |
| Icons, borders, focus, chart marks | ≥ 3:1 vs neighbour |
| Tertiary ("faint") ink | metadata only, never information a student must act on |
| Brass | base stop on dark only; shade stop (#695a33) for text on light |

## Structure & input
- One `main`, one visible H1, skip link; heading levels describe structure.
- Keyboard order follows reading order; focus never lands under sticky chrome (scroll margins 96 / 84px).
- 44px ordinary targets; 24px floor only in crowded composites with keyboard parity. Icon-only controls always named.
- Native inputs; persistent labels; hints and errors associated via aria-describedby; errors preserve input.
- Overlays: focus trap, Escape, outside dismissal, focus return; triggers report aria-expanded.

## Never colour alone
Every state: glyph + word + tone. Provenance origin has a second carrier in fill (solid / outline / dashed); forced colours thicken the solid chip's border to 3px.

## Reader settings the tokens respond to
Text size 0.94–1.18× (`--text-scale`) · Density 1 / .86 / .74 · Line height 1.35–1.95 · Letter/word spacing · Reading width 52–82ch · Body face incl. Atkinson Hyperlegible · Motion: Follow device / Less motion / Low stimulation (also removes gradients, shadows, quieter badges) · Increase contrast raises faint/dim/hairline alphas · 13 grounds + Match my device.

## Motion
All roles zero under reduced motion and `data-calm`. No essential meaning depends on motion. No flashing, no parallax, no looping decoration, no countdown theatre.

## Brand-exempt zones
Status/warnings, provenance, consent text and accessibility controls: body-grade type only (never Cinzel), never restyled by tenants, campaigns or themes, never animated away or hidden behind hover.
