// Course Studio assessments: question validation, scoring and the student view. Pure; tests/assessRules.test.ts.
// The question set is frozen per published version in Postgres (lib/asmMigration.ts); scoring always uses that frozen copy.
export type QType = 'single' | 'multi' | 'short';
export type Question = { id: string; type: QType; prompt: string; options: string[]; answer: number[]; points: number };
export type Answers = Record<string, number[] | string>;

export function validateQuestions(qs: Question[]): string | null {
  if (!qs.length) return 'Add at least one question.';
  if (qs.length > 100) return 'An assessment can have up to 100 questions.';
  const ids = new Set<string>();
  for (const [i, q] of qs.entries()) {
    const n = `Question ${i + 1}`;
    if (!q.id || ids.has(q.id)) return `${n} needs a unique id.`;
    ids.add(q.id);
    if (q.prompt.trim().length < 3 || q.prompt.length > 4000) return `${n} needs a prompt (3–4000 characters).`;
    if (!(q.points > 0 && q.points <= 100)) return `${n} must be worth between 0 and 100 points.`;
    if (q.type === 'short') { if (q.options.length || q.answer.length) return `${n}: short answers have no options or key; they are graded by hand.`; continue; }
    if (q.options.length < 2 || q.options.length > 10) return `${n} needs 2–10 options.`;
    if (q.options.some((o) => !o.trim())) return `${n} has an empty option.`;
    if (q.answer.some((a) => !Number.isInteger(a) || a < 0 || a >= q.options.length)) return `${n} has an answer key outside its options.`;
    if (q.type === 'single' && q.answer.length !== 1) return `${n} needs exactly one correct option.`;
    if (q.type === 'multi' && q.answer.length < 1) return `${n} needs at least one correct option.`;
  }
  return null;
}

export const totalPoints = (qs: Question[]) => qs.reduce((n, q) => n + q.points, 0);

/** Students never receive the answer key. */
export const studentView = (qs: Question[]) => qs.map(({ answer: _answer, ...q }) => q);

/** Auto-scores choice questions (all-or-nothing per question); short answers wait for a person. */
export function scoreAttempt(qs: Question[], answers: Answers): { auto: number; needsManual: boolean } {
  let auto = 0, needsManual = false;
  for (const q of qs) {
    const a = answers[q.id];
    if (q.type === 'short') { if (typeof a === 'string' && a.trim()) needsManual = true; continue; }
    if (!Array.isArray(a)) continue;
    const got = [...new Set(a)].sort((x, y) => x - y).join(',');
    const key = [...q.answer].sort((x, y) => x - y).join(',');
    if (got === key) auto += q.points;
  }
  return { auto, needsManual };
}

/** Keeps only answers to questions that exist, of the right shape, within bounds. */
export function cleanAnswers(qs: Question[], answers: Answers): Answers {
  const out: Answers = {};
  for (const q of qs) {
    const a = answers[q.id];
    if (q.type === 'short') { if (typeof a === 'string') out[q.id] = a.slice(0, 10000); continue; }
    if (Array.isArray(a)) {
      const v = [...new Set(a.filter((x) => Number.isInteger(x) && x >= 0 && x < q.options.length))];
      out[q.id] = q.type === 'single' ? v.slice(0, 1) : v;
    }
  }
  return out;
}
