/**
 * Types for `explainer.mjs`.
 *
 * Same arrangement as `restyle.d.mts`, `align.d.mts`, `personas.d.mts` and
 * `broll.d.mts`.
 */

export interface SourceCue {
  at: number;
  kind: string;
  text: string;
}

export interface SourceUnit {
  unit: number;
  title: string;
  file: string;
  seconds: number;
  len: string;
  cues?: SourceCue[];
}

export interface PlannedUnit extends SourceUnit {
  /** Second of the whole explainer this unit starts on. */
  at: number;
}

export interface PlacedCue extends SourceCue {
  /** Which unit it came from. */
  unit: number;
}

export interface Chapter {
  at: number;
  t: string;
  title: string;
}

export interface Band {
  min: number;
  max: number;
}

export interface Run {
  units: SourceUnit[];
  seconds: number;
  /** Units after this run that did not fit. */
  left: number;
}

export interface Plan {
  from: number;
  to: number;
  left: number;
  seconds: number;
  len: string;
  units: PlannedUnit[];
  cues: PlacedCue[];
  chapters: Chapter[];
  hook: { until: number; questions: string[] };
  band: Band;
  /** Under the band's floor. Advice, not a refusal. */
  short: boolean;
  why?: undefined;
}

export interface Refused {
  why: string;
  units?: undefined;
  short?: undefined;
  seconds?: undefined;
  left?: undefined;
  chapters?: undefined;
  cues?: undefined;
  hook?: undefined;
}

export const UNIT_GAP: number;
export const BAND: Band;
export const HOOK_MAX: number;
export const HOOK_MIN: number;

export function unitsOf(lessons: Record<string, SourceUnit>): SourceUnit[];
export function runWithin(units: readonly SourceUnit[], from?: number, band?: Band): Run;
export function timeline(units: readonly SourceUnit[]): {
  units: PlannedUnit[];
  cues: PlacedCue[];
  seconds: number;
};
export function mmss(seconds: number): string;
export function hookEnd(cues: readonly { at: number }[], max?: number, min?: number): number;
export function hookQuestions(units: readonly SourceUnit[], most?: number): string[];
export function chaptersOf(placed: readonly PlannedUnit[]): Chapter[];
export function chapterText(chapters: readonly Chapter[]): string;
export function planExplainer(
  lessons: Record<string, SourceUnit>,
  options?: { from?: number; to?: number; band?: Band; hookSlots?: number },
): Plan | Refused;
export function explainerTitle(
  name: string,
  plan: { from: number; to: number; left: number },
): string;
