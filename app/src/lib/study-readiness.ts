import { obj } from './device-library';
import { cardIdentity, type Reviews } from './review';
import { isExam } from './runway';
import type { Sitting } from './sitting';
import type { SourceLabel } from './source';
import type { CourseUpdate, DatedItem, Unit } from './types';

/**
 * Study Readiness (Phase H, `study_readiness`): for one upcoming assessment,
 * where each topic stands in the student's own words, what practice so far
 * shows, and one short session to do next.
 *
 * - **The student sets the state** of each topic — Reviewed, Practicing or
 *   Needs review — and how confident they feel. Semester does not set either.
 * - **Practice signals** are counts the app already has: cards seen, right and
 *   wrong, due now; and practice papers taken for the course. Shown as counts,
 *   never turned into a score.
 * - **One recommended session**, 25 minutes, on the topic that most asks for
 *   it, with the reason in words.
 * - **Materials** for a topic are the course's own: the prepared guide from
 *   the syllabus and material added to that unit, each labelled.
 *
 * No grade prediction, no chance of passing, no comparison with anyone else.
 */

export const READINESS_KEY = 'semester.study-readiness.v1';
export const STATUSES = ['reviewed', 'practicing', 'needs_review'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { reviewed: 'Reviewed', practicing: 'Practicing', needs_review: 'Needs review' };
export const CONFIDENCE_LABEL = ['Not yet', 'A little', 'Somewhat', 'Mostly', 'Very'] as const;

export interface TopicMark {
  status: Status | null;
  /** 1–5, or null when not rated. */
  confidence: number | null;
}

export interface ReadinessLibrary {
  version: 1;
  /** Keyed by assessment (deadline) id, then by unit index. */
  byItem: Record<string, { topics: Record<string, TopicMark>; updated: number }>;
}

export const EMPTY_READINESS: ReadinessLibrary = { version: 1, byItem: {} };
const MAX_ITEMS = 60;
const bad = () => new Error('Saved study readiness is not valid.');

export function readReadiness(value: unknown): ReadinessLibrary {
  if (!obj(value) || value.version !== 1 || !obj(value.byItem)) throw bad();
  const entries = Object.entries(value.byItem);
  if (entries.length > MAX_ITEMS) throw bad();
  const byItem: ReadinessLibrary['byItem'] = {};
  for (const [id, entry] of entries) {
    if (!id || id.length > 200 || !obj(entry) || !obj(entry.topics) || typeof entry.updated !== 'number') throw bad();
    const topics: Record<string, TopicMark> = {};
    for (const [unit, mark] of Object.entries(entry.topics)) {
      if (!/^\d{1,3}$/.test(unit) || !obj(mark)) throw bad();
      const status = mark.status;
      const confidence = mark.confidence;
      if (status !== null && !(STATUSES as readonly unknown[]).includes(status)) throw bad();
      if (confidence !== null && !(Number.isInteger(confidence) && (confidence as number) >= 1 && (confidence as number) <= 5)) throw bad();
      topics[unit] = { status: status as Status | null, confidence: confidence as number | null };
    }
    byItem[id] = { topics, updated: entry.updated };
  }
  return { version: 1, byItem };
}

export function markTopic(lib: ReadinessLibrary, itemId: string, unit: number, patch: Partial<TopicMark>, now: number): ReadinessLibrary {
  const entry = lib.byItem[itemId] ?? { topics: {}, updated: now };
  const was = entry.topics[String(unit)] ?? { status: null, confidence: null };
  const byItem = { ...lib.byItem, [itemId]: { topics: { ...entry.topics, [String(unit)]: { ...was, ...patch } }, updated: now } };
  // Keep the most recently touched assessments within the cap.
  const kept = Object.entries(byItem).sort((a, b) => b[1].updated - a[1].updated).slice(0, MAX_ITEMS);
  return { version: 1, byItem: Object.fromEntries(kept) };
}

/** Assessments still ahead for this course: exams, and anything weighted like one. */
export function assessmentsAhead(items: DatedItem[], courseId: string, done: Record<string, boolean>): DatedItem[] {
  return items.filter((i) => i.c === courseId && !i.isPast && !done[i.id] && isExam(i));
}

export interface Signals {
  cards: number;
  seen: number;
  right: number;
  wrong: number;
  due: number;
}

/** What card practice on one topic shows, as counts. */
export function topicSignals(courseId: string, unit: Unit, reviews: Reviews, now: number): Signals {
  const out: Signals = { cards: unit.cards.length, seen: 0, right: 0, wrong: 0, due: 0 };
  for (const card of unit.cards) {
    const r = reviews[cardIdentity(courseId, card)];
    if (!r || r.seen === 0) {
      out.due += 1;
      continue;
    }
    out.seen += 1;
    out.right += r.right;
    out.wrong += r.wrong;
    if (r.due <= now) out.due += 1;
  }
  return out;
}

export function signalLine(s: Signals): string {
  if (!s.cards) return 'No practice cards for this topic yet.';
  if (!s.seen) return `${s.cards} cards, none practiced yet.`;
  return `${s.seen} of ${s.cards} cards practiced · ${s.right} right, ${s.wrong} missed · ${s.due} due now.`;
}

/** Practice papers for the course, newest first — shown as they were, with no projection from them. */
export function papersFor(sittings: Sitting[], courseId: string): Sitting[] {
  return sittings.filter((s) => s.courseId === courseId).sort((a, b) => b.at - a.at);
}

export interface Recommendation {
  unit: number;
  minutes: number;
  steps: string[];
  why: string;
}

const STATUS_ORDER: Record<string, number> = { needs_review: 0, null: 1, practicing: 2, reviewed: 3 };

/**
 * One short session: the topic the student marked as needing review first,
 * then unmarked, then practicing; among those, the lowest confidence, then
 * the most cards due. Null when every topic is marked Reviewed and nothing
 * is due.
 */
export function recommend(units: Unit[], marks: Record<string, TopicMark>, signals: Signals[]): Recommendation | null {
  const order = units
    .map((u, i) => ({ u, i, mark: marks[String(i)] ?? { status: null, confidence: null }, s: signals[i] }))
    .filter((t) => t.u.cards.length > 0 || t.mark.status !== 'reviewed');
  if (!order.length) return null;
  order.sort(
    (a, b) =>
      STATUS_ORDER[String(a.mark.status)] - STATUS_ORDER[String(b.mark.status)] ||
      (a.mark.confidence ?? 0) - (b.mark.confidence ?? 0) ||
      b.s.due - a.s.due ||
      a.i - b.i,
  );
  const top = order[0];
  if (top.mark.status === 'reviewed' && top.s.due === 0) return null;
  const due = Math.min(top.s.due, 20);
  const steps = [
    ...(due ? [`Practice the ${due} ${due === 1 ? 'card' : 'cards'} due in ${top.u.name} (about ${Math.max(5, Math.round(due * 0.75))} minutes).`] : []),
    `Reread the course material for ${top.u.name} and write down one thing you would still get wrong.`,
    'Stop at 25 minutes, then mark the topic again.',
  ];
  const why =
    top.mark.status === 'needs_review'
      ? `You marked ${top.u.name} as needing review.`
      : top.mark.status === null
        ? `${top.u.name} is not marked yet${top.s.due ? `, and ${top.s.due} of its cards are due` : ''}.`
        : `${top.u.name} is still in practice${top.mark.confidence ? ` and you rated your confidence ${CONFIDENCE_LABEL[top.mark.confidence - 1].toLowerCase()}` : ''}.`;
  return { unit: top.i, minutes: 25, steps, why };
}

export interface TopicMaterial {
  title: string;
  detail: string;
  label: SourceLabel;
}

/** The course's own materials for one topic, labelled: the prepared guide, and anything added to that unit. */
export function materialsFor(unitIndex: number, unit: Unit, updates: CourseUpdate[], courseId: string, addedUnit: boolean): TopicMaterial[] {
  const out: TopicMaterial[] = [];
  if (!addedUnit) out.push({ title: unit.name, detail: 'Prepared course guide, from your syllabus', label: 'imported' });
  for (const u of updates.filter((x) => x.courseId === courseId && x.unit === unitIndex)) {
    out.push({
      title: u.title,
      detail: u.source ? `Added material · ${u.source}` : 'Added material',
      label: u.fileIds.length ? 'imported' : 'student_entered',
    });
  }
  return out;
}
