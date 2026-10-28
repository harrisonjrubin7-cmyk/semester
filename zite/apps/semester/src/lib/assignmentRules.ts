// Assignment versions (S-80 §6 LMS test 2, S-82 §8B): a draft is invisible to students; publishing freezes an exact,
// numbered version; a revision is a new version and never rewrites what was assigned or submitted. Pure; the database
// re-checks the same rules (lib/asgMigration.ts). Tested in tests/assignmentRules.test.ts.
export type AssignmentDraft = { title: string; instructions: string; dueAt: string; points: number; rubric: string; attemptsAllowed: number; aiPolicy: string };
export const FIELDS: (keyof AssignmentDraft)[] = ['title', 'instructions', 'dueAt', 'points', 'rubric', 'attemptsAllowed', 'aiPolicy'];
export const AI_POLICIES = ['Course policy', 'Allowed', 'Outlining only', 'Not allowed'] as const;
const LABEL: Record<keyof AssignmentDraft, string> = { title: 'Title', instructions: 'Instructions', dueAt: 'Due date', points: 'Points', rubric: 'Rubric', attemptsAllowed: 'Attempts allowed', aiPolicy: 'AI use' };

export const emptyDraft = (): AssignmentDraft => ({ title: '', instructions: '', dueAt: '', points: 100, rubric: '', attemptsAllowed: 1, aiPolicy: 'Course policy' });

/** Problems that stop a draft from being published (a draft may be saved with problems). */
export function publishProblems(d: AssignmentDraft, now = new Date()): string[] {
  const out: string[] = [];
  if (d.title.trim().length < 2 || d.title.trim().length > 160) out.push('Give the assignment a title of 2 to 160 characters.');
  const due = new Date(d.dueAt);
  if (!d.dueAt || isNaN(due.getTime())) out.push('Choose a due date.');
  else if (due <= now) out.push('The due date must be in the future.');
  if (!(d.points >= 0 && d.points <= 1000)) out.push('Points must be between 0 and 1000.');
  if (!(Number.isInteger(d.attemptsAllowed) && d.attemptsAllowed >= 1 && d.attemptsAllowed <= 10)) out.push('Allow 1 to 10 attempts.');
  if (d.instructions.length > 20000) out.push('Instructions can be up to 20,000 characters.');
  if (d.rubric.length > 8000) out.push('The rubric can be up to 8,000 characters.');
  if (!(AI_POLICIES as readonly string[]).includes(d.aiPolicy)) out.push('Choose an AI-use rule.');
  return out;
}

/** What changed between two versions, in words, for the change notice and history. */
export function changes(a: AssignmentDraft | null, b: AssignmentDraft): string[] {
  if (!a) return ['First published'];
  return FIELDS.filter((f) => (f === 'dueAt' ? new Date(a.dueAt).getTime() !== new Date(b.dueAt).getTime() : a[f] !== b[f])).map((f) =>
    f === 'dueAt' ? `Due date: ${new Date(a.dueAt).toISOString().slice(0, 16)} → ${new Date(b.dueAt).toISOString().slice(0, 16)}` :
    f === 'points' || f === 'attemptsAllowed' || f === 'aiPolicy' ? `${LABEL[f]}: ${a[f]} → ${b[f]}` : `${LABEL[f]} changed`);
}
