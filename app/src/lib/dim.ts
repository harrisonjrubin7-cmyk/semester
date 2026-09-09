/**
 * Dimming, as a colour rather than as a filter.
 *
 * `lib/look.ts` gives every ground three strengths of its own ink — `--app-fg`
 * for what you read, `--app-dim` for the line under it, `--app-faint` for
 * large type — and `contrast.test.ts` audits all three against every panel of
 * every ground. That audit is the reason the app is legible on Oxide and on
 * Parchment alike, and it is worth exactly as much as the number of places
 * that use the tokens.
 *
 * Components had stopped using them. Secondary text was written a thousand
 * times as `opacity: 0.55`, `0.5`, `0.45` — numbers picked by eye on one
 * ground, held to no threshold, and invisible to the audit. Two things follow
 * from that, and both were measured in a browser before this file existed.
 *
 * ## Opacity multiplies, and nobody chose the product
 *
 * A row dimmed because it is ticked off sets `opacity` on the whole row. The
 * second line inside it sets its own. The two compose, so a line written at
 * 0.55 inside a row written at 0.42 renders at **0.23** — 1.9:1 against the
 * ground, against the 4.5:1 the same repo enforces on its tokens. Nobody typed
 * 0.23. It is what "dim the row" and "dim this line" come to when they meet,
 * and it lands on the most ordinary act in the app: ticking something off and
 * then trying to read what you ticked.
 *
 * A colour does not compose. `--app-dim` inside a dimmed row is the row's
 * dimming and nothing more, which is what was meant both times.
 *
 * ## And "Increase contrast" cannot reach an opacity
 *
 * `tokensFor` raises `--app-dim` to 0.9 and `--app-faint` to 0.76 when the
 * device asks for more contrast. Measured on Today with `prefers-contrast:
 * more` on: the tokens rose correctly, **no** element on the screen used
 * either of them, and fourteen were still dimmed by an inline opacity the
 * setting cannot see. The accessibility setting the app ships was doing
 * nothing on its front screen.
 *
 * So: text is dimmed with `color`. Opacity is left to what it is actually
 * for — the state of a whole row, tag and tick and rule together — and the
 * two are not stacked.
 */

/**
 * How far a whole row drops when it is not one of the live ones.
 *
 * Ticked off, gone by, cancelled, a term date already past, a reading with no
 * day set aside for it yet — one value for all of them, because they are one
 * idea: this row is not what you are here for. It applies to the row rather
 * than to its text, which is the point — the course tag and the coloured edge
 * go with it, and a row half-dimmed reads as a rendering fault rather than as
 * a state. That is the one job a colour cannot do, and the only thing
 * `opacity` is left for here.
 *
 * A token rather than a number, because the right alpha is a property of the
 * ground. Five call sites had each arrived at 0.40, 0.42 or 0.45 by eye on a
 * dark ground; on Parchment the same 0.5 renders at 3.28:1, because dark ink
 * on a light page fades faster than light ink on a dark one. `--app-row-dim`
 * carries the ground's own `dimAlpha` — already audited to 4.5:1 on every
 * panel of every ground — and rises when the device asks for more contrast.
 */
export const DIMMED_ROW = 'var(--app-row-dim)';

/**
 * The style for a second line — the time, the room, the course, the count.
 *
 * Takes whether the row around it is already dimmed, and that argument is the
 * whole reason this is a function. Inside a dimmed row it returns no colour of
 * its own: the row has already said "behind you" once, and saying it twice is
 * the multiplication above.
 */
export function secondLine(rowIsDimmed = false): { color?: string } {
  return rowIsDimmed ? {} : { color: 'var(--app-dim)' };
}

/**
 * The same, for text large enough to be read at the faint rung.
 *
 * `--app-faint` is audited to 3:1, which WCAG allows for large text only —
 * 24px, or 18.66px bold. Use it for a figure, not for a caption; `secondLine`
 * is the one that is safe at 11px.
 */
export function faintLine(rowIsDimmed = false): { color?: string } {
  return rowIsDimmed ? {} : { color: 'var(--app-faint)' };
}
