import { CUE_LEAD, cueIndexAt } from '../../app/src/lib/beats';
import { GLYPH } from './fit';

/**
 * Which line of an episode is being spoken, at a given second.
 *
 * The times come from `audio/scripts/*.lines.json` — written by
 * `audio/synth.py` for anything rendered from now on, recovered from the
 * audio by `pipeline/align-audio.mjs` for the four episodes that shipped
 * before it wrote them.
 *
 * ## Per line, not per word
 *
 * A line is one speaker's turn, three to nine seconds of it. That is the
 * resolution the times have and it is the resolution the captions get.
 * Splitting a line into phrases would mean apportioning its seconds by
 * character count, which is the technique this whole step exists to avoid —
 * the difference is only that inside one line it would be wrong by a second
 * instead of by twenty. `video/README.md` says the same thing about shorts:
 * captioned without a captioning pass, but per beat rather than per word, so
 * nothing bounces along with the voice.
 */

export interface LineTime {
  /** Index into the script's `lines`. */
  i: number;
  /** Second the line's audio begins. */
  s: number;
  /** Second it ends, before the beat that follows. */
  e: number;
}

/**
 * How long a caption stays up after the line stops.
 *
 * Long enough to cover a turn gap — `audio/synth.py` leaves 0.55s between
 * two speakers — so consecutive lines hand over without the frame blinking
 * empty for a fifth of a second. Short enough that the seven seconds of
 * silence the self-test leaves for answering out loud go quiet on screen
 * too, which is the point of the pause.
 */
export const CAPTION_HOLD = 0.6;

/**
 * The line showing at `seconds`, or -1 for none.
 *
 * `cueIndexAt` decides which one has started, the same function the lesson
 * player, the lesson video and the documentary's chapter cards all ask,
 * including the 150ms lead that puts type up just before the words. What is
 * left is deciding when it goes away.
 */
export function captionIndexAt(
  times: readonly LineTime[],
  seconds: number,
  hold: number = CAPTION_HOLD,
): number {
  if (times.length === 0) return -1;
  const index = cueIndexAt(
    times.map((t) => ({ at: t.s })),
    seconds,
  );
  const line = times[index];
  // Nothing has started yet: `cueIndexAt` answers 0 either way, so the first
  // line's own start has to be checked — against the same lead, or the
  // opening line would be the one caption that arrived late.
  if (seconds < line.s - CUE_LEAD) return -1;
  const next = times[index + 1];
  const until = next ? Math.min(line.e + hold, next.s) : line.e + hold;
  return seconds < until ? index : -1;
}

/**
 * One type size for the whole episode's captions.
 *
 * Two things decide it. The frame has no scrollbar — `fit.ts` makes the same
 * argument about slides — and the longest line in the four shipped scripts is
 * 556 characters, which at the size a two-line caption wants would be nine
 * lines and would run off the bottom. And the box cannot change height as the
 * captions do: it sits under the chapter card in a column that stacks from the
 * bottom, so a four-line caption following a two-line one lifts the chapter
 * name 50 pixels up the frame and drops it again. The first cut of this did
 * exactly that, and a chapter title that steps about as somebody talks reads
 * as a bug in the player.
 *
 * So the box is fixed and the type is chosen once, for the longest line the
 * episode has, at a size that fits. Every caption in an episode is the same
 * size; two renders of it are identical.
 */
export function captionType(longest: number, box: { width: number; height: number }, most = 40): number {
  for (let size = most; size > 8; size -= 1) {
    const perLine = Math.max(1, box.width / (GLYPH * size));
    const lines = Math.ceil(longest / perLine);
    if (lines * size * CAPTION_LEADING <= box.height) return size;
  }
  return 8;
}

/** Line height of caption text, as a multiple. */
export const CAPTION_LEADING = 1.35;
