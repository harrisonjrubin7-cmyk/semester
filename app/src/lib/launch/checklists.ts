/**
 * First-day checklists, one per role (launch-readiness Phase 6).
 *
 * Each step names the screen it happens on as a `Screen`, so a checklist that
 * sends somebody to a screen the app no longer has fails the type check rather
 * than the first day. `docs/launch/FIRST-DAY-CHECKLISTS.md` is these lists in
 * prose, and `checklists.test.ts` fails when the two disagree.
 *
 * The rule for what goes on a list: something a person in that role needs on
 * day one and would not find by accident. A list is short on purpose — seven
 * steps and twenty minutes at most — because a first-day checklist nobody
 * finishes teaches that checklists are optional.
 */
import type { Screen } from '../types';

export type Role = 'student' | 'faculty' | 'advisor' | 'admin';

export interface Step {
  id: string;
  do: string;
  /** Where in the app. Absent only for a step that happens outside it. */
  on?: Screen;
  minutes: number;
}

export const MAX_STEPS = 7;
export const MAX_MINUTES = 20;

export const FIRST_DAY: Record<Role, readonly Step[]> = {
  student: [
    { id: 'add-course', do: 'Add one course from its syllabus, and check the dates it found before keeping them', on: 'import', minutes: 5 },
    { id: 'see-today', do: 'Open Today and check the next deadline is the one you expected', on: 'home', minutes: 1 },
    { id: 'calendar', do: 'Look at the week in the Calendar, and fix any class time that is wrong', on: 'calendar', minutes: 3 },
    { id: 'study', do: 'Try one study session on the course you added', on: 'study', minutes: 5 },
    { id: 'privacy', do: 'Read what leaves your device and what stays on it', on: 'privacy', minutes: 3 },
    { id: 'export', do: 'Know where Take it with you is, so leaving is always one step', on: 'export', minutes: 1 },
    { id: 'say-something', do: 'Know where Settings › About is, to say something is wrong from inside the app', on: 'setAbout', minutes: 1 },
  ],
  faculty: [
    { id: 'university', do: 'Read the University screen: every campus service and what the app can honestly do for each', on: 'university', minutes: 3 },
    { id: 'syllabus', do: 'Check how one of your syllabi imports, so you know what students see', on: 'import', minutes: 5 },
    { id: 'privacy', do: 'Read what Semester can and cannot show you about a student', on: 'privacy', minutes: 3 },
    { id: 'say-something', do: 'Know where Settings › About is, to report a problem from inside the app', on: 'setAbout', minutes: 1 },
  ],
  advisor: [
    { id: 'help', do: 'Skim How this works, so you can answer “where is that?” from students', on: 'help', minutes: 3 },
    { id: 'degree', do: 'See the degree view a student sees, and how it differs from the official audit', on: 'degree', minutes: 5 },
    { id: 'support', do: 'Know the Support map a student is shown, so a referral matches it', on: 'support', minutes: 3 },
    { id: 'privacy', do: 'Read what a student has to share before you can see it', on: 'privacy', minutes: 3 },
  ],
  admin: [
    { id: 'university', do: 'Read the University screen as a student sees it, and note any service your school describes differently', on: 'university', minutes: 3 },
    { id: 'register', do: 'Name an owner for each item in the content readiness register; the sources can follow', minutes: 10 },
    { id: 'privacy', do: 'Read the Privacy screen as a student would, and note anything your school says differently', on: 'privacy', minutes: 3 },
    { id: 'export', do: 'Confirm a student can take their data with them before you invite any', on: 'export', minutes: 2 },
  ],
};

export function checklistProblems(role: Role, steps: readonly Step[]): string[] {
  const out: string[] = [];
  if (steps.length === 0) out.push(`${role}: empty`);
  if (steps.length > MAX_STEPS) out.push(`${role}: ${steps.length} steps; at most ${MAX_STEPS}`);
  const minutes = steps.reduce((n, s) => n + s.minutes, 0);
  if (minutes > MAX_MINUTES) out.push(`${role}: ${minutes} minutes; at most ${MAX_MINUTES}`);
  const ids = new Set<string>();
  for (const s of steps) {
    if (ids.has(s.id)) out.push(`${role}: step ${s.id} twice`);
    ids.add(s.id);
    if (!(s.minutes > 0)) out.push(`${role}: step ${s.id} takes no time`);
  }
  return out;
}
