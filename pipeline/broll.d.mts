/**
 * Types for `broll.mjs`.
 *
 * Same arrangement as `restyle.d.mts`, `align.d.mts` and `personas.d.mts`.
 */

export interface Shot {
  /** Where the clip goes — `econ/chapter-3`. */
  slot: string;
  /** Second of the episode it starts on: a chapter mark. */
  at: number;
  seconds: number;
  /** One of `SHOT_KIND_IDS`. */
  kind: string;
  /** The chapter this shot opens, carried so whoever writes the subject can see it. */
  chapter: string;
  /** What the camera is pointed at. Empty in a fresh draft. */
  subject: string;
}

export interface ShotKind {
  label: string;
  camera: string;
  blurb: string;
}

export interface ShotJob {
  slot: string;
  prompt: string;
  seconds: number;
  provider: string;
  model: string;
}

export interface Ceiling {
  ok: boolean;
  why?: string;
  over?: number;
}

export interface EpisodeMeta {
  course: string;
  chapters: { s: number; name: string; t: string }[];
}

export const SHOT_KINDS: Record<string, ShotKind>;
export const SHOT_KIND_IDS: string[];
export const SHOT_SECONDS: number;
export const SHOT_MIN: number;
export const SHOT_MAX: number;
export const SUBJECT_MAX: number;

export function draftShots(episode: EpisodeMeta, seconds?: number): Shot[];
export function shotPrompt(shot: Shot): string;
export function check(shot: Shot): string[];
export function checkAll(shots: readonly Shot[]): { slot: string; why: string }[];
export function shotJobs(shots: readonly Shot[], provider: string, model: string): ShotJob[];
export function withinCeiling(cents: number, ceilingCents: number): Ceiling;
