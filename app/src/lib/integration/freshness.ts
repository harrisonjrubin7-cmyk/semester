/**
 * How fresh an imported fact is, and what a screen may say about it.
 *
 * The rule the command states and this file enforces: an estimated, stale or
 * manually entered object is never presented as the official current record.
 * `isOfficialCurrent` is the only way a card should decide to say "official".
 */
import type { Freshness } from './catalog.ts';

/** Freshness from the age of the last successful sync against its target. */
export function freshnessFromAge(
  lastSuccess: Date | null,
  targetMinutes: number,
  now: Date,
  connectionLive: boolean,
): Freshness {
  if (!connectionLive || !lastSuccess) return 'unavailable';
  const age = (now.getTime() - lastSuccess.getTime()) / 60_000;
  if (age < 0) return 'needs_confirmation';
  if (age <= Math.min(5, targetMinutes)) return 'live';
  if (age <= targetMinutes) return 'recent';
  return 'stale';
}

export function isOfficialCurrent(freshness: Freshness, sourceType: string): boolean {
  return sourceType === 'connected_institutional' && (freshness === 'live' || freshness === 'recent');
}

export const FRESHNESS_TEXT: Record<Freshness, string> = {
  live: 'Up to date',
  recent: 'Recently updated',
  stale: 'May be out of date',
  unavailable: 'Source unavailable',
  manual: 'Entered by hand',
  estimated: 'Estimate',
  needs_confirmation: 'Needs confirmation',
};

/** A sentence a screen reader and a sighted reader both get, never colour alone. */
export function freshnessSentence(freshness: Freshness, source: string, at: Date | null): string {
  const when = at ? ` · ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC` : '';
  const official = freshness === 'live' || freshness === 'recent' ? '' : ' Not the official current record.';
  return `${FRESHNESS_TEXT[freshness]} — from ${source}${when}.${official}`;
}

/** Maximum supported freshness duration: 365 days. */
export const MAX_FRESHNESS_MINUTES = 525600;

/**
 * A Postgres interval as PostgREST returns it (`IntervalStyle = postgres`):
 * `01:00:00`, `2 days`, `1 day 06:30:00`, `1 mon`. Null for anything else, so a
 * value this cannot read falls back to the adapter's target rather than to 0.
 */
export function intervalMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(?:([+-]?\d+) years? ?)?(?:([+-]?\d+) mons? ?)?(?:([+-]?\d+) days? ?)?(?:([+-]?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?))?$/.exec(value.trim());
  if (!m || m[0] === '') return null;
  const [, y, mo, d, sign, h, mi, seconds] = m;
  const total = ((Number(y ?? 0) * 365.25 + Number(mo ?? 0) * 30 + Number(d ?? 0)) * 24) * 60
    + (sign === '-' ? -1 : 1) * (Number(h ?? 0) * 60 + Number(mi ?? 0) + Number(seconds ?? 0) / 60);
  // Same duration conversion and one-minute/365-day bounds as the database/LTI writer.
  return Number.isFinite(total) && total > 0 ? Math.min(MAX_FRESHNESS_MINUTES, Math.max(1, total)) : null;
}
