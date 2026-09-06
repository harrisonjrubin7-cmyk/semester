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

/** The colour a class gets — the app's own accent, so lessons read as the spine. */
export const CLASS_TINT = 'var(--app-accent)';

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
