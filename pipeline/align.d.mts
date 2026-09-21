/**
 * Types for `align.mjs`.
 *
 * Same arrangement as `restyle.d.mts`, and for the same reason: the module
 * stays plain JavaScript because every script in `pipeline/` does, and
 * `app/src/lib/align.test.ts` is TypeScript that `tsc -b` covers.
 */

export interface ScriptLine {
  chapter?: string;
  v: string;
  t: string;
  pause?: number;
}

export interface QuietRun {
  /** Seconds into the track. */
  from: number;
  to: number;
}

export interface LineTime {
  /** Second the line's audio begins. */
  s: number;
  /** Second it ends, before the beat that follows. */
  e: number;
}

export interface ChapterMark {
  s: number;
  name: string;
  t: string;
}

export interface Recovered {
  times: LineTime[];
  /** Characters of script a second — the episode's own speaking rate. */
  perSecond: number;
  /** Quiet runs long enough to stand for a gap. */
  runs: number;
  /** Gaps that should have produced one. */
  gaps: number;
  why?: undefined;
}

export interface Refused {
  why: string;
  times?: undefined;
}

export interface Verdict {
  ok: boolean;
  why?: string;
  checked?: number;
  misses?: { name: string; want: number; got: number }[];
  worst?: number;
}

export const GAP_SAME_SPEAKER: number;
export const GAP_TURN: number;
export const GAP_CHAPTER: number;
export const FLOOR: number;

export function expectedGaps(lines: readonly ScriptLine[]): number[];
export function quietRuns(
  samples: ArrayLike<number>,
  rate: number,
  options?: { threshold?: number; minSeconds?: number },
): QuietRun[];
export function alignGaps(
  gaps: readonly number[],
  spans: readonly number[],
  runs: readonly QuietRun[],
  options?: { spanWeight?: number },
): number[] | null;
export function lineTimes(
  lines: readonly ScriptLine[],
  runs: readonly QuietRun[],
  totalSeconds: number,
  options?: { spanWeight?: number },
): Recovered | Refused;
export function checkAgainstChapters(
  lines: readonly ScriptLine[],
  times: readonly LineTime[],
  chapters: readonly ChapterMark[],
): Verdict;
