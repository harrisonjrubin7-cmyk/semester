import type { CSSProperties } from 'react';

/*
 * The row shape of the dining screens: what a thing is, over its meta line,
 * then its amount, then any control — wrapping under each other at 320px
 * rather than squeezing. Tokens only; no new
 * colour, radius or spacing.
 */
export const ROW: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', alignItems: 'baseline' };
export const WHAT: CSSProperties = { flex: '1 1 12em', minWidth: 0 };
export const META: CSSProperties = { display: 'block', fontSize: 'var(--type-xs)', color: 'var(--app-dim)' };
export const AMOUNT: CSSProperties = { flex: 'none', fontVariantNumeric: 'tabular-nums' };


/** A secondary sentence under a figure or a form: the small step, dimmed. */
export const NOTE: CSSProperties = { fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' };
