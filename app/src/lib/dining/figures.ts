/**
 * A dining figure on screen always says where it came from and how old it is.
 *
 * The label is one of the five in `lib/source.ts`, the same five the database
 * enforces, and nothing here invents a sixth. The one rule this file adds:
 * a figure is **authoritative** only when it came from the institution's own
 * dining system over a live partner connection, within its freshness target.
 * Everything else — a cached read from before the connection dropped, a
 * number the student typed from the card office's website, Semester's own
 * arithmetic — is shown, labelled, and never called official.
 */
import { money } from '../cost';
import { freshnessFromAge } from '../integration/freshness';
import { sourceLine, type SourceLabel } from '../source';

export type FigureUnit = 'swipes' | 'cents';

export interface Figure {
  value: number;
  unit: FigureUnit;
  label: SourceLabel;
  /** When the figure was true, epoch ms. Null when nobody knows. */
  at: number | null;
  authoritative: boolean;
  /** What a student reads, with the source and the age in it. */
  line: string;
}

/** How long a partner read stays "recent" before it is labelled for review. */
export const DINING_FRESHNESS_MINUTES = 60;

export function valueText(value: number, unit: FigureUnit): string {
  if (unit === 'cents') return money(value);
  return `${value} ${value === 1 ? 'swipe' : 'swipes'}`;
}

export function figure(value: number, unit: FigureUnit, label: SourceLabel, at: number | null, now: number): Figure {
  return {
    value,
    unit,
    label,
    at,
    authoritative: label === 'institution_verified',
    line: `${valueText(value, unit)} · ${sourceLine(label, at, now)}`,
  };
}

/**
 * The label a figure read from the partner earns, given when it was read and
 * whether the connection is live now. Live and within the target: verified.
 * Anything older, or read over a connection that has since dropped: needs
 * review, with its age on it.
 */
export function partnerLabel(readAt: number | null, live: boolean, now: number): SourceLabel {
  const f = freshnessFromAge(readAt === null ? null : new Date(readAt), DINING_FRESHNESS_MINUTES, new Date(now), live);
  return f === 'live' || f === 'recent' ? 'institution_verified' : 'needs_review';
}
