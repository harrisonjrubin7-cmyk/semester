import { describe, expect, it } from 'vitest';
import { AT_MOST, inDays, shortTitle, suggest, type Coming } from './toolnow';

const item = (over: Partial<Coming> = {}): Coming => ({
  id: 'i1',
  title: 'Problem set 4',
  kind: 'Problem set',
  code: 'ECON 1020',
  courseId: 'econ' as Coming['courseId'],
  daysAway: 3,
  when: 'Friday',
  ...over,
});

const screens = (list: Coming[], held?: { sources: number }) =>
  suggest(list, held).map((s) => s.screen);

describe('inDays', () => {
  it('says it the way a person would', () => {
    expect(inDays(0)).toBe('today');
    expect(inDays(-1)).toBe('today');
    expect(inDays(1)).toBe('tomorrow');
    expect(inDays(6)).toBe('in 6 days');
  });
});

describe('shortTitle', () => {
  it('leaves a title that fits alone', () => {
    expect(shortTitle('Problem set 4')).toBe('Problem set 4');
  });

  it('cuts a syllabus question at a word, and shows that it cut', () => {
    const out = shortTitle('Reflection #2 — Are elite athletes super-humans?');
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(43);
    expect(out).toContain('Reflection #2');
    // No dangling dash or space in front of the ellipsis.
    expect(out).not.toMatch(/[\s—–-]…$/);
  });
});

describe('suggest', () => {
  it('suggests nothing when there is nothing coming', () => {
    expect(suggest([])).toEqual([]);
  });

  it('ignores what is further off than a fortnight', () => {
    expect(suggest([item({ kind: 'Exam', daysAway: 30 })])).toEqual([]);
  });

  it('offers a paper to sit before a test, and names the test', () => {
    const [top] = suggest([item({ kind: 'Quiz', title: 'Quiz 5', daysAway: 6 })]);
    expect(top.screen).toBe('exam');
    expect(top.courseId).toBe('econ');
    expect(top.why).toContain('ECON 1020 quiz in 6 days');
  });

  it('calls a quiz a quiz and an exam an exam', () => {
    expect(suggest([item({ kind: 'Exam', daysAway: 4 })])[0].why).toContain('exam in 4 days');
    expect(suggest([item({ kind: 'Quiz', daysAway: 4 })])[0].why).toContain('quiz in 4 days');
  });

  it('stops offering to plan the weeks when there are no weeks left', () => {
    expect(screens([item({ kind: 'Exam', daysAway: 5 })])).toContain('runway');
    expect(screens([item({ kind: 'Exam', daysAway: 1 })])).not.toContain('runway');
  });

  it('breaks a written brief down, quoting it', () => {
    const [top] = suggest([item({ kind: 'Paper', title: 'Paper 2 — federalism', daysAway: 9 })]);
    expect(top.screen).toBe('work');
    expect(top.why).toContain('Paper 2 — federalism');
    expect(top.why).toContain('Friday');
  });

  it('offers the method for a problem set, not just the plan', () => {
    expect(screens([item({ kind: 'Problem set', daysAway: 3 })])).toContain('solve');
  });

  it('offers proofreading only once there is plausibly a draft', () => {
    expect(screens([item({ kind: 'Paper', daysAway: 2 })])).toContain('proof');
    expect(screens([item({ kind: 'Paper', daysAway: 12 })])).not.toContain('proof');
  });

  it('mentions the readings only when some have been kept', () => {
    const paper = [item({ kind: 'Paper', daysAway: 5 })];
    expect(screens(paper, { sources: 0 })).not.toContain('sources');
    const why = suggest(paper, { sources: 6 }).find((s) => s.screen === 'sources')?.why ?? '';
    expect(why).toContain('6 kept readings');
  });

  it('reads data work out of the title', () => {
    expect(screens([item({ title: 'Regression exercise', kind: 'Problem set' })])).toContain(
      'analyse',
    );
    expect(screens([item({ title: 'Problem set 4', kind: 'Problem set' })])).not.toContain(
      'analyse',
    );
  });

  it('reads a presentation out of the title', () => {
    expect(screens([item({ title: 'Group presentation', kind: 'Group work' })])).toContain('deck');
  });

  it('never points coursework at the personal-writing screen', () => {
    const busy = [
      item({ kind: 'Paper', daysAway: 2 }),
      item({ kind: 'Reflection', daysAway: 4 }),
      item({ kind: 'Exam', daysAway: 5 }),
    ];
    expect(screens(busy)).not.toContain('essay');
  });

  it('puts the nearer test above the further one, and says so once', () => {
    const out = suggest([
      item({ kind: 'Exam', code: 'PSCI 1104', courseId: 'psci' as Coming['courseId'], daysAway: 2 }),
      item({ kind: 'Exam', daysAway: 11 }),
    ]);
    const exam = out.filter((s) => s.screen === 'exam');
    expect(exam).toHaveLength(1);
    expect(exam[0].courseId).toBe('psci');
  });

  it('gives a busy fortnight a handful rather than a second list', () => {
    const busy = [
      item({ kind: 'Exam', daysAway: 2 }),
      item({ kind: 'Paper', daysAway: 3 }),
      item({ kind: 'Problem set', daysAway: 4 }),
      item({ title: 'Group presentation', kind: 'Group work', daysAway: 6 }),
      item({ title: 'Dataset write-up', kind: 'Paper', daysAway: 8 }),
    ];
    expect(suggest(busy, { sources: 4 })).toHaveLength(AT_MOST);
  });

  it('shortens a long title rather than pushing the reason off the card', () => {
    const [top] = suggest([
      item({ kind: 'Paper', title: 'Reflection #2 — Are elite athletes super-humans?', daysAway: 5 }),
    ]);
    expect(top.why).toContain('Reflection #2');
    expect(top.why).toContain('…');
    expect(top.why).toContain('the brief broken into a rubric');
  });

  it('ranks what is due tomorrow above what is due in a fortnight', () => {
    const late = suggest([item({ kind: 'Paper', daysAway: 13 })])[0];
    const soon = suggest([item({ kind: 'Paper', daysAway: 1 })])[0];
    expect(soon.score).toBeGreaterThan(late.score);
  });
});
