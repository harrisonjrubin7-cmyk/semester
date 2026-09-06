/**
 * How the app talks to somebody who is behind.
 *
 * The writing has a voice, and most of the time the voice is the best thing
 * about it: plain, specific, no cheerleading. But a voice tuned for somebody
 * having an ordinary week reads differently at 1am to somebody who is not.
 * "5 deadlines went by" is a true sentence that helps nobody in that moment.
 * "One thing left. Finish it." is brisk when you are fine and an instruction
 * from a machine when you are not.
 *
 * So the phrasing is a setting. Not the facts — the numbers are identical in
 * every tone, because a tone that rounded five overdue things down to "a few"
 * would be lying to be kind, which is the one thing worse than being blunt.
 *
 * ## Three, and why not four
 *
 * **Direct** is what the app already said, and stays the default. It is not
 * unkind; it is brisk, and briskness is what most people want from a planner.
 *
 * **Supportive** says the same number and leaves the judgement out. "Five are
 * still open" rather than "5 went by" — the second has an implied verdict in
 * the tense, and "went by" is the app describing your week back to you as a
 * failure.
 *
 * **Minimal** says the number and stops. For somebody who wants an instrument
 * rather than a correspondent, and for anybody who finds a sentence about
 * their week harder to read than a count.
 *
 * There is no "motivational". The app's own writing rule is no exclamation
 * marks and no cheerleading, and a motivational tone is that rule inverted —
 * it would need a second voice nobody had written, and the honest version of
 * encouragement here is a supportive tone that does not overclaim.
 */

export const TONES = ['direct', 'supportive', 'minimal'] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: { id: Tone; label: string; blurb: string }[] = [
  { id: 'direct', label: 'Direct', blurb: 'Brisk and specific. What the app has always said.' },
  { id: 'supportive', label: 'Supportive', blurb: 'The same figures, with the verdict left out.' },
  { id: 'minimal', label: 'Minimal', blurb: 'The count, and nothing around it.' },
];

export function readTone(saved: unknown): Tone {
  return TONES.includes(saved as Tone) ? (saved as Tone) : 'direct';
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/**
 * The Today headline.
 *
 * `total` is what the day held; `left` is what is not ticked.
 */
export function punchline(left: number, total: number, tone: Tone): string {
  if (total === 0) {
    return {
      direct: 'A clear day. Rare.',
      supportive: 'Nothing due today.',
      minimal: 'Nothing due.',
    }[tone];
  }
  if (left === 0) {
    return { direct: 'Day cleared.', supportive: 'That is everything for today.', minimal: 'Done.' }[tone];
  }
  if (tone === 'minimal') return `${left} left`;
  if (tone === 'supportive') {
    return left === 1 ? 'One thing left today.' : `${left} things left today.`;
  }
  if (left === 1) return 'One thing left. Finish it.';
  if (left === 2) return 'Two left. Both before midnight.';
  return `${left} things stand between you and done.`;
}

/**
 * The line about what is overdue.
 *
 * `worst` is already a sentence naming the oldest — "ECON Problem Set 4 is 6
 * days late" — because a name is something you can act on and a count is not.
 * What changes with tone is the frame around it.
 */
export function overdueLine(worst: string, others: number, tone: Tone): string {
  if (!worst) {
    return {
      direct: 'Nothing missed. Keep it that way.',
      supportive: 'Nothing overdue.',
      minimal: 'None overdue.',
    }[tone];
  }
  if (tone === 'minimal') return others === 0 ? `${worst}.` : `${worst}. +${others}.`;
  if (others === 0) return `${worst}.`;
  if (tone === 'supportive') {
    return `${worst}, and ${others} ${plural(others, 'other')} still open.`;
  }
  return `${worst}, and ${others} ${plural(others, 'other')} went by.`;
}

/** How a count of things past their date is described in a sentence. */
export function slipped(n: number, tone: Tone): string {
  if (tone === 'minimal') return `${n} overdue`;
  if (tone === 'supportive') return `${n} ${plural(n, 'thing')} still open`;
  return `${n} ${plural(n, 'thing')} went by`;
}

/** The invitation to deal with what is behind. */
export function catchUp(tone: Tone): string {
  return {
    direct: 'Sort out what still matters',
    supportive: 'Decide what still needs attention',
    minimal: 'What is behind',
  }[tone];
}

/** The onboarding's question about reminders. */
export function askReminders(tone: Tone): string {
  return {
    direct: 'When should I bug you?',
    supportive: 'When would a reminder help?',
    minimal: 'Reminders',
  }[tone];
}
