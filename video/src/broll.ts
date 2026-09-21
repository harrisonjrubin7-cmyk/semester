/**
 * Which B-roll insert is on screen, and how far through its fade.
 *
 * Pure and in its own file for the reason `captions.ts`, `fit.ts` and
 * `shorts.ts` are: `Documentary.tsx` imports `remotion`, which the app does
 * not have installed, so anything a guard needs to reach has to live outside
 * the composition. That arrangement earned its keep this week — a reference to
 * an undefined binding sat in `Documentary.tsx` through `tsc -b` and the lint
 * step and was only caught by rendering a frame.
 */

export interface DocumentaryShot {
  /** Second of the episode the shot starts on — a chapter mark. */
  at: number;
  seconds: number;
  /** As the app addresses it: "/video/broll/econ/chapter-3.mp4". */
  file: string;
}

/**
 * How long an insert takes to arrive and to leave.
 *
 * Longer than the chapter card's own 0.6s entrance, because a cut to footage
 * is a bigger event than a line of type sliding up: six seconds of generated
 * video appearing instantly in an otherwise typographic frame reads as a
 * glitch rather than as an edit.
 */
export const BROLL_FADE = 0.5;

export interface RunningShot {
  shot: DocumentaryShot;
  /** Seconds since the shot started. */
  since: number;
  /** 0 to 1, up through the fade in and back down through the fade out. */
  opacity: number;
}

/**
 * The shot running at a given second, or nothing.
 *
 * First match wins rather than last. Shots land on chapter marks and a chapter
 * is minutes long, so two cannot overlap unless a shot list was edited into
 * one — and if it was, showing the earlier one and letting it finish is the
 * behaviour somebody can see and correct. Two clips dissolving through each
 * other looks like a feature.
 */
export function shotAt(
  shots: readonly DocumentaryShot[],
  seconds: number,
  fade: number = BROLL_FADE,
): RunningShot | undefined {
  for (const shot of shots) {
    const since = seconds - shot.at;
    if (since < 0 || since >= shot.seconds) continue;
    const left = shot.seconds - since;
    // Never over 1, never under 0, and symmetrical at both ends.
    const opacity = Math.max(0, Math.min(1, since / fade, left / fade));
    return { shot, since, opacity };
  }
  return undefined;
}
