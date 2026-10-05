/**
 * The grade ledger: entering, moderating, releasing, contesting and
 * resolving, as an append-only history.
 *
 * Every function takes a `Gradebook` and returns a new one alongside its
 * `Decision`; the old one is never touched, and no function removes or edits
 * an `Entry`. A grade's current state is its highest version, what a student
 * sees is its highest *released* version, and everything in between stays in
 * `entries` for anybody reviewing how it got there.
 *
 * The same rules as `20260929310000_gradebook.sql`, in the same order, so the
 * two can be read side by side:
 *
 *   enter      grades:enter; the student is on the roster and is not you; a
 *              score between 0 and twice the item's points, or a mark that
 *              needs none; a reason when it changes a released grade
 *   moderate   grades:moderate; the current version is a draft; you are not
 *              the person who set its score
 *   release    grades:release; every current draft or moderated version on
 *              the item, except drafts the scheme says must be moderated first
 *   regrade    the student themselves, over a released grade, one open request
 *              per item at a time
 *   resolve    grades:enter; once per request; a change is a new draft
 *              version, released like any other
 */
import {
  MARKS,
  holds,
  refuse,
  type Actor,
  type Decision,
  type Entry,
  type Gradebook,
  type Item,
  type Mark,
  type RegradeRequest,
  type Status,
} from './model';

type Outcome<T> = { book: Gradebook; decision: Decision<T> };

const unchanged = <T>(book: Gradebook, d: Decision<T>): Outcome<T> => ({ book, decision: d });

/** The highest version of one student's grade on one item, or null. */
export function current(book: Gradebook, itemId: string, studentId: string): Entry | null {
  let best: Entry | null = null;
  for (const e of book.entries) {
    if (e.itemId === itemId && e.studentId === studentId && (!best || e.version > best.version)) best = e;
  }
  return best;
}

/** The highest released version, which is what the student sees. */
export function latestReleased(book: Gradebook, itemId: string, studentId: string): Entry | null {
  let best: Entry | null = null;
  for (const e of book.entries) {
    if (e.itemId === itemId && e.studentId === studentId && e.status === 'released' && (!best || e.version > best.version)) {
      best = e;
    }
  }
  return best;
}

/** Every item's latest released version for one student — the only grades that count anywhere. */
export function releasedFor(book: Gradebook, studentId: string): Entry[] {
  return book.items.flatMap((i) => latestReleased(book, i.id, studentId) ?? []);
}

// ── Idempotency ───────────────────────────────────────────────────────────

const KEY = /^[A-Za-z0-9:._-]{8,200}$/;

/**
 * The key check every mutation starts with. `null` means go ahead; anything
 * else is the answer — a replay of the first one, or a refusal.
 */
function spent<T>(book: Gradebook, actor: Actor, key: string, kind: string, request: unknown): Decision<T> | null {
  if (!KEY.test(key)) return refuse('bad-key', 'An idempotency key is 8 to 200 letters, digits or : . _ -.');
  const was = book.operations[key];
  if (!was) return null;
  if (was.actor !== actor.id || was.kind !== kind || was.request !== JSON.stringify(request)) {
    return refuse('key-reused', 'That idempotency key was already used for a different request.');
  }
  return { ok: true, value: was.result as T, reason: 'Already done; this is the first answer again.', replayed: true };
}

function keepOperation<T>(book: Gradebook, actor: Actor, key: string, kind: string, request: unknown, result: T): Gradebook {
  return {
    ...book,
    operations: { ...book.operations, [key]: { actor: actor.id, kind, request: JSON.stringify(request), result } },
  };
}

function item(book: Gradebook, id: string): Item | undefined {
  return book.items.find((i) => i.id === id);
}

function next(prior: Entry, patch: Partial<Entry> & { status: Status; action: Entry['action'] }, id: string, actor: Actor, operation: string, at: string): Entry {
  return { ...prior, ...patch, id, version: prior.version + 1, actor: actor.id, operation, at, reason: patch.reason ?? '', regradeId: patch.regradeId ?? prior.regradeId };
}

// ── Entering a score ──────────────────────────────────────────────────────

export interface ScoreInput {
  itemId: string;
  studentId: string;
  score: number | null;
  mark: Mark | null;
  comment: string;
  /** Required when the grade has been released before: a changed grade says why. */
  reason: string;
  key: string;
}

export function scoreProblem(it: Item, score: number | null, mark: Mark | null): string | null {
  if (mark !== null && !MARKS.includes(mark)) return `"${mark}" is not a mark.`;
  if (score === null) {
    return mark === 'excused' || mark === 'incomplete' || mark === 'missing'
      ? null
      : 'A score is needed unless the item is excused, incomplete or missing.';
  }
  if (!Number.isFinite(score) || score < 0 || score > it.pointsPossible * 2) {
    return `A score on "${it.title}" is between 0 and ${it.pointsPossible * 2}.`;
  }
  if (mark === 'excused' || mark === 'missing') return `An item marked ${mark} carries no score.`;
  return null;
}

export function enterScore(book: Gradebook, actor: Actor, input: ScoreInput, at: string): Outcome<number> {
  const request = { ...input, key: undefined };
  const replay = spent<number>(book, actor, input.key, 'enter', request);
  if (replay) return unchanged(book, replay);
  if (!holds(actor, 'grades:enter')) return unchanged(book, refuse('not-authorised', 'Entering grades needs grades:enter on this course.'));
  const it = item(book, input.itemId);
  if (!it) return unchanged(book, refuse('unknown-item', 'No such item in this course and term.'));
  if (!book.roster.has(input.studentId)) return unchanged(book, refuse('not-on-roster', 'That student is not enrolled in this course.'));
  if (input.studentId === actor.id) return unchanged(book, refuse('self-grade', 'Nobody enters their own grade.'));
  const problem = scoreProblem(it, input.score, input.mark);
  if (problem) return unchanged(book, refuse('bad-score', problem));

  const prior = current(book, it.id, input.studentId);
  const wasReleased = latestReleased(book, it.id, input.studentId) !== null;
  if (wasReleased && !input.reason.trim()) {
    return unchanged(book, refuse('reason-required', 'This grade has been released; a change needs a reason, which is kept.'));
  }
  if (prior && prior.score === input.score && prior.mark === input.mark && prior.comment === input.comment) {
    return unchanged(book, refuse('unchanged', 'That is already the grade; nothing new to record.'));
  }
  const entry: Entry = {
    id: `${input.key}`,
    itemId: it.id,
    studentId: input.studentId,
    version: (prior?.version ?? 0) + 1,
    score: input.score,
    mark: input.mark,
    comment: input.comment,
    status: 'draft',
    action: wasReleased ? 'changed' : 'entered',
    gradedBy: actor.id,
    actor: actor.id,
    reason: input.reason.trim(),
    regradeId: null,
    operation: input.key,
    at,
  };
  const book2 = keepOperation({ ...book, entries: [...book.entries, entry] }, actor, input.key, 'enter', request, entry.version);
  return {
    book: book2,
    decision: {
      ok: true,
      value: entry.version,
      reason: wasReleased ? 'Recorded as a draft change; the released grade stays visible until this is released.' : 'Recorded as a draft.',
      replayed: false,
    },
  };
}

// ── Moderation ────────────────────────────────────────────────────────────

export function moderate(book: Gradebook, actor: Actor, input: { itemId: string; studentId: string; key: string }, at: string): Outcome<number> {
  const request = { itemId: input.itemId, studentId: input.studentId };
  const replay = spent<number>(book, actor, input.key, 'moderate', request);
  if (replay) return unchanged(book, replay);
  if (!holds(actor, 'grades:moderate')) return unchanged(book, refuse('not-authorised', 'Moderating needs grades:moderate on this course.'));
  if (!item(book, input.itemId)) return unchanged(book, refuse('unknown-item', 'No such item in this course and term.'));
  const prior = current(book, input.itemId, input.studentId);
  if (!prior || prior.status !== 'draft') {
    return unchanged(book, refuse('nothing-to-moderate', 'There is no draft grade here to moderate.'));
  }
  if (prior.gradedBy === actor.id) {
    return unchanged(book, refuse('self-moderation', 'Moderation is a second person: the grader cannot moderate their own grade.'));
  }
  const entry = next(prior, { status: 'moderated', action: 'moderated' }, input.key, actor, input.key, at);
  return {
    book: keepOperation({ ...book, entries: [...book.entries, entry] }, actor, input.key, 'moderate', request, entry.version),
    decision: { ok: true, value: entry.version, reason: 'Moderated; ready to release.', replayed: false },
  };
}

// ── Release ───────────────────────────────────────────────────────────────

export interface Released {
  released: number;
  /** Drafts the scheme requires to be moderated first, left as they were. */
  held: number;
}

export function release(book: Gradebook, actor: Actor, input: { itemId: string; key: string }, at: string): Outcome<Released> {
  const request = { itemId: input.itemId };
  const replay = spent<Released>(book, actor, input.key, 'release', request);
  if (replay) return unchanged(book, replay);
  if (!holds(actor, 'grades:release')) return unchanged(book, refuse('not-authorised', 'Releasing grades needs grades:release on this course.'));
  const it = item(book, input.itemId);
  if (!it) return unchanged(book, refuse('unknown-item', 'No such item in this course and term.'));

  const added: Entry[] = [];
  let held = 0;
  const students = [...new Set(book.entries.filter((e) => e.itemId === it.id).map((e) => e.studentId))].sort();
  for (const s of students) {
    const prior = current(book, it.id, s);
    if (!prior || prior.status === 'released') continue;
    if (book.scheme.moderationRequired && prior.status !== 'moderated') {
      held++;
      continue;
    }
    added.push(next(prior, { status: 'released', action: 'released' }, `${input.key}:${s}`, actor, input.key, at));
  }
  const value = { released: added.length, held };
  if (added.length === 0) {
    return unchanged(book, refuse('nothing-to-release', held
      ? `${held} ${held === 1 ? 'grade waits' : 'grades wait'} for moderation; nothing else is unreleased.`
      : 'Every grade on this item is already released.'));
  }
  return {
    book: keepOperation({ ...book, entries: [...book.entries, ...added] }, actor, input.key, 'release', request, value),
    decision: {
      ok: true,
      value,
      reason: `Released ${added.length}.${held ? ` ${held} held until moderated.` : ''}`,
      replayed: false,
    },
  };
}

// ── Regrade requests ──────────────────────────────────────────────────────

export function isOpen(book: Gradebook, r: RegradeRequest): boolean {
  return !book.resolutions.some((x) => x.requestId === r.id);
}

export function fileRegrade(book: Gradebook, student: Actor, input: { itemId: string; reason: string; key: string }, at: string): Outcome<string> {
  const request = { itemId: input.itemId, reason: input.reason };
  const replay = spent<string>(book, student, input.key, 'regrade', request);
  if (replay) return unchanged(book, replay);
  if (!item(book, input.itemId)) return unchanged(book, refuse('unknown-item', 'No such item in this course and term.'));
  const shown = latestReleased(book, input.itemId, student.id);
  if (!shown) return unchanged(book, refuse('no-released-grade', 'A regrade is asked of a released grade, and there is none here.'));
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 2000) return unchanged(book, refuse('reason-required', 'Say what should be looked at again, in at most 2,000 characters.'));
  if (book.regrades.some((r) => r.itemId === input.itemId && r.studentId === student.id && isOpen(book, r))) {
    return unchanged(book, refuse('regrade-open', 'There is already an open request on this item.'));
  }
  const r: RegradeRequest = { id: input.key, itemId: input.itemId, studentId: student.id, contestedEntry: shown.id, reason, at };
  return {
    book: keepOperation({ ...book, regrades: [...book.regrades, r] }, student, input.key, 'regrade', request, r.id),
    decision: { ok: true, value: r.id, reason: 'Filed; the grader resolves it, and the grade you were shown stays as it is meanwhile.', replayed: false },
  };
}

export interface Resolution {
  requestId: string;
  outcome: 'upheld' | 'changed';
  score: number | null;
  mark: Mark | null;
  note: string;
  key: string;
}

export function resolveRegrade(book: Gradebook, actor: Actor, input: Resolution, at: string): Outcome<string | null> {
  const request = { ...input, key: undefined };
  const replay = spent<string | null>(book, actor, input.key, 'resolve', request);
  if (replay) return unchanged(book, replay);
  if (!holds(actor, 'grades:enter')) return unchanged(book, refuse('not-authorised', 'Resolving a regrade needs grades:enter on this course.'));
  const r = book.regrades.find((x) => x.id === input.requestId);
  if (!r) return unchanged(book, refuse('unknown-request', 'No such regrade request in this course.'));
  if (r.studentId === actor.id) return unchanged(book, refuse('self-grade', 'Nobody resolves a request about their own grade.'));
  if (!isOpen(book, r)) return unchanged(book, refuse('already-resolved', 'That request has been resolved; its answer is kept as it was.'));
  const note = input.note.trim();
  if (!note) return unchanged(book, refuse('reason-required', 'A resolution says why, and the student reads it.'));

  let entries = book.entries;
  let entryId: string | null = null;
  if (input.outcome === 'changed') {
    const it = item(book, r.itemId);
    const prior = current(book, r.itemId, r.studentId);
    if (!it || !prior) return unchanged(book, refuse('unknown-item', 'The item this request was about is gone.'));
    const problem = scoreProblem(it, input.score, input.mark);
    if (problem) return unchanged(book, refuse('bad-score', problem));
    const e = next(prior, {
      status: 'draft', action: 'regraded', score: input.score, mark: input.mark, gradedBy: actor.id, reason: note, regradeId: r.id,
    }, input.key, actor, input.key, at);
    entries = [...entries, e];
    entryId = e.id;
  }
  const book2 = keepOperation(
    { ...book, entries, resolutions: [...book.resolutions, { requestId: r.id, outcome: input.outcome, note, entryId, resolvedBy: actor.id, at }] },
    actor, input.key, 'resolve', request, entryId,
  );
  return {
    book: book2,
    decision: {
      ok: true,
      value: entryId,
      reason: input.outcome === 'changed' ? 'Changed as a draft; the student sees it once it is released.' : 'Upheld; the grade stands.',
      replayed: false,
    },
  };
}
