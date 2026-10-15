import type { FeatureState } from '../intelligence/contracts';
import { isoDay, obj } from './device-library';
import { MIN_COHORT, suppress, type SuppressedCell } from './institution-ops';
import type { Seat } from './launchreadiness';
import type { Screen } from './types';

/**
 * Feedback at the moment it is about, and a log that says what changed because
 * of it.
 *
 * An annual survey asks how a year went. This asks one question, right after
 * the thing it is about, and lets the student say no: after the first plan,
 * after help was routed, after an advising meeting, after a study session,
 * after an AI answer, after accessibility support, after registration, after
 * a course ends.
 *
 * ## The rules it keeps
 *
 * - **A way out, and a cap.** Every prompt can be skipped. A moment is asked
 *   again no sooner than `GAP_DAYS`; no more than one prompt is shown in a day
 *   (`DAILY_CAP`); and a moment skipped `STOP_AFTER_SKIPS` times is never asked
 *   again. (`DO-NOT-BUILD.md` rule 4: an owner, a preference, a frequency cap
 *   and a way out.)
 * - **A choice, not an essay.** An answer is one of the moment's fixed choices.
 *   There is no free-text field on an answer, so nothing typed can reach it —
 *   a student with more to say has `FIXES` in `fixthis.ts`, which already
 *   takes a report.
 * - **An owner.** Every choice that is not "yes, it worked" routes to a seat
 *   and, where there is one, the screen where it is put right.
 * - **Aggregates at the floor.** What an institution reads is counts by
 *   moment and category, with any cell under `MIN_COHORT` withheld and its
 *   complement with it (`suppress` in `institution-ops.ts`). One student's
 *   answer is never shown to anyone as theirs.
 * - **The log says only what is true.** `CHANGES` is the "You said, we changed"
 *   list. An entry names what was said, what changed, when, and the file that
 *   shows it. It starts empty: nothing has been collected yet, so nothing has
 *   changed because of it, and the page says so rather than showing a
 *   flattering example.
 *
 * ## Kept on this device, and said so
 *
 * The answers are stored under a key of their own, outside the synced state,
 * and nothing reads them but the student's own device. There is **no
 * collection path**: no route sends an answer to a school, so `aggregate` is
 * the shape one would take, not something that runs. Building the path needs a
 * consent design and a migration, and until then every screen that shows these
 * says the answers stay here. `VITE_ME_MOMENT_FEEDBACK` gates the prompts and
 * the panel; absent is off.
 *
 * Pure: the date is passed in, and nothing here reads storage or the network.
 */

export const MOMENT_IDS = [
  'first-plan',
  'support-routed',
  'advising',
  'study-session',
  'ai-answer',
  'accessibility-support',
  'registration',
  'course-ended',
] as const;
export type MomentId = (typeof MOMENT_IDS)[number];

export const CATEGORIES = ['worked', 'unclear', 'wrong-place', 'inaccurate', 'not-ready', 'not-usable', 'too-much'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Choice {
  id: string;
  label: string;
  category: Category;
}

export interface Moment {
  id: MomentId;
  /** Said to the student as the reason it is being asked. */
  when: string;
  question: string;
  choices: readonly Choice[];
  /** Who puts right what is not "worked". */
  owner: Seat;
  /** Where it is put right, when there is a screen for it. */
  fix?: Screen;
}

const yes = (label: string): Choice => ({ id: 'yes', label, category: 'worked' });

export const MOMENTS: readonly Moment[] = [
  {
    id: 'first-plan',
    when: 'You just made your first plan.',
    question: 'Did this make your next step clearer?',
    choices: [yes('Yes'), { id: 'some', label: 'A little', category: 'unclear' }, { id: 'no', label: 'No', category: 'unclear' }],
    owner: 'product',
  },
  {
    id: 'support-routed',
    when: 'You were pointed to someone for help.',
    question: 'Did you reach the right place?',
    choices: [yes('Yes'), { id: 'wrong', label: 'No, wrong place', category: 'wrong-place' }, { id: 'unsure', label: 'I could not tell', category: 'unclear' }],
    owner: 'success',
    fix: 'help',
  },
  {
    id: 'advising',
    when: 'You had an advising meeting.',
    question: 'Did your agenda help?',
    choices: [yes('Yes'), { id: 'thin', label: 'Not really', category: 'unclear' }, { id: 'unused', label: 'We did not use it', category: 'not-ready' }],
    owner: 'product',
  },
  {
    id: 'study-session',
    when: 'You finished a study session.',
    question: 'Was this explanation useful?',
    choices: [yes('Yes'), { id: 'unclear', label: 'It was unclear', category: 'unclear' }, { id: 'wrong', label: 'It looked wrong', category: 'inaccurate' }],
    owner: 'product',
  },
  {
    id: 'ai-answer',
    when: 'You read an answer from Ask Semester.',
    question: 'Was the source accurate?',
    choices: [yes('Yes'), { id: 'wrong', label: 'No', category: 'inaccurate' }, { id: 'nosource', label: 'There was no source', category: 'not-ready' }],
    owner: 'trust',
  },
  {
    id: 'accessibility-support',
    when: 'You used a display or input setting.',
    question: 'Did this work with your setup?',
    choices: [yes('Yes'), { id: 'partly', label: 'Partly', category: 'not-usable' }, { id: 'no', label: 'No', category: 'not-usable' }],
    owner: 'accessibility',
    fix: 'settings',
  },
  {
    id: 'registration',
    when: 'Registration has closed for you.',
    question: 'Were you prepared?',
    choices: [yes('Yes'), { id: 'late', label: 'I found out late', category: 'not-ready' }, { id: 'lost', label: 'It was too much', category: 'too-much' }],
    owner: 'success',
  },
  {
    id: 'course-ended',
    when: 'A course has ended.',
    question: 'What should be easier next term?',
    choices: [yes('Nothing, it was fine'), { id: 'find', label: 'Finding things', category: 'unclear' }, { id: 'load', label: 'Keeping up', category: 'too-much' }],
    owner: 'product',
  },
];

export const momentById = (id: MomentId): Moment => MOMENTS.find((m) => m.id === id)!;

/** No sooner than this between asks of the same moment. */
export const GAP_DAYS = 30;
/** No more than this many prompts shown in one day, across every moment. */
export const DAILY_CAP = 1;
/** A moment skipped this many times is never asked again. */
export const STOP_AFTER_SKIPS = 3;

export interface Answer {
  moment: MomentId;
  choice: string;
  category: Category;
  on: string;
}
export interface Skip {
  moment: MomentId;
  on: string;
}
/** A prompt that was put on screen, answered or not: what the limits below count. */
export interface Shown {
  moment: MomentId;
  on: string;
}
export interface FeedbackState {
  answers: readonly Answer[];
  skips: readonly Skip[];
  /** Every prompt shown, so leaving one unanswered still counts as having asked. */
  shown: readonly Shown[];
  /** The student turned every question off. Nothing is asked until they turn it back on. */
  muted: boolean;
}

export const EMPTY: FeedbackState = { answers: [], skips: [], shown: [], muted: false };

const dayNumber = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/**
 * May this moment be put on screen today? Says why not, so a screen and a test
 * can both use the reason. Counts what was shown as well as what was answered
 * or skipped: a prompt the student walked away from was still asked.
 */
export function mayAsk(s: FeedbackState, id: MomentId, today: string): { ok: boolean; why: string } {
  if (s.muted) return { ok: false, why: 'You turned these questions off.' };
  const askedToday = new Set([...s.shown, ...s.answers, ...s.skips].filter((x) => x.on === today).map((x) => x.moment));
  if (askedToday.size >= DAILY_CAP) return { ok: false, why: 'A question has already been shown today.' };
  const skips = s.skips.filter((x) => x.moment === id);
  if (skips.length >= STOP_AFTER_SKIPS) return { ok: false, why: 'You skipped this one three times, so it is not asked again.' };
  const last = [...s.answers.filter((x) => x.moment === id), ...skips, ...s.shown.filter((x) => x.moment === id)].map((x) => x.on).sort().pop();
  if (last && dayNumber(today) - dayNumber(last) < GAP_DAYS) return { ok: false, why: `This was asked within the last ${GAP_DAYS} days.` };
  return { ok: true, why: 'Not asked recently.' };
}

/** Put on screen today and not yet answered or skipped: the one prompt that may still be closed out. */
export function isOpen(s: FeedbackState, id: MomentId, today: string): boolean {
  if (s.muted) return false;
  const on = (x: { moment: MomentId; on: string }) => x.moment === id && x.on === today;
  return s.shown.some(on) && !s.answers.some(on) && !s.skips.some(on);
}

/** Writes down that a prompt was shown. Once a moment a day; a moment that may not be asked is not recorded. */
export function recordShown(s: FeedbackState, id: MomentId, today: string): FeedbackState {
  if (s.shown.some((x) => x.moment === id && x.on === today)) return s;
  if (!mayAsk(s, id, today).ok) return s;
  return { ...s, shown: [...s.shown, { moment: id, on: today }].slice(-KEEP) };
}

export function answer(s: FeedbackState, id: MomentId, choiceId: string, today: string): FeedbackState {
  const c = momentById(id).choices.find((x) => x.id === choiceId);
  if (!c) return s;
  if (!mayAsk(s, id, today).ok && !isOpen(s, id, today)) return s;
  return { ...s, answers: [...s.answers, { moment: id, choice: c.id, category: c.category, on: today }] };
}

export function skip(s: FeedbackState, id: MomentId, today: string): FeedbackState {
  if (!mayAsk(s, id, today).ok && !isOpen(s, id, today)) return s;
  return { ...s, skips: [...s.skips, { moment: id, on: today }] };
}

/** Where a not-"worked" answer goes. */
export function routeFor(a: Answer): { owner: Seat; fix?: Screen } | null {
  if (a.category === 'worked') return null;
  const m = momentById(a.moment);
  return { owner: m.owner, ...(m.fix ? { fix: m.fix } : {}) };
}

/**
 * What an institution may read: counts by moment and category across many
 * students, small cells withheld and their complements with them. Takes the
 * answers only, so it cannot show who gave them.
 */
export function aggregate(all: readonly Pick<Answer, 'moment' | 'category'>[], min = MIN_COHORT): SuppressedCell[] {
  const counts = new Map<string, number>();
  for (const a of all) counts.set(`${a.moment}|${a.category}`, (counts.get(`${a.moment}|${a.category}`) ?? 0) + 1);
  return suppress([...counts].map(([k, n]) => ({ key: k, group: k.split('|')[0], n })), min);
}

export interface Change {
  moment: MomentId;
  /** What people said, in aggregate. Never one person's words. */
  said: string;
  /** What is different now. */
  changed: string;
  on: string;
  /** The file that shows it. */
  evidence: string;
}

/** "You said, we changed". Empty until something has been collected and acted on. */
export const CHANGES: readonly Change[] = [];

export const NOTHING_YET =
  'Nothing has changed yet because of this. Questions have not been asked, so there is nothing to answer. When something changes because of what you said, it is listed here with the date.';

export const logLine = (c: Change): string => `You said: ${c.said} We changed: ${c.changed} (${c.on})`;

export function youSaidWeChanged(changes: readonly Change[] = CHANGES): string[] {
  return changes.length ? [...changes].sort((a, b) => b.on.localeCompare(a.on)).map(logLine) : [NOTHING_YET];
}

// ── On this device ───────────────────────────────────────────────────────────

export const FEEDBACK_KEY = 'semester.moment-feedback.v1';

/** A device keeps this many of each, newest last. More is a diary, not feedback. */
export const KEEP = 200;

const MOMENT_SET: ReadonlySet<string> = new Set(MOMENT_IDS);

/**
 * What may be read back. A choice is checked against its moment and its
 * category is taken from the moment, not from storage, so a stored value can
 * neither invent a choice nor move an answer to a different owner. Anything
 * unknown is dropped; nothing is repaired.
 */
export function readFeedback(raw: unknown): FeedbackState {
  if (!obj(raw)) return EMPTY;
  const answers: Answer[] = [];
  for (const a of Array.isArray(raw.answers) ? raw.answers : []) {
    if (!obj(a) || typeof a.moment !== 'string' || !MOMENT_SET.has(a.moment) || typeof a.choice !== 'string') continue;
    if (typeof a.on !== 'string' || !a.on || !isoDay(a.on)) continue;
    const choice = momentById(a.moment as MomentId).choices.find((c) => c.id === a.choice);
    if (choice) answers.push({ moment: a.moment as MomentId, choice: choice.id, category: choice.category, on: a.on });
  }
  const skips: Skip[] = [];
  for (const k of Array.isArray(raw.skips) ? raw.skips : []) {
    if (!obj(k) || typeof k.moment !== 'string' || !MOMENT_SET.has(k.moment) || typeof k.on !== 'string' || !k.on || !isoDay(k.on)) continue;
    skips.push({ moment: k.moment as MomentId, on: k.on });
  }
  const shown: Shown[] = [];
  for (const k of Array.isArray(raw.shown) ? raw.shown : []) {
    if (!obj(k) || typeof k.moment !== 'string' || !MOMENT_SET.has(k.moment) || typeof k.on !== 'string' || !k.on || !isoDay(k.on)) continue;
    shown.push({ moment: k.moment as MomentId, on: k.on });
  }
  return { answers: answers.slice(-KEEP), skips: skips.slice(-KEEP), shown: shown.slice(-KEEP), muted: raw.muted === true };
}

export const setMuted = (s: FeedbackState, muted: boolean): FeedbackState => ({ ...s, muted });

/** Deleting answers deletes the memory of having asked too, and leaves the on/off choice alone. */
export const clearFeedback = (s: FeedbackState): FeedbackState => ({ answers: [], skips: [], shown: [], muted: s.muted });

/**
 * Where each moment's question is actually asked, or null where it is not
 * yet. Held to the tree by `momentfeedback.test.ts`: a file named here
 * contains the prompt for that moment, and a moment with no file says
 * nothing is asked.
 */
export const WIRED: Record<MomentId, string | null> = {
  'first-plan': null,
  'support-routed': 'app/src/components/GetHelp.tsx',
  advising: null,
  'study-session': null,
  'ai-answer': 'app/src/ai/Chat.tsx',
  'accessibility-support': null,
  registration: null,
  'course-ended': null,
};

// ── The switch ───────────────────────────────────────────────────────────────

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

/** `VITE_ME_MOMENT_FEEDBACK`. Absent is off, and does not follow the institutional preview. */
export function momentFeedbackFlag(env: Record<string, unknown>): FeatureState {
  const value = env.VITE_ME_MOMENT_FEEDBACK;
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

export const MOMENT_FEEDBACK_FLAG: FeatureState = momentFeedbackFlag((import.meta as { env?: Record<string, unknown> }).env ?? {});

export const momentFeedbackOn = (flag: FeatureState = MOMENT_FEEDBACK_FLAG): boolean => flag !== 'off';
