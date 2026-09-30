/**
 * A rubric with performance levels and outcomes, scored by level.
 *
 * `docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md` (L09) names what a rubric
 * lacked: performance levels, outcome mapping and versions. This file is those,
 * as pure functions over rows the caller passes in. It reads no database, holds
 * no student, and is wired to no screen: the sandbox in
 * `server/institution/sandbox.ts` and the student's own `grades.ts` are
 * untouched.
 *
 * It does not keep grades. It once carried a grade ledger (excused work, an
 * override with a reason, history) too; that was removed when the gradebook of
 * record (`lib/gradebook/`, with its append-only versions, kept reasons and
 * excused marks) landed and made it a second, unconnected copy.
 *
 * Rules kept on purpose:
 *
 *   - **A mark is a level, not a number.** A rubric is scored by choosing a
 *     level for each criterion, so the points a student receives are the ones
 *     the rubric published. A criterion left unscored, a level the criterion
 *     does not have, or a selection made against another version of the rubric
 *     is refused; nothing is guessed or defaulted.
 *   - **A rubric with an empty box is refused.** Every level needs its
 *     descriptor, the sandbox's own rule, so a student is never scored against
 *     words nobody wrote.
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
