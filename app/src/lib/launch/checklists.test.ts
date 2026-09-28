import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIRST_DAY, MAX_MINUTES, MAX_STEPS, checklistProblems, type Role } from './checklists';

/**
 * The first-day checklists: short enough to finish, pointed at screens that
 * exist (the `Screen` type does that part), and the same in the doc as here.
 */

const doc = readFileSync(join(import.meta.dirname, '../../../../docs/launch/FIRST-DAY-CHECKLISTS.md'), 'utf8');
const TITLES: Record<Role, string> = { student: 'Students', faculty: 'Faculty', advisor: 'Advisors', admin: 'University administrators' };

describe('first-day checklists', () => {
  it.each(Object.keys(FIRST_DAY) as Role[])('%s: short enough to finish', (role) => {
    expect(checklistProblems(role, FIRST_DAY[role])).toEqual([]);
  });

  it('would refuse a list too long, too slow or with a repeated step (controls)', () => {
    const step = { id: 'a', do: 'x', minutes: 1 };
    expect(checklistProblems('student', Array.from({ length: MAX_STEPS + 1 }, (_, i) => ({ ...step, id: `s${i}` }))).join()).toMatch(/steps/);
    expect(checklistProblems('student', [{ ...step, minutes: MAX_MINUTES + 1 }]).join()).toMatch(/minutes/);
    expect(checklistProblems('student', [step, step]).join()).toMatch(/twice/);
  });

  it('shows a student, on day one, what leaves the device and how to leave', () => {
    const screens = FIRST_DAY.student.map((s) => s.on);
    expect(screens).toContain('privacy');
    expect(screens).toContain('export');
  });

  it('says the same thing in the document, step by step and in order', () => {
    for (const role of Object.keys(FIRST_DAY) as Role[]) {
      const section = doc.split(`## ${TITLES[role]}\n`)[1]?.split('\n## ')[0] ?? '';
      const listed = [...section.matchAll(/^\d+\. (.*)\. \((\d+) min\)$/gm)].map((m) => ({ do: m[1], minutes: Number(m[2]) }));
      expect(listed, role).toEqual(FIRST_DAY[role].map((s) => ({ do: s.do, minutes: s.minutes })));
    }
  });
});
