/**
 * Types for `likeness.mjs`.
 *
 * Written when `styles.test.ts` became the first TypeScript caller — the other
 * two reach it through `personas.mjs` and `broll.mjs`, which have their own
 * declarations, so `tsc -b` never had to resolve this one directly.
 */

/** The phrase that points at somebody, or undefined. */
export function pointsAtSomebody(text: unknown): string | undefined;
