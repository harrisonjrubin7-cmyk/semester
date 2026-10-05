/**
 * The assessment builder's rules: an item bank whose items are validated,
 * reviewed and versioned, and a test assembled from it that can be reproduced.
 *
 * `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` lists what the tree lacks for
 * instructor authoring: "no question bank, item versioning, tags, pools", no
 * per-item provenance for an AI-drawn question. This file is that, as pure
 * functions over rows the caller passes in. It reads no database, holds no
 * student, and is wired to no screen; `lib/quiz.ts` and `lib/exam.ts`, which
 * draw questions for one student's practice, are untouched.
 *
 * Rules kept on purpose:
 *
 *   - **A draft is never delivered.** Only an approved, unexpired item, at its
 *     newest approved version, can be drawn. An edit is a new version and goes
 *     back to draft with its review cleared, so a reviewer's signature never
 *     covers words they did not read.
 *   - **The author does not approve.** Approval needs a reviewer who is not the
 *     author, an accessibility review, an outcome the item is evidence for and a
 *     date it must be looked at again.
 *   - **AI-drafted means named.** An item an AI drafted carries the model, the
 *     prompt version and the human editor, or it cannot be approved.
 *   - **A written answer is never scored by a rule.** Short answer and essay
 *     come back as `needs_marking`, never as a number, the same rule the
 *     practice paper keeps.
 *   - **A test is reproducible.** The same bank, blueprint, seed and date give
 *     the same test, whatever order the bank was passed in, so a re-sat or
 *     disputed paper can be rebuilt. It never draws one item twice, and it
 *     refuses a blueprint the bank cannot fill instead of quietly shortening it.
 *   - **A bad response is not a wrong one.** A response that cannot be read as
 *     an answer to the question is reported as invalid, never scored zero.
 *
 * Multiple response is all-or-nothing: partial credit is a policy an institution
 * chooses, and none has been chosen here.
 */
import type { Result } from './rubricengine';

const fail = (why: string): { ok: false; why: string } => ({ ok: false, why });

// ── Items ─────────────────────────────────────────────────────────────────

export type ItemKind = 'multiple_choice' | 'multiple_response' | 'true_false' | 'ordering' | 'numeric' | 'short_answer' | 'essay';
export type ItemStatus = 'draft' | 'approved' | 'retired';

interface ItemBase {
  id: string;
  /** From 1; every edit is a new version. */
  version: number;
  stem: string;
  points: number;
  /** Learning outcomes the item is evidence for. */
  outcomeIds: readonly string[];
  tags: readonly string[];
  status: ItemStatus;
  author: string;
  reviewer?: string;
  approvedAt?: string;
  /** The date the item must be reviewed again; after it, the item is not drawn. */
  reviewAfter?: string;
  accessibilityReviewed: boolean;
  aiDrafted?: { model: string; promptVersion: string; editor: string };
}

export type Item = ItemBase &
  (
    | { kind: 'multiple_choice'; options: readonly string[]; answer: number }
    | { kind: 'multiple_response'; options: readonly string[]; answers: readonly number[] }
    | { kind: 'true_false'; answer: boolean }
    /** `steps` are given in their correct order. */
    | { kind: 'ordering'; steps: readonly string[] }
    | { kind: 'numeric'; answer: number; tolerance: number; unit?: string }
    | { kind: 'short_answer' | 'essay'; modelAnswer: string }
  );

const distinct = (xs: readonly string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size === xs.length;
const blank = (s: string | undefined) => !s || !s.trim();
const inRange = (i: number, n: number) => Number.isInteger(i) && i >= 0 && i < n;

function structure(i: Item): string | null {
  if (blank(i.id)) return 'An item needs an id.';
  if (!Number.isInteger(i.version) || i.version < 1) return 'An item version is a whole number from 1.';
  if (blank(i.stem)) return 'An item needs a question.';
  if (!(i.points > 0) || !Number.isFinite(i.points)) return 'An item is worth more than zero points.';
  if (blank(i.author)) return 'An item needs an author.';
  switch (i.kind) {
    case 'multiple_choice':
      if (i.options.length < 3) return 'Multiple choice needs at least three options.';
      if (i.options.some(blank) || !distinct(i.options)) return 'Options must be filled in and different from each other.';
      if (!inRange(i.answer, i.options.length)) return 'The answer must be one of the options.';
      return null;
    case 'multiple_response':
      if (i.options.length < 3) return 'Multiple response needs at least three options.';
      if (i.options.some(blank) || !distinct(i.options)) return 'Options must be filled in and different from each other.';
      if (i.answers.length < 1 || i.answers.length >= i.options.length) return 'Some, but not all, options must be correct.';
      if (i.answers.some((a) => !inRange(a, i.options.length)) || new Set(i.answers).size !== i.answers.length) return 'The correct options must be distinct options.';
      return null;
    case 'true_false':
      return null;
    case 'ordering':
      if (i.steps.length < 3) return 'An ordering needs at least three steps.';
      if (i.steps.some(blank) || !distinct(i.steps)) return 'Steps must be filled in and different from each other.';
      return null;
    case 'numeric':
      if (!Number.isFinite(i.answer)) return 'A numeric answer must be a number.';
      if (!Number.isFinite(i.tolerance) || i.tolerance < 0) return 'A tolerance is zero or more.';
      return null;
    case 'short_answer':
    case 'essay':
      return blank(i.modelAnswer) ? 'A written question needs a model answer to mark against.' : null;
  }
}

/** Whether an item is well formed, and, if it claims to be approved, properly approved. */
export function validateItem(i: Item): Result<Item> {
  const bad = structure(i);
  if (bad) return fail(bad);
  if (i.status !== 'approved') return { ok: true, value: i };
  if (blank(i.reviewer)) return fail('An approved item needs a reviewer.');
  if (i.reviewer!.trim().toLowerCase() === i.author.trim().toLowerCase()) return fail('The author cannot approve their own item.');
  if (!i.accessibilityReviewed) return fail('An approved item needs an accessibility review.');
  if (i.outcomeIds.length === 0) return fail('An approved item needs a learning outcome.');
  const at = Date.parse(i.approvedAt ?? '');
  const until = Date.parse(i.reviewAfter ?? '');
  if (!Number.isFinite(at)) return fail('An approved item needs the time it was approved.');
  if (!Number.isFinite(until) || until <= at) return fail('An approved item needs a review date after its approval.');
  if (i.aiDrafted && (blank(i.aiDrafted.model) || blank(i.aiDrafted.promptVersion) || blank(i.aiDrafted.editor))) {
    return fail('An AI-drafted item needs its model, prompt version and human editor.');
  }
  return { ok: true, value: i };
}

/**
 * The next version of an item: the edit, at the next version number, back in
 * draft with its review cleared.
 */
export function reviseItem(prev: Item, edited: Item): Result<Item> {
  if (edited.id !== prev.id) return fail('A revision keeps the item id.');
  const { reviewer: _r, approvedAt: _a, reviewAfter: _u, ...rest } = edited;
  void [_r, _a, _u];
  const next = { ...rest, version: prev.version + 1, status: 'draft' as const, accessibilityReviewed: false } as Item;
  return validateItem(next);
}

// ── Assembling a test ─────────────────────────────────────────────────────

export interface Pool {
  outcomeId?: string;
  tag?: string;
  kind?: ItemKind;
}
export interface Slot {
  pool: Pool;
  count: number;
}

/** What a student is shown. It carries no answer. */
export interface BuiltQuestion {
  itemId: string;
  version: number;
  kind: ItemKind;
  stem: string;
  points: number;
  /** Options or steps, in the order shown. */
  choices?: readonly string[];
  unit?: string;
}

export type AnswerKey =
  | { kind: 'multiple_choice'; answer: number }
  | { kind: 'multiple_response'; answers: readonly number[] }
  | { kind: 'true_false'; answer: boolean }
  /** The displayed positions, in the order that reads correctly. */
  | { kind: 'ordering'; order: readonly number[] }
  | { kind: 'numeric'; answer: number; tolerance: number }
  | { kind: 'manual'; modelAnswer: string };

export interface BuiltTest {
  seed: number;
  questions: readonly BuiltQuestion[];
  key: Readonly<Record<string, AnswerKey>>;
}

/** A small seeded generator (mulberry32): the same seed gives the same sequence. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: readonly T[], next: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** The items that may be drawn now: approved, valid, unexpired, at their newest approved version. */
export function eligibleItems(bank: readonly Item[], asOf: string): Item[] {
  const now = Date.parse(asOf);
  const newest = new Map<string, Item>();
  for (const i of bank) {
    if (i.status !== 'approved' || !validateItem(i).ok) continue;
    if (Date.parse(i.reviewAfter!) < now) continue;
    const seen = newest.get(i.id);
    if (!seen || i.version > seen.version) newest.set(i.id, i);
  }
  return [...newest.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const inPool = (i: Item, p: Pool) =>
  (p.outcomeId === undefined || i.outcomeIds.includes(p.outcomeId)) &&
  (p.tag === undefined || i.tags.includes(p.tag)) &&
  (p.kind === undefined || i.kind === p.kind);

/** Assemble a test from a blueprint, or say which slot the bank cannot fill. */
export function buildTest(bank: readonly Item[], blueprint: readonly Slot[], seed: number, asOf: string): Result<BuiltTest> {
  if (blueprint.length === 0) return fail('A blueprint needs at least one slot.');
  const next = rng(seed);
  const taken = new Set<string>();
  const questions: BuiltQuestion[] = [];
  const key: Record<string, AnswerKey> = {};
  const pool = eligibleItems(bank, asOf);

  for (const [n, slot] of blueprint.entries()) {
    if (!Number.isInteger(slot.count) || slot.count < 1) return fail(`Slot ${n + 1} must ask for at least one item.`);
    const candidates = pool.filter((i) => !taken.has(i.id) && inPool(i, slot.pool));
    if (candidates.length < slot.count) {
      return fail(`Slot ${n + 1} asks for ${slot.count} but the bank has ${candidates.length} approved, current items for it.`);
    }
    for (const item of shuffled(candidates, next).slice(0, slot.count)) {
      taken.add(item.id);
      const base = { itemId: item.id, version: item.version, kind: item.kind, stem: item.stem, points: item.points };
      switch (item.kind) {
        case 'multiple_choice': {
          const shown = shuffled(item.options.map((text, index) => ({ text, index })), next);
          questions.push({ ...base, choices: shown.map((s) => s.text) });
          key[item.id] = { kind: 'multiple_choice', answer: shown.findIndex((s) => s.index === item.answer) };
          break;
        }
        case 'multiple_response': {
          const shown = shuffled(item.options.map((text, index) => ({ text, index })), next);
          questions.push({ ...base, choices: shown.map((s) => s.text) });
          key[item.id] = { kind: 'multiple_response', answers: shown.flatMap((s, at) => (item.answers.includes(s.index) ? [at] : [])) };
          break;
        }
        case 'true_false':
          questions.push(base);
          key[item.id] = { kind: 'true_false', answer: item.answer };
          break;
        case 'ordering': {
          const shown = shuffled(item.steps, next);
          questions.push({ ...base, choices: shown });
          key[item.id] = { kind: 'ordering', order: item.steps.map((s) => shown.indexOf(s)) };
          break;
        }
        case 'numeric':
          questions.push({ ...base, ...(item.unit ? { unit: item.unit } : {}) });
          key[item.id] = { kind: 'numeric', answer: item.answer, tolerance: item.tolerance };
          break;
        case 'short_answer':
        case 'essay':
          questions.push(base);
          key[item.id] = { kind: 'manual', modelAnswer: item.modelAnswer };
          break;
      }
    }
  }
  return { ok: true, value: { seed, questions, key } };
}

// ── Scoring a response ────────────────────────────────────────────────────

export type Response = number | boolean | readonly number[];

export type Scored =
  | { status: 'scored'; points: number; max: number }
  | { status: 'needs_marking' }
  | { status: 'invalid_response'; why: string };

const isIndexList = (r: Response, n: number): r is readonly number[] =>
  Array.isArray(r) && r.every((x) => Number.isInteger(x) && x >= 0 && x < n) && new Set(r).size === r.length;

/** Score one response against its key; a written answer is never scored here. */
export function scoreAnswer(key: AnswerKey, points: number, choices: number, response: Response): Scored {
  const scored = (ok: boolean): Scored => ({ status: 'scored', points: ok ? points : 0, max: points });
  switch (key.kind) {
    case 'manual':
      return { status: 'needs_marking' };
    case 'true_false':
      return typeof response === 'boolean' ? scored(response === key.answer) : { status: 'invalid_response', why: 'Answer true or false.' };
    case 'multiple_choice':
      return typeof response === 'number' && inRange(response, choices) ? scored(response === key.answer) : { status: 'invalid_response', why: 'Choose one of the options.' };
    case 'multiple_response': {
      if (!isIndexList(response, choices)) return { status: 'invalid_response', why: 'Choose some of the options, each at most once.' };
      const chosen = new Set(response);
      return scored(chosen.size === key.answers.length && key.answers.every((a) => chosen.has(a)));
    }
    case 'ordering':
      if (!isIndexList(response, choices) || response.length !== choices) return { status: 'invalid_response', why: 'Put every step in an order.' };
      return scored(key.order.every((at, n) => response[n] === at));
    case 'numeric':
      return typeof response === 'number' && Number.isFinite(response)
        ? scored(Math.abs(response - key.answer) <= key.tolerance)
        : { status: 'invalid_response', why: 'Enter a number.' };
  }
}
