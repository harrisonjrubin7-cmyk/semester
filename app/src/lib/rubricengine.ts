/**
 * A rubric with performance levels and outcomes, scored by level, and a small
 * grade ledger that overlaps the gradebook of record. Pure functions over rows
 * the caller passes in: no database, no student, wired to no screen. The
 * sandbox in `server/institution/sandbox.ts` and the student's own `grades.ts`
 * are untouched.
 *
 * ## The rubric half
 *
 * `docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md` (L09) named what a rubric
 * lacked: performance levels, outcome mapping and versions. Nothing else in the
 * tree has them (`lib/gradebook/` has no rubric), so this half stands.
 *
 *   - **A mark is a level, not a number.** A rubric is scored by choosing a
 *     level for each criterion, so the points a student receives are the ones
 *     the rubric published. A criterion left unscored, a level the criterion
 *     does not have, or a selection made against another version of the rubric
 *     is refused; nothing is guessed or defaulted.
 *   - **A rubric with an empty box is refused.** Every level needs its
 *     descriptor, the sandbox's own rule, so a student is never scored against
 *     words nobody wrote.
 *
 * ## The ledger half overlaps `lib/gradebook/`, and stays until someone decides
 *
 * The ledger was written while the register still said no gradebook existed;
 * the gradebook of record (`lib/gradebook/ledger.ts`, `compute.ts`, with its
 * tables and row-level security) merged afterwards and is the source of truth.
 * Nothing imports this ledger, and it was removed once on that ground. It is
 * back, because "nothing uses it" is not "the gradebook covers it": the two
 * differ in ways that are choices, and a choice is not this file's to erase.
 *
 * Covered, each held by a gradebook test (`gradebook/gradebook.test.ts`):
 *   - history is never edited or removed ("never edits or removes a version:
 *     every earlier one is still there, byte for byte");
 *   - excused work leaves the calculation and missing counts as zero ("leaves
 *     excused work out, counts missing as zero, and never drops the only item");
 *   - a change to a released grade needs a reason that is kept ("needs a
 *     reason, and leaves the released grade in view until the change is
 *     released");
 *   - an excused or missing item carries no score, and a score is bounded
 *     ("refuses a score out of range, a mark that contradicts it, and no score
 *     without a reason for none");
 *   - a repeated request is replayed, not written twice ("replays the same key
 *     and request without writing twice");
 *   - no number when nothing is released ("has no number when nothing is
 *     released, and refuses to be handed a draft").
 *
 * Not the same (this ledger's rule, then the gradebook's):
 *   - a reason on every later entry, against a reason only once the grade has
 *     been released (drafts are working copies);
 *   - a score no higher than the item's maximum, against up to twice it (extra
 *     credit);
 *   - lifting an excusal restores the grade beneath it, against re-entering a
 *     score as a new version;
 *   - an entry dated before the one it follows is refused, against no such rule
 *     in the library (the database stamps `at` with `now()`);
 *   - an item's maximum cannot change once graded, against no function that
 *     edits it (the migration has an insert and no update).
 *
 * Decision owed, by whoever owns the gradebook: whether it should take any of
 * the second list (a reason on every edit, a restore on lifting an excusal, an
 * out-of-order refusal), after which this ledger can go; or whether this ledger
 * is kept as a specification. Until then it is not a source of truth for
 * anything.
 *
 * Rules this ledger keeps:
 *
 *   - **The ledger only grows.** An override, an excusal or a lifting of one is
 *     a new entry with a reason and a name; nothing is edited or removed, so the
 *     grade history is the ledger itself.
 *   - **Excused is not zero.** Excused work leaves the denominator; missing work
 *     is not excused work, and an excusal can be lifted without losing the grade
 *     beneath it.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; why: string };
const fail = (why: string): { ok: false; why: string } => ({ ok: false, why });

// ── Rubrics ───────────────────────────────────────────────────────────────

export interface Level {
  id: string;
  label: string;
  points: number;
  /** What this level looks like, in words a student can read. */
  descriptor: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  /** Learning outcomes this criterion is evidence for. */
  outcomeIds: readonly string[];
  levels: readonly Level[];
}

export interface Rubric {
  id: string;
  version: number;
  criteria: readonly RubricCriterion[];
}

const maxPoints = (c: RubricCriterion) => Math.max(...c.levels.map((l) => l.points));

/** Whether a rubric may be used to score anyone. */
export function validateRubric(r: Rubric): Result<Rubric> {
  if (!Number.isInteger(r.version) || r.version < 1) return fail('A rubric version is a whole number from 1.');
  if (r.criteria.length === 0) return fail('A rubric needs at least one criterion.');
  const criterionIds = new Set<string>();
  for (const c of r.criteria) {
    if (criterionIds.has(c.id)) return fail(`Criterion ${c.id} appears twice.`);
    criterionIds.add(c.id);
    if (!c.name.trim()) return fail(`Criterion ${c.id} has no name.`);
    if (c.levels.length < 2) return fail(`Criterion ${c.name} needs at least two levels.`);
    const levelIds = new Set<string>();
    for (const l of c.levels) {
      if (levelIds.has(l.id)) return fail(`Criterion ${c.name} has level ${l.id} twice.`);
      levelIds.add(l.id);
      if (!l.label.trim() || !l.descriptor.trim()) return fail(`Criterion ${c.name}, level ${l.id}, has an empty box.`);
      if (!Number.isFinite(l.points) || l.points < 0) return fail(`Criterion ${c.name}, level ${l.id}, has invalid points.`);
    }
  }
  return { ok: true, value: r };
}

/** The next version of a rubric: same id, new criteria, and never a silent edit of the old one. */
export function reviseRubric(prev: Rubric, criteria: readonly RubricCriterion[]): Result<Rubric> {
  return validateRubric({ id: prev.id, version: prev.version + 1, criteria });
}

export interface RubricSelection {
  /** The version the grader was looking at. */
  rubricVersion: number;
  /** criterion id → level id. */
  levels: Readonly<Record<string, string>>;
}

export interface RubricScore {
  rubricId: string;
  rubricVersion: number;
  total: number;
  max: number;
  criteria: readonly { criterionId: string; levelId: string; points: number; max: number }[];
  /** Points and maximum per outcome, from the criteria that evidence it. */
  outcomes: Readonly<Record<string, { points: number; max: number }>>;
}

/** Score a rubric from the level chosen for each criterion. */
export function scoreRubric(rubric: Rubric, selection: RubricSelection): Result<RubricScore> {
  const valid = validateRubric(rubric);
  if (!valid.ok) return valid;
  if (selection.rubricVersion !== rubric.version) {
    return fail(`Scored against version ${selection.rubricVersion}, but the rubric is at version ${rubric.version}.`);
  }
  const known = new Set(rubric.criteria.map((c) => c.id));
  for (const id of Object.keys(selection.levels)) if (!known.has(id)) return fail(`Criterion ${id} is not in this rubric.`);

  const criteria: { criterionId: string; levelId: string; points: number; max: number }[] = [];
  const outcomes: Record<string, { points: number; max: number }> = {};
  for (const c of rubric.criteria) {
    const levelId = selection.levels[c.id];
    if (levelId === undefined) return fail(`Criterion ${c.name} has no level chosen.`);
    const level = c.levels.find((l) => l.id === levelId);
    if (!level) return fail(`Criterion ${c.name} has no level ${levelId}.`);
    const max = maxPoints(c);
    criteria.push({ criterionId: c.id, levelId, points: level.points, max });
    for (const o of c.outcomeIds) {
      const so = outcomes[o] ?? { points: 0, max: 0 };
      outcomes[o] = { points: so.points + level.points, max: so.max + max };
    }
  }
  return {
    ok: true,
    value: {
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      total: criteria.reduce((s, c) => s + c.points, 0),
      max: criteria.reduce((s, c) => s + c.max, 0),
      criteria,
      outcomes,
    },
  };
}

// ── The grade ledger ──────────────────────────────────────────────────────

export type EntryKind = 'graded' | 'override' | 'excused' | 'unexcused';

export interface GradeEntry {
  id: string;
  studentId: string;
  itemId: string;
  kind: EntryKind;
  /** Points for graded and override; null for excused and unexcused. */
  points: number | null;
  outOf: number;
  /** Who made the entry. */
  by: string;
  at: string;
  /** Required for everything but the first grade. */
  reason?: string;
  rubricVersion?: number;
}

export type Ledger = readonly GradeEntry[];

/** Add an entry to a ledger, returning a new ledger, or say why it was refused. */
export function appendEntry(ledger: Ledger, e: GradeEntry): Result<Ledger> {
  if (ledger.some((x) => x.id === e.id)) return fail(`Entry ${e.id} already exists; the ledger is never edited.`);
  if (!e.by.trim()) return fail('An entry needs the name of who made it.');
  if (!Number.isFinite(Date.parse(e.at))) return fail('An entry needs a valid time.');
  if (!(e.outOf > 0)) return fail('A grade item needs a positive maximum.');
  const mine = ledger.filter((x) => x.studentId === e.studentId && x.itemId === e.itemId);
  const last = mine[mine.length - 1];
  if (last && Date.parse(e.at) < Date.parse(last.at)) return fail('An entry cannot be dated before the one it follows.');
  if (last && last.outOf !== e.outOf) return fail('The maximum of a grade item cannot change once it has a grade; make a new item.');

  if (e.kind === 'graded' || e.kind === 'override') {
    if (e.points === null || !Number.isFinite(e.points) || e.points < 0 || e.points > e.outOf) {
      return fail(`Points must be from 0 to ${e.outOf}.`);
    }
  } else if (e.points !== null) {
    return fail('An excusal carries no points.');
  }
  if (e.kind === 'override' && !current(mine)?.hasGrade) return fail('There is no grade to override.');
  if (e.kind === 'excused' && current(mine)?.excused) return fail('This work is already excused.');
  if (e.kind === 'unexcused' && !current(mine)?.excused) return fail('This work is not excused.');
  const needsReason = e.kind !== 'graded' || mine.length > 0;
  if (needsReason && !(e.reason ?? '').trim()) return fail(`A ${e.kind === 'graded' ? 'regrade' : e.kind} needs a reason.`);
  return { ok: true, value: [...ledger, e] };
}

interface State { excused: boolean; hasGrade: boolean; points: number | null; overridden: boolean }

function current(entries: Ledger): State | undefined {
  if (entries.length === 0) return undefined;
  let excused = false;
  let points: number | null = null;
  let overridden = false;
  for (const e of entries) {
    if (e.kind === 'excused') excused = true;
    else if (e.kind === 'unexcused') excused = false;
    else {
      points = e.points;
      overridden = e.kind === 'override';
    }
  }
  return { excused, hasGrade: points !== null, points, overridden };
}

export interface ItemGrade {
  status: 'graded' | 'excused' | 'missing';
  points: number | null;
  outOf: number;
  overridden: boolean;
  /** How many entries stand behind this grade. */
  entries: number;
}

/** Where one student's one item stands now, and how it got there. */
export function itemGrade(ledger: Ledger, studentId: string, itemId: string): ItemGrade | undefined {
  const mine = ledger.filter((x) => x.studentId === studentId && x.itemId === itemId);
  const s = current(mine);
  if (!s) return undefined;
  const outOf = mine[mine.length - 1]!.outOf;
  return {
    status: s.excused ? 'excused' : s.hasGrade ? 'graded' : 'missing',
    points: s.points,
    outOf,
    overridden: s.overridden,
    entries: mine.length,
  };
}

/**
 * The percentage over a set of items: excused work leaves the denominator and
 * an item whose excusal was lifted before it was graded counts as zero. An item
 * with no entry at all is not in the ledger yet and is skipped. Null when
 * nothing counts.
 */
export function percentOver(ledger: Ledger, studentId: string, itemIds: readonly string[]): number | null {
  let earned = 0;
  let possible = 0;
  for (const id of itemIds) {
    const g = itemGrade(ledger, studentId, id);
    if (!g || g.status === 'excused') continue;
    earned += g.points ?? 0;
    possible += g.outOf;
  }
  return possible === 0 ? null : earned / possible;
}
