import { obj, textValue } from './device-library';
import { isoToDate, shiftIso } from './date';
import { formatDate } from './locale';
import type { DestinationKind } from './help-routes';

/**
 * The Weekly Reset: five short steps a student may walk through on a Sunday
 * evening, and may walk away from at any point.
 *
 * 1. Review what changed.
 * 2. Choose one academic, one practical and one personal-support priority.
 * 3. Plan the week: study blocks placed around the commitments already fixed.
 * 4. Anticipate conflicts: a day that holds several deadlines, said plainly.
 * 5. Ask for help: tutoring, office hours or a study session, if wanted.
 *
 * ## Optional, and never counted
 *
 * The record holds a week, a step, the picks and whether it was skipped. There
 * is no count of resets finished, no run of consecutive weeks, no date it was
 * "last done" that a screen could turn into a gap. `lib/weekly.ts` says the
 * same about the week's report: a figure that scores attendance at a ritual
 * teaches people to hide from it, and a Reset that scolded a skipped Sunday
 * would be the last one opened. `skip` therefore always works, from any step,
 * changes nothing but the one flag, and leaves the picks exactly as they were.
 *
 * ## Proposals, not placements
 *
 * `placeStudyBlocks` returns places a block could go. It writes nothing to the
 * calendar; the student confirms or moves each one, as everywhere else.
 *
 * ## Reflection is private by construction
 *
 * The five reflection prompts live in the same device library, and each record
 * carries `private: true`. Nothing here sends a reflection anywhere:
 * `shareable` is the single road out, it returns nothing unless the student
 * set `shared` themselves, and what it returns is a copy of the answers, not
 * the record. `withoutReflections` empties them for a backup, the way
 * `advisor-meeting.ts` empties private notes.
 */

export const RESET_KEY = 'semester.weekly-reset.v1';

/** One account's resets on this device, or the signed-out device's. */
export const resetKey = (accountId: string | null | undefined): string => `${RESET_KEY}:${accountId || 'device'}`;

export const LIMITS = { resets: 60, reflections: 120, text: 500, label: 120 } as const;

export const STEPS = ['review', 'priorities', 'plan', 'conflicts', 'help'] as const;
export type Step = (typeof STEPS)[number];

export const STEP_TEXT: Record<Step, { title: string; prompt: string }> = {
  review: { title: 'What changed', prompt: 'Here is what moved since last week. Nothing here needs a decision yet.' },
  priorities: { title: 'Your priorities', prompt: 'Pick one academic, one practical and one personal-support priority. Leave any of them blank.' },
  plan: { title: 'Plan your week', prompt: 'Here are places your study blocks could go around what is already fixed. Move or drop any of them.' },
  conflicts: { title: 'Busy days', prompt: 'These days hold more than the others. You decide whether to change anything.' },
  help: { title: 'Ask for help', prompt: 'If anything this week would go better with someone else, here are ways to ask. Skipping this is fine.' },
};

export interface Picks {
  academic: string;
  practical: string;
  support: string;
}

export const EMPTY_PICKS: Picks = { academic: '', practical: '', support: '' };

export const HELP_OPTIONS = ['tutoring', 'office_hours', 'study_session'] as const;
export type HelpOption = (typeof HELP_OPTIONS)[number];

export const HELP_TEXT: Record<HelpOption, { label: string; kind: DestinationKind | null; note: string }> = {
  tutoring: { label: 'Book a tutoring session', kind: 'tutoring', note: 'Tutors can work through the material with you.' },
  office_hours: { label: 'Go to office hours', kind: 'instructor', note: 'Bring one specific question.' },
  study_session: { label: 'Set up a study session', kind: null, note: 'Ask a classmate or a study group to meet once this week.' },
};

export interface ResetRecord {
  /** YYYY-MM-DD of the Sunday the week starts on (`weekStart` in lib/weekly.ts). */
  weekStart: string;
  /**
   * Index into `STEPS` of the step the student is on; `STEPS.length` means they
   * reached the end. Skipping does not move it.
   */
  step: number;
  picks: Picks;
  /** The student chose to leave it. Carries no penalty and is reversible. */
  skipped: boolean;
  help: HelpOption | null;
}

export type ReflectionKind = 'week' | 'term';

export const PROMPT_IDS = ['finished', 'harder', 'change', 'evidence', 'carry'] as const;
export type PromptId = (typeof PROMPT_IDS)[number];

export const PROMPT_TEXT: Record<PromptId, string> = {
  finished: 'What did you finish?',
  harder: 'What was harder than you expected?',
  change: 'What do you want to change next week?',
  evidence: 'What evidence is worth keeping?',
  carry: 'What do you want to carry into next term?',
};

export interface Reflection {
  /** The week it was written for; for a term reflection, the week it was written in. */
  weekStart: string;
  kind: ReflectionKind;
  answers: Record<PromptId, string>;
  /** Always true. There is no code path that sets it otherwise. */
  private: true;
  /** Set only by the student, per reflection. Off by default. */
  shared: boolean;
}

export interface ResetLibrary {
  version: 1;
  resets: ResetRecord[];
  reflections: Reflection[];
}

export const EMPTY_RESETS: ResetLibrary = { version: 1, resets: [], reflections: [] };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const bad = () => new Error('Saved weekly resets are not valid.');
const emptyAnswers = (): Record<PromptId, string> => ({ finished: '', harder: '', change: '', evidence: '', carry: '' });

export function readResets(value: unknown): ResetLibrary {
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.resets) || !Array.isArray(value.reflections)) throw bad();
  if (value.resets.length > LIMITS.resets || value.reflections.length > LIMITS.reflections) throw bad();
  const resets = value.resets.map((r): ResetRecord => {
    if (!obj(r) || !textValue(r.weekStart, 10) || !ISO_DAY.test(r.weekStart)) throw bad();
    if (!Number.isInteger(r.step) || (r.step as number) < 0 || (r.step as number) > STEPS.length) throw bad();
    if (typeof r.skipped !== 'boolean' || !obj(r.picks)) throw bad();
    const p = r.picks;
    if (![p.academic, p.practical, p.support].every((t) => textValue(t, LIMITS.text))) throw bad();
    if (r.help !== null && !HELP_OPTIONS.includes(r.help as HelpOption)) throw bad();
    return {
      weekStart: r.weekStart,
      step: r.step as number,
      picks: { academic: p.academic as string, practical: p.practical as string, support: p.support as string },
      skipped: r.skipped,
      help: r.help as HelpOption | null,
    };
  });
  const reflections = value.reflections.map((r): Reflection => {
    if (!obj(r) || !textValue(r.weekStart, 10) || !ISO_DAY.test(r.weekStart)) throw bad();
    if (r.kind !== 'week' && r.kind !== 'term') throw bad();
    // A stored `private: false` is refused, not repaired: the field is a promise.
    if (r.private !== true || typeof r.shared !== 'boolean' || !obj(r.answers)) throw bad();
    const answers = emptyAnswers();
    for (const id of PROMPT_IDS) {
      const a = (r.answers as Record<string, unknown>)[id];
      if (!textValue(a, LIMITS.text)) throw bad();
      answers[id] = a;
    }
    return { weekStart: r.weekStart, kind: r.kind, answers, private: true, shared: r.shared };
  });
  if (new Set(resets.map((r) => r.weekStart)).size !== resets.length) throw bad();
  return { version: 1, resets, reflections };
}

/* ---- The steps ---- */

export const startReset = (weekStart: string): ResetRecord => ({
  weekStart,
  step: 0,
  picks: { ...EMPTY_PICKS },
  skipped: false,
  help: null,
});

/** The step the student is on, or null once they have reached the end. */
export const currentStep = (r: ResetRecord): Step | null => STEPS[r.step] ?? null;

/** One step forward. At the end it stays at the end. */
export const advance = (r: ResetRecord): ResetRecord => ({ ...r, step: Math.min(r.step + 1, STEPS.length) });

/** One step back, so a step can be looked at again. */
export const back = (r: ResetRecord): ResetRecord => ({ ...r, step: Math.max(r.step - 1, 0) });

/**
 * Leave the Reset. Allowed from any step, including the last and including
 * after it was finished; changes only `skipped`, so nothing already chosen is
 * lost and nothing is recorded about how often.
 */
export const skip = (r: ResetRecord): ResetRecord => ({ ...r, skipped: true });

/** Pick it up again where it was left. */
export const resume = (r: ResetRecord): ResetRecord => ({ ...r, skipped: false });

const clip = (t: string) => t.trim().slice(0, LIMITS.text);

export const choosePicks = (r: ResetRecord, picks: Partial<Picks>): ResetRecord => ({
  ...r,
  picks: {
    academic: clip(picks.academic ?? r.picks.academic),
    practical: clip(picks.practical ?? r.picks.practical),
    support: clip(picks.support ?? r.picks.support),
  },
});

export const chooseHelp = (r: ResetRecord, help: HelpOption | null): ResetRecord => ({ ...r, help });

/**
 * What the student chose, in sentences. Blank picks are left out rather than
 * flagged as missing, and a skipped Reset reads as a plain statement.
 */
export function summary(r: ResetRecord): string[] {
  const lines: string[] = [];
  if (r.picks.academic) lines.push(`Academic: ${r.picks.academic}`);
  if (r.picks.practical) lines.push(`Practical: ${r.picks.practical}`);
  if (r.picks.support) lines.push(`Personal support: ${r.picks.support}`);
  if (r.help) lines.push(`Help to ask for: ${HELP_TEXT[r.help].label}`);
  if (lines.length === 0) lines.push(r.skipped ? 'You set this one aside. Nothing is waiting on it.' : 'No priorities chosen yet.');
  else if (r.skipped) lines.push('You set the rest aside. Nothing is waiting on it.');
  return lines;
}

/* ---- Step 3: study blocks around what is fixed ---- */

export interface Commitment {
  /** YYYY-MM-DD */
  day: string;
  /** Minutes after midnight. */
  startMin: number;
  endMin: number;
  label: string;
}

export interface BlockProposal {
  day: string;
  startMin: number;
  minutes: number;
  label: string;
}

export interface PlaceOptions {
  /** How many blocks to propose. */
  blocks: number;
  /** Minutes in each block. */
  minutes: number;
  /** The part of each day study may go in, minutes after midnight. */
  window?: { from: number; to: number };
  /** A gap kept clear after every commitment and every block. */
  breakMin?: number;
}

/**
 * Proposed places for study blocks across the seven days from `weekStart`,
 * in the free gaps between the commitments given.
 *
 * Blocks are spread one to a day before any day gets a second, so a week of
 * three blocks is three different days and not one long evening. Days with no
 * gap big enough are skipped. It returns fewer blocks than asked for when the
 * week has no room, and says nothing about that: a short list is the answer.
 */
export function placeStudyBlocks(weekStart: string, fixed: readonly Commitment[], opts: PlaceOptions): BlockProposal[] {
  const win = opts.window ?? { from: 9 * 60, to: 21 * 60 };
  const gap = opts.breakMin ?? 15;
  const out: BlockProposal[] = [];
  const busy = new Map<string, [number, number][]>();
  for (const c of fixed) busy.set(c.day, [...(busy.get(c.day) ?? []), [c.startMin, c.endMin]]);
  const days = Array.from({ length: 7 }, (_, i) => shiftIso(weekStart, i));

  const freeSlot = (day: string): number | null => {
    const taken = (busy.get(day) ?? []).slice().sort((a, b) => a[0] - b[0]);
    let at = win.from;
    for (const [s, e] of taken) {
      if (s - gap - at >= opts.minutes) return at;
      at = Math.max(at, e + gap);
    }
    return win.to - at >= opts.minutes ? at : null;
  };

  while (out.length < opts.blocks) {
    let placed = false;
    // The day with fewest blocks first; ties go to the earlier day.
    const byLoad = days
      .map((d, i) => ({ d, i, n: out.filter((b) => b.day === d).length }))
      .sort((a, b) => a.n - b.n || a.i - b.i);
    for (const { d } of byLoad) {
      const at = freeSlot(d);
      if (at === null) continue;
      out.push({ day: d, startMin: at, minutes: opts.minutes, label: 'Study block' });
      busy.set(d, [...(busy.get(d) ?? []), [at, at + opts.minutes]]);
      placed = true;
      break;
    }
    if (!placed) break;
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin);
}

/* ---- Step 4: a busy day, said plainly ---- */

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => NUMBER_WORDS[n] ?? String(n);

export interface DayDeadline {
  /** YYYY-MM-DD */
  day: string;
  title: string;
}

export interface BusyDay {
  day: string;
  titles: string[];
  /** How many tasks could start earlier to ease the day: all but the first. */
  startEarly: number;
  line: string;
}

/**
 * Days holding `threshold` or more deadlines, as a question. The question is
 * the whole of it: the Reset names the day and offers to move work earlier, and
 * does not add up how busy the week is.
 */
export function busyDays(deadlines: readonly DayDeadline[], threshold = 3): BusyDay[] {
  const byDay = new Map<string, string[]>();
  for (const d of deadlines) byDay.set(d.day, [...(byDay.get(d.day) ?? []), d.title]);
  return [...byDay.entries()]
    .filter(([, titles]) => titles.length >= threshold)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, titles]) => {
      const startEarly = titles.length - 1;
      const name = formatDate(isoToDate(day), { weekday: 'long' });
      return {
        day,
        titles,
        startEarly,
        line: `${name} has ${word(titles.length)} deadlines. Start ${word(startEarly)} ${startEarly === 1 ? 'action' : 'actions'} earlier?`,
      };
    });
}

/* ---- Unfinished work ---- */

export interface Unfinished {
  id: string;
  title: string;
}

export interface Carried {
  /** YYYY-MM-DD of the week the work moves to. */
  weekStart: string;
  items: Unfinished[];
  line: string;
}

/**
 * Work not finished this week, moved to the next one as it was: same ids, same
 * titles, nothing re-labelled and nothing counted. The line is a statement of
 * where it went. It does not say how much, and it asks for nothing.
 */
export function rollForward(unfinished: readonly Unfinished[], weekStart: string): Carried {
  const items = unfinished.map((u) => ({ ...u }));
  return {
    weekStart: shiftIso(weekStart, 7),
    items,
    line: items.length === 0 ? 'Nothing to carry over.' : 'These are on next week’s list now. You can change them there.',
  };
}

/* ---- Reflection: private unless the student says otherwise ---- */

export const startReflection = (weekStart: string, kind: ReflectionKind = 'week'): Reflection => ({
  weekStart,
  kind,
  answers: emptyAnswers(),
  private: true,
  shared: false,
});

export const answerPrompt = (r: Reflection, id: PromptId, text: string): Reflection => ({
  ...r,
  answers: { ...r.answers, [id]: text.trim().slice(0, LIMITS.text) },
});

/** The student's own decision, for this one reflection. Setting it false takes it back. */
export const setShared = (r: Reflection, shared: boolean): Reflection => ({ ...r, shared });

export interface SharedReflection {
  weekStart: string;
  kind: ReflectionKind;
  answers: Record<PromptId, string>;
}

/**
 * The only way a reflection can leave this module, and only if the student
 * ticked share on it. A copy of the answers, shown to them before anything is
 * sent (D-016); a later edit does not change what was shared.
 */
export function shareable(r: Reflection): SharedReflection | null {
  if (r.shared !== true) return null;
  return { weekStart: r.weekStart, kind: r.kind, answers: { ...r.answers } };
}

/**
 * A restored library, keeping the reflections this device already has.
 *
 * A backup never carries answers (`withoutReflections`), so restoring one must
 * neither erase the answers on this device nor invent empty ones: the picks
 * come from the file and the reflections stay exactly as the device holds
 * them, or none on a device that has none.
 */
export function keepReflections(incoming: ResetLibrary, existing: unknown): ResetLibrary {
  let before: ResetLibrary;
  try {
    before = readResets(existing);
  } catch {
    return { ...incoming, reflections: [] };
  }
  return { version: 1, resets: incoming.resets, reflections: before.reflections };
}

/** The library as it may leave the device in a backup: every reflection answer emptied. */
export function withoutReflections(library: ResetLibrary): ResetLibrary {
  return {
    ...library,
    reflections: library.reflections.map((r) => ({ ...r, answers: emptyAnswers(), shared: false })),
  };
}
