import type { Basis } from './financialModelTypes';

/**
 * Display formatting with no false precision.
 *
 * A forecast built on unvalidated rates is not accurate to the dollar, so the
 * screen rounds to three significant figures ($1.23M, $456k, $12.3k) and
 * counts to one decimal. Exports carry whole dollars: they are for
 * re-analysis, not for reading.
 */

const MINUS = '-';

/** Thousands grouping that does not depend on the viewer's locale: an export must read the same everywhere. */
export const group = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function sig3(n: number): string {
  // Round to three significant figures first, then choose the unit, so 999,999 reads $1M and not "1.00e+3k".
  const r = Number(Math.abs(n).toPrecision(3));
  if (r >= 1e9) return `${trim((r / 1e9).toPrecision(3))}B`;
  if (r >= 1e6) return `${trim((r / 1e6).toPrecision(3))}M`;
  if (r >= 1e3) return `${trim((r / 1e3).toPrecision(3))}k`;
  return `${Math.round(r)}`;
}

/** Trim a toPrecision string without turning 100 into 1. */
function trim(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** Dollars to three significant figures. Null and non-finite values read as an en dash. */
export function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  if (Math.round(n) === 0) return '$0';
  return `${n < 0 ? MINUS : ''}$${sig3(n)}`;
}

/** Whole dollars with separators, for exports and exact reference. */
export function formatUsdExact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const r = Math.round(n);
  return `${r < 0 ? MINUS : ''}$${group(Math.abs(r))}`;
}

/** A price: cents matter when the number is small. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return `$${n < 1 ? n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : n < 100 ? n.toFixed(2).replace(/\.00$/, '') : group(n)}`;
}

/** Expected counts: one decimal below ten, whole above. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  if (Math.abs(n) < 0.05) return '0';
  if (Math.abs(n) < 10) return n.toFixed(1);
  return group(n);
}

export function formatPct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatMonths(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return n < 10 ? `${n.toFixed(1)} mo` : `${Math.round(n)} mo`;
}

export function formatRatio(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return `${n.toFixed(1)}x`;
}

/** Every displayed output says which it is. Only forecasts exist until an actuals feed does. */
export const basisLabel = (b: Basis): string => (b === 'actual' ? 'Actual' : 'Forecast');
