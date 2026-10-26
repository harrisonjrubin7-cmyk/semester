// Rubrics: criteria with scored levels. Pure; tests/rubricRules.test.ts. Versions are frozen in Postgres (lib/teamMigration.ts).
export type Level = { label: string; points: number };
export type Criterion = { id: string; name: string; levels: Level[] };

export function validateRubric(title: string, cs: Criterion[]): string | null {
  if (title.trim().length < 3 || title.length > 120) return 'Give the rubric a title (3–120 characters).';
  if (!cs.length || cs.length > 20) return 'A rubric needs 1 to 20 criteria.';
  const ids = new Set<string>();
  for (const [i, c] of cs.entries()) {
    const n = `Criterion ${i + 1}`;
    if (!c.id || ids.has(c.id)) return `${n} needs a unique id.`;
    ids.add(c.id);
    if (c.name.trim().length < 2 || c.name.length > 200) return `${n} needs a name.`;
    if (c.levels.length < 2 || c.levels.length > 6) return `${n} needs 2 to 6 levels.`;
    if (c.levels.some((l) => !l.label.trim() || !(l.points >= 0 && l.points <= 100))) return `${n} has a level without a label or with points outside 0–100.`;
  }
  return null;
}

export const rubricMax = (cs: Criterion[]) => cs.reduce((n, c) => n + Math.max(...c.levels.map((l) => l.points)), 0);

/** Score from one selected level per criterion; every criterion must be scored. Returns null if incomplete or invalid. */
export function rubricScore(cs: Criterion[], selections: Record<string, number>): number | null {
  let total = 0;
  for (const c of cs) {
    const k = selections[c.id];
    if (!Number.isInteger(k) || k < 0 || k >= c.levels.length) return null;
    total += c.levels[k].points;
  }
  return total;
}
