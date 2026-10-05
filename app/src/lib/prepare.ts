import type { Available, Destination } from './expertpack';

/**
 * "Prepare me for …": what the student already holds, gathered for one
 * upcoming thing.
 *
 * It is a gatherer, not an author. Every line is something the student wrote,
 * marked or was told by the course; a slot with nothing behind it is reported
 * as missing rather than filled in. That is the difference between this and a
 * chatbot asked "help me prepare": nothing here can be wrong about the
 * student's own work, and nothing is added that they did not put there.
 *
 * ## Sharing is a separate, later, choice
 *
 * Preparing is private. `handoffFields` turns a preparation into the values
 * `expertpack.ts` offers for the matching human service, and the pack's own
 * allowlist and per-field tick decide what leaves. Nothing here sends.
 *
 * ## The course's AI policy is quoted, never summarised
 *
 * If the course states one it is reproduced with its source; if it does not,
 * no policy line appears, because "no rule stated" is not "allowed".
 */

export type PrepKind =
  | 'class'
  | 'exam'
  | 'assignment'
  | 'office-hours'
  | 'advising'
  | 'interview'
  | 'career-fair'
  | 'registration'
  | 'study-abroad'
  | 'scholarship'
  | 'research';

export interface PrepContext {
  /** What the student wants out of it, in their words. */
  goal?: string;
  /** Notes and slides they hold that bear on it. */
  materials?: readonly string[];
  /** Things they marked "I do not understand". */
  confusing?: readonly string[];
  /** Their own attempts or worked examples. */
  attempts?: readonly string[];
  /** Questions they have already written. */
  questions?: readonly string[];
  /** The course's stated AI policy, verbatim, with where it says so. */
  aiPolicy?: { text: string; source: string };
  /** The dated thing this is for. */
  when?: { title: string; daysAway: number };
}

type Slot = 'goal' | 'materials' | 'confusing' | 'attempts' | 'questions';

const SLOTS: Readonly<Record<Slot, string>> = {
  goal: 'Your goal',
  materials: 'Your notes and materials',
  confusing: 'What you marked as not understood',
  attempts: 'Your attempts',
  questions: 'Your questions',
};

/** What is worth having in hand for each kind, in reading order. */
const WANTS: Readonly<Record<PrepKind, readonly Slot[]>> = {
  class: ['goal', 'materials', 'confusing', 'questions'],
  exam: ['materials', 'confusing', 'attempts', 'questions'],
  assignment: ['goal', 'materials', 'attempts', 'questions'],
  'office-hours': ['goal', 'confusing', 'attempts', 'questions'],
  advising: ['goal', 'materials', 'questions'],
  interview: ['goal', 'materials', 'attempts', 'questions'],
  'career-fair': ['goal', 'materials', 'questions'],
  registration: ['goal', 'materials', 'questions'],
  'study-abroad': ['goal', 'materials', 'questions'],
  scholarship: ['goal', 'materials', 'attempts', 'questions'],
  research: ['goal', 'materials', 'confusing', 'questions'],
};

export interface PrepSection {
  slot: Slot;
  label: string;
  lines: string[];
}

export interface Preparation {
  kind: PrepKind;
  when: PrepContext['when'] | null;
  sections: PrepSection[];
  /** Slots the student has nothing in, said plainly. */
  missing: string[];
  /** The course's own words, or null when it states none. */
  aiPolicy: { text: string; source: string } | null;
}

const list = (v: string | readonly string[] | undefined): string[] =>
  (typeof v === 'string' ? [v] : [...(v ?? [])]).map((x) => x.trim()).filter(Boolean);

export function prepare(kind: PrepKind, ctx: PrepContext): Preparation {
  const sections: PrepSection[] = [];
  const missing: string[] = [];
  for (const slot of WANTS[kind]) {
    const lines = list(ctx[slot]);
    if (lines.length) sections.push({ slot, label: SLOTS[slot], lines });
    else missing.push(`Nothing yet under "${SLOTS[slot].toLowerCase()}".`);
  }
  const p = ctx.aiPolicy;
  return {
    kind,
    when: ctx.when ?? null,
    sections,
    missing,
    aiPolicy: p && p.text.trim() && p.source.trim() ? { text: p.text.trim(), source: p.source.trim() } : null,
  };
}

const FOR: Partial<Record<PrepKind, { destination: Destination; map: Partial<Record<Slot, string>> }>> = {
  'office-hours': { destination: 'office-hours', map: { goal: 'topic', attempts: 'attempted', materials: 'references' } },
  advising: { destination: 'advisor', map: { questions: 'questions', materials: 'plan' } },
  interview: { destination: 'career', map: { goal: 'role', questions: 'questions' } },
  'career-fair': { destination: 'career', map: { goal: 'role', questions: 'questions' } },
  scholarship: { destination: 'money', map: { questions: 'questions' } },
  'study-abroad': { destination: 'international', map: { questions: 'questions' } },
};

/**
 * The values a matching handoff pack may offer, or null when this kind has no
 * human service to hand to. Offered, not sent: the pack asks the student to
 * tick each field, and its allowlist drops anything the destination may not
 * receive.
 */
export function handoffFields(p: Preparation): { destination: Destination; available: Available } | null {
  const rule = FOR[p.kind];
  if (!rule) return null;
  const available: Record<string, string> = {};
  for (const s of p.sections) {
    const field = rule.map[s.slot];
    if (field) available[field] = s.lines.join('\n');
  }
  return { destination: rule.destination, available };
}
