import { useMemo } from 'react';
import { useStore } from '../state/store';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { tintChoices, type CourseTint } from '../lib/tint';
import { GROUP_TONES } from '../lib/browser';

/**
 * The twelve colours a tab group can wear.
 *
 * The same twelve a course can be pinned to, from the same place — a group is
 * a colour on the strip, and a strip drawn in crayons over an app whose whole
 * look is one metal would be the one row that does not belong to it. See
 * `lib/tint.ts`: every one of these is the reader's own accent turned round
 * the wheel, at a lightness measured to clear 4.5:1 on the ground they are
 * actually reading on, so a group's name is legible on Parchment and on Ink
 * without anybody choosing it twice.
 *
 * Here rather than in `lib/browser.ts` because a strip is a value and a colour
 * is a look: the model stores which of the twelve, and this is the only place
 * that knows what the twelve are today.
 */
export function useTones(): CourseTint[] {
  const { state } = useStore();
  // The resolved ground, not the stored one: on "match my device" the strip
  // has to be drawn for the screen in front of somebody.
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;
  return useMemo(
    () => tintChoices(state.accent, state.hue, light),
    [state.accent, state.hue, light],
  );
}

/** One of them, safe against a tone stored by a build with a longer palette. */
export function toneAt(tones: CourseTint[], tone: number): CourseTint {
  return tones[((tone % GROUP_TONES) + GROUP_TONES) % GROUP_TONES] ?? tones[0];
}
