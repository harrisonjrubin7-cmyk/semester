/**
 * A rubric turned into a checklist the student can hold their own work
 * against.
 *
 * The brief puts three limits on this and the module is shaped by them:
 *
 * - **Never a grade prediction.** Nothing here reads the student's work, so
 *   there is nothing it could score. The points a criterion is worth are
 *   carried through because they say how much it matters; no function returns
 *   points *earned*, and the test for this module checks the output for any.
 * - **Never presented as instructor feedback.** Every interpretation carries
 *   `DISCLAIMER`, and the UI shows it above the checklist, not below it.
 * - **Linked to the source.** The criterion's own words are kept beside the
 *   checklist so the student can see the checklist did not invent a standard.
 *
 * The parse is deliberately plain. A criterion is a line with points on it —
 * "Evidence and Analysis — 30 points", "Thesis (10 pts)", "Organization: 20" —
 * and the lines below it until the next criterion are its descriptors. Each
 * descriptor sentence becomes one self-check item, in its own words. Rewriting
 * the rubric into friendlier language would be the one place an
 * interpretation could quietly change what is being asked for.
 */

export const DISCLAIMER =
  'This is a study and revision guide made from the rubric’s own words. It is not a grade prediction and not feedback from your instructor.';

export interface Criterion {
  name: string;
  points?: number;
  source: string;
  checks: string[];
}

const HEAD = /^\s*(?:[-*•]\s*)?(.+?)\s*(?:[—–:-]\s*|\(\s*)(\d+(?:\.\d+)?)\s*(?:points?|pts?|marks?)?\s*\)?\s*$/i;

export function interpret(rubric: string): Criterion[] {
  const out: Criterion[] = [];
  let current: { name: string; points?: number; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const source = current.lines.join(' ').replace(/\s+/g, ' ').trim();
    const checks = current.lines
      .flatMap((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').split(/(?<=[.!?])\s+(?=[A-Z])/))
      .map((x) => x.trim().replace(/[.;]+$/, ''))
      .filter((x) => x.length > 3);
    out.push({ name: current.name, points: current.points, source, checks });
  };
  for (const raw of rubric.split('\n')) {
    if (!raw.trim()) continue;
    const head = HEAD.exec(raw);
    if (head && head[1].length <= 120) {
      flush();
      current = { name: head[1].replace(/[—–:-]\s*$/, '').trim(), points: Number(head[2]), lines: [] };
    } else if (current) current.lines.push(raw);
    else current = { name: raw.trim().slice(0, 120), lines: [] };
  }
  flush();
  return out;
}
