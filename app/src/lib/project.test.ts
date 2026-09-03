import { describe, expect, it } from 'vitest';
import { SYSTEM, blanks, brief, fileName, header, runway, schedule, shape } from './project';

const from = new Date(2026, 8, 3);

describe('schedule', () => {
  it('counts back from the deadline and ends on it', () => {
    const plan = schedule(new Date(2026, 9, 3), from);
    expect(plan).toHaveLength(6);
    expect(plan[0].date).toBe('2026-09-08');
    expect(plan[plan.length - 1].date).toBe('2026-10-03');
  });

  it('never dates a step in the past', () => {
    // A plan that opens with a step you have already missed gets closed.
    for (const m of schedule(new Date(2026, 8, 5), from)) {
      expect(m.date >= '2026-09-03').toBe(true);
    }
  });

  it('never dates a step after the deadline', () => {
    for (const m of schedule(new Date(2026, 8, 20), from)) {
      expect(m.date <= '2026-09-20').toBe(true);
    }
  });

  it('collapses onto the days that exist when there are almost none', () => {
    // A paper due tomorrow gets "today, today, tomorrow", which is honest,
    // rather than a fortnight that is not there.
    const plan = schedule(new Date(2026, 8, 4), from);
    expect(new Set(plan.map((m) => m.date)).size).toBeLessThanOrEqual(2);
    expect(plan[plan.length - 1].date).toBe('2026-09-04');
  });

  it('says today for something due today rather than inventing runway', () => {
    for (const m of schedule(from, from)) expect(m.date).toBe('2026-09-03');
  });

  it('does not run off the end for a date already gone', () => {
    for (const m of schedule(new Date(2026, 7, 1), from)) expect(m.date).toBe('2026-08-01');
  });

  it('keeps the steps in order', () => {
    const plan = schedule(new Date(2026, 10, 1), from);
    for (let i = 1; i < plan.length; i++) expect(plan[i].date >= plan[i - 1].date).toBe(true);
  });
});

describe('runway', () => {
  it('says how much room there is, the way a person would', () => {
    expect(runway(from, from)).toBe('Due today.');
    expect(runway(new Date(2026, 8, 4), from)).toBe('One day.');
    expect(runway(new Date(2026, 8, 10), from)).toBe('7 days.');
    expect(runway(new Date(2026, 9, 3), from)).toContain('4 weeks');
  });

  it('does not pretend a past date is future room', () => {
    expect(runway(new Date(2026, 7, 1), from)).toBe('That date has gone by.');
  });
});

describe('SYSTEM', () => {
  it('draws the line at writing the essay', () => {
    expect(SYSTEM).toContain('You do not write the essay');
    expect(SYSTEM).toContain('You do not answer it');
  });

  it('forbids fabricating a citation, and says why', () => {
    // The most damaging thing it could produce: it looks exactly like a real
    // one, and it is the student's name on it.
    expect(SYSTEM).toContain('never invent a source');
    expect(SYSTEM).toContain('fabricated citation');
  });

  it('forbids prose in the student’s voice, because that gets handed in', () => {
    expect(SYSTEM).toContain('never write body prose');
    expect(SYSTEM).toContain('handed in verbatim');
  });

  it('forbids inventing rubric criteria', () => {
    expect(SYSTEM).toContain('Do not invent criteria');
  });
});

describe('brief', () => {
  const ask = {
    shape: 'essay',
    instructions: 'Write 2000 words on federalism. Chicago style.',
    question: 'Does federalism protect minority rights?',
    sources: 'Riker 1964\nTrounstine 2018',
    course: 'PSCI 1104',
    milestones: schedule(new Date(2026, 9, 3), from),
    dueLabel: 'Oct 3',
  };

  it('carries the instructions verbatim and the student’s own sources', () => {
    const text = brief(ask);
    expect(text).toContain('Chicago style');
    expect(text).toContain('Riker 1964');
    expect(text).toContain('use these and only these');
  });

  it('hands the computed schedule over and forbids recalculating it', () => {
    // Dates are arithmetic, and a model asked for "three weeks before the
    // 14th" will sometimes say the 21st.
    const text = brief(ask);
    expect(text).toContain('Do not recalculate the dates');
    expect(text).toContain('2026-10-03');
  });

  it('says plainly when there are no sources rather than leaving it ambiguous', () => {
    expect(brief({ ...ask, sources: '' })).toContain('(none given)');
    expect(brief({ ...ask, sources: '' })).toContain('leave an empty table');
  });

  it('says plainly when there are no instructions', () => {
    expect(brief({ ...ask, instructions: '' })).toContain('leave the rubric section empty');
  });
});

describe('shape', () => {
  it('falls back rather than crashing on an unknown id', () => {
    expect(shape('nope').id).toBe('essay');
  });

  it('tells a group project to name who owns what', () => {
    expect(shape('group').brief).toContain('who owns');
  });
});

describe('header', () => {
  it('makes it obvious what the file is later', () => {
    expect(header('Federalism essay', 'PSCI 1104', 'Oct 3')).toContain('# Federalism essay');
    expect(header('Federalism essay', 'PSCI 1104', 'Oct 3')).toContain('PSCI 1104 · Due Oct 3');
  });

  it('copes with no course', () => {
    expect(header('Essay', '', 'Oct 3')).toContain('Due Oct 3');
  });
});

describe('fileName', () => {
  it('names it after the course and the question', () => {
    expect(fileName('Does federalism protect minority rights?', 'PSCI 1104')).toBe(
      'psci-1104-does-federalism-protect-minority-rights.md',
    );
  });

  it('never produces a nameless file', () => {
    expect(fileName('   ', '')).toBe('project.md');
  });
});

describe('blanks', () => {
  it('counts the places left for the student', () => {
    expect(blanks('## Thesis\n\n[your one-sentence claim here]\n\n[the evidence for it]')).toBe(2);
  });

  it('does not count a markdown link as a blank', () => {
    expect(blanks('See [the rubric](https://example.com) for details.')).toBe(0);
  });

  it('is zero when the document has no blanks, which is itself the signal', () => {
    // Near zero means it wrote the essay after all, and that is worth seeing.
    expect(blanks('## Thesis\n\nFederalism protects minority rights because...')).toBe(0);
  });
});
