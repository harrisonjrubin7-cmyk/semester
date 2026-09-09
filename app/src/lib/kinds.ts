/**
 * What an event is for.
 *
 * A day is not one kind of thing. Class at nine, a shift at two, dinner with
 * family at seven and a party after are four different obligations, and a
 * schedule that renders them identically makes you read every label to find the
 * one you were looking for. Colour does that work before you read anything.
 *
 * The list is deliberately short. Twelve categories is a taxonomy nobody
 * maintains; seven is a decision you make in one tap and never revisit. Classes
 * are not in it — they come from a syllabus rather than from you, and the grid
 * draws them differently for exactly that reason.
 */

import { hueToHex } from './look';
import { LIGHT_GROUND_LUM, hueOf, satOf } from './tint';

export type EventKindId = 'study' | 'work' | 'social' | 'family' | 'health' | 'admin' | 'other';

export interface KindDef {
  id: EventKindId;
  label: string;
  /**
   * A hue on the app's single accent, not a new colour.
   *
   * The palette is silver on near-black and adding seven saturated colours to
   * it would wreck the thing. These are low-saturation tints of the same
   * metal — enough to tell apart at a glance, not enough to look like a
   * different app.
   */
  tint: string;
}

export const EVENT_KINDS: KindDef[] = [
  { id: 'study', label: 'Study', tint: '#8fb4d9' },
  { id: 'work', label: 'Work', tint: '#c8a97e' },
  { id: 'social', label: 'Social', tint: '#c58fb4' },
  { id: 'family', label: 'Family', tint: '#8fc9a8' },
  { id: 'health', label: 'Health', tint: '#d99a8f' },
  { id: 'admin', label: 'Admin', tint: '#a8a4c9' },
  { id: 'other', label: 'Other', tint: '#9aa2ad' },
];

const BY_ID = new Map(EVENT_KINDS.map((k) => [k.id, k]));

export function kindOf(id: string | undefined): KindDef {
  return BY_ID.get((id ?? 'other') as EventKindId) ?? EVENT_KINDS[EVENT_KINDS.length - 1];
}

/**
 * The colour a class gets when the courses are not coloured separately — the
 * app's own accent, so lessons read as the spine. With "a colour per course"
 * on, which is the default, a class wears its course's instead. See
 * `lib/tint.ts`.
 */
export const CLASS_TINT = 'var(--app-accent)';

/**
 * A kind's colour, drawn for the ground it is actually on.
 *
 * The table above is one set of values, mixed for a dark screen, and on
 * Parchment the same seven came out as pastels a couple of steps off the
 * page — a category colour you cannot see is a category that is not there.
 *
 * So on a dark ground this returns the table verbatim: those values are the
 * palette and a change of ground must not become a change of palette. On a
 * light one it keeps both the hue *and* the saturation and moves only the
 * lightness, to the step the course palette uses in that direction. Keeping
 * the saturation is the part that matters: "Other" is a near-grey on purpose,
 * and re-mixing every kind at the palette's own saturation would turn the one
 * category meaning "uncategorised" into a blue.
 */
export function kindTint(id: string | null | undefined, light: boolean): string {
  const tint = kindOf(id ?? undefined).tint;
  return light ? hueToHex(hueOf(tint), LIGHT_GROUND_LUM, satOf(tint)) : tint;
}

/**
 * What a block on a grid is called out loud.
 *
 * The grids carry three facts in colour and shape alone: which kind of thing a
 * block is (a 2px tinted border), whether it is cancelled (opacity and a
 * line-through), and — on the week grid — very little else, because a block
 * three hours wide on a phone has room for a word and a half.
 *
 * A tinted border is invisible to a screen reader and a line-through is
 * announced by some and not others. So the kind and the cancellation are said
 * in words here, and both grids use this rather than each writing their own
 * and drifting.
 */
export function blockLabel(
  title: string,
  kind: string | null | undefined,
  when: string,
  meta = '',
  canceled = false,
): string {
  // `null` is the app's way of saying "a class", which is the one kind that is
  // not in `EVENT_KINDS` because it comes from a syllabus rather than a person.
  const what = kind === null || kind === undefined ? 'Class' : kindOf(kind).label;
  const bits = [title, what, when];
  if (meta.trim()) bits.push(meta.trim());
  if (canceled) bits.push('Cancelled');
  return `${bits.join('. ')}.`;
}
