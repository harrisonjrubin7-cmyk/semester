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
