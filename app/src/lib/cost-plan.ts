import { finite, obj, textValue } from './device-library';
import type { SourceLabel } from './source';

/**
 * What a term costs, line by line (Phase D, `cost_planner`).
 *
 * The graduation simulator took one number per term. A student deciding
 * whether a summer course or a term abroad is worth it needs to see *which*
 * cost moves — tuition does, rent may not — and to know where each figure
 * came from. So each line says what it is, whether it is a fall/spring or a
 * summer cost, and its source:
 *
 * - **Student entered**: their own estimate.
 * - **Imported**: copied from a figure their school publishes (a cost of
 *   attendance page, a tuition table). Semester has not checked it, and says
 *   where it was copied from and when, because published costs change every
 *   year.
 *
 * Never "institution verified": nothing here comes from an institution feed.
 * Never aid: these are costs before any aid, and the screen says so. The
 * totals are estimates, not a bill.
 */

export type CostSource = Extract<SourceLabel, 'student_entered' | 'imported'>;

export interface CostLine {
  id: string;
  label: string;
  /** Dollars. */
  amount: number;
  /** A fall or spring term, or a summer term. */
  per: 'term' | 'summer';
  source: CostSource;
  /** For an imported figure: where it was copied from ("Tuition page, 2026–27"). */
  from?: string;
  /** For an imported figure: when it was copied, YYYY-MM-DD. */
  on?: string;
}

export const MAX_LINES = 20;

export const LINE_KINDS = ['Tuition', 'Fees', 'Housing', 'Food', 'Books and supplies', 'Travel', 'Other'] as const;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readCostLines(value: unknown): CostLine[] {
  if (!Array.isArray(value) || value.length > MAX_LINES) throw new Error('Saved costs are not valid.');
  const lines = value.map((v) => {
    if (
      !obj(v) ||
      !textValue(v.id, 100) ||
      !v.id ||
      !textValue(v.label, 60) ||
      !v.label.trim() ||
      !finite(v.amount, 0, 1_000_000) ||
      (v.per !== 'term' && v.per !== 'summer') ||
      (v.source !== 'student_entered' && v.source !== 'imported')
    ) {
      throw new Error('A saved cost is not valid.');
    }
    const line: CostLine = { id: v.id, label: v.label, amount: v.amount, per: v.per, source: v.source };
    if (v.from !== undefined) {
      if (!textValue(v.from, 200)) throw new Error('A saved cost is not valid.');
      if (v.from.trim()) line.from = v.from;
    }
    if (v.on !== undefined) {
      if (!textValue(v.on, 10) || !ISO_DAY.test(v.on)) throw new Error('A saved cost is not valid.');
      line.on = v.on;
    }
    return line;
  });
  if (new Set(lines.map((l) => l.id)).size !== lines.length) throw new Error('Cost ids must be unique.');
  return lines;
}

/**
 * The lines to keep when the student starts itemising. A plan with no lines
 * already carries a per-term and a summer figure the student typed; the first
 * line added must not replace those with its own (usually zero) amount, so
 * they come in as lines of their own, which the student can edit or remove.
 */
export function startItemising(before: CostLine[], next: CostLine[], had: { perTerm: number; summer: number }): CostLine[] {
  if (before.length || !next.length) return next;
  const carried: CostLine[] = [];
  if (had.perTerm > 0) carried.push({ id: 'earlier-term', label: 'Earlier estimate', amount: had.perTerm, per: 'term', source: 'student_entered' });
  if (had.summer > 0) carried.push({ id: 'earlier-summer', label: 'Earlier estimate', amount: had.summer, per: 'summer', source: 'student_entered' });
  return [...carried, ...next.filter((l) => !carried.some((c) => c.id === l.id))].slice(0, MAX_LINES);
}

/** The two numbers `lib/graduation.ts` projects with. */
export function totals(lines: CostLine[]): { perTerm: number; summer: number } {
  let perTerm = 0;
  let summer = 0;
  for (const l of lines) {
    if (l.per === 'term') perTerm += l.amount;
    else summer += l.amount;
  }
  return { perTerm, summer };
}

/**
 * The weakest source among the lines of one kind — what a total built from
 * them may claim. One student-entered line makes the total student entered.
 */
export function totalSource(lines: CostLine[]): CostSource | null {
  if (!lines.length) return null;
  return lines.every((l) => l.source === 'imported') ? 'imported' : 'student_entered';
}

/**
 * How old an imported figure is, in words, or null. Published costs are set
 * a year at a time, so a figure copied more than a year ago is flagged as
 * probably out of date rather than silently used.
 */
export function staleness(line: CostLine, now: Date): string | null {
  if (line.source !== 'imported' || !line.on) return null;
  const [y, m, d] = line.on.split('-').map(Number);
  const days = Math.floor((now.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  return days > 365 ? 'Copied over a year ago — published costs change each year.' : null;
}
